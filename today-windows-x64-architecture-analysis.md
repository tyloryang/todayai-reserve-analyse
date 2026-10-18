# Today AI 桌面客户端 (`today-windows-x64.exe`) 全景架构与源码逐模块深度解析

> **分析目标**：`today-windows-x64.exe` (版本: `1.21.6.0`, 平台: `Windows x64`)  
> **逆向工程方法**：基于 REA (Reverse Engineer Anything) 工具链、PE 结构分解、ASAR 归档萃取、.NET Core Bundle 逆向与 JavaScript/TypeScript AST 静态分析。  
> **生成时间**：2026-10-18  

---

## 目录
1. [系统总体架构与全景拓扑](#一系统总体架构与全景拓扑)
2. [模块一：桌面主进程与生命周期编排模块 (Electron Main & Lifecycle)](#二模块一桌面主进程与生命周期编排模块-electron-main--lifecycle)
3. [模块二：Web 运行时托管与命名管道 IPC (Web Runtime Host & Named Pipe)](#三模块二web-运行时托管与命名管道-ipc-web-runtime-host--named-pipe)
4. [模块三：三层 Bridge 接口契约体系 (WEI, SEI, CPI)](#四模块三三层-bridge-接口契约体系-wei-sei-cpi)
5. [模块四：Windows 原生宿主与 53 项本地 Agent 工具矩阵 (Platform Host & Native Tools)](#五模块四windows-原生宿主与-53-项本地-agent-工具矩阵-platform-host--native-tools)
6. [模块五：云端长连接与远程 Agent 任务调度 (Socket & Realtime Contract)](#六模块五云端长连接与远程-agent-任务调度-socket--realtime-contract)
7. [模块六：原生轻量多窗口与悬浮 UI 系统 (Multi-Window & Floating Shell)](#七模块六原生轻量多窗口与悬浮-ui-系统-multi-window--floating-shell)
8. [模块七：Next.js Standalone 与 TCK 动态卡片微前端引擎 (Frontend & TCK Engine)](#八模块七nextjs-standalone-与-tck-动态卡片微前端引擎-frontend--tck-engine)
9. [总结与架构设计启示](#九总结与架构设计启示)

---

## 一、系统总体架构与全景拓扑

`today-windows-x64.exe` 并非传统的单体 Electron 应用，而是采用了由 **Electron 调度层**、**Next.js 独立 Web 服务层**、**C# (.NET Core) 操作系统能力宿主层** 组成的 **三层异构运行时架构**。

```
+-----------------------------------------------------------------------------------------+
|                                Today AI 云端服务集群                                    |
|                      (api.todayai.cn / api.today.ai - LLM 大脑)                         |
+-----------------------------------------------------------------------------------------+
                                             ▲
                                             │ WSS 双向长连接 (realtime-contract)
                                             │ [状态同步 / 离线消息 / Agent invocation.request]
                                             ▼
+=========================================================================================+
|                           Electron 桌面主进程 (Node.js 运行时)                          |
|                                                                                         |
|  [DesktopMainApp] (生命周期编排 / 单实例互斥 / 深度链接 / 启动阶段诊断)                 |
|                                                                                         |
|  [ClientNodeAdapter]                                                                    |
|   ├── SEI (System Extended Interface): Cookie 镜像 / 会话维护 / 账号凭证 / 本地文件缓存 |
|   ├── SocketNativeTools: 远程 Tool 调度拦截与授权鉴定                                   |
|   └── ToolCatalogSync: 53 项本地 Native 工具元数据动态上报                              |
|                                                                                         |
|  [DesktopWebRuntime]                                                                    |
|   └── utilityProcess.fork(web-runtime-host.cjs)                                         |
+=========================================================================================+
            │                                                           │
            │ Windows Named Pipe (HTTP over IPC)                        │ Stdin/Stdout (JSON-RPC 2.0)
            │ \\.\pipe\today-web-runtime-${UUID}                        │ (CrossPlatformRpc / CPI)
            ▼                                                           ▼
+-----------------------------------------+   +-------------------------------------------+
|      内置 Next.js Standalone 服务       |   |       TodayWindowsPlatformHost.exe        |
|   (resources/web-runtimes/prod.asar)    |   |     (resources/tools/windows/ - .NET)     |
|                                         |   |                                           |
|  [Next.js 16.3.4 (React 19 + Turbopack)]|   |  [53项 Windows 操作系统级原子能力执行器]:  |
|   ├── /today, /chat (核心界面)          |   |   ├── fs: 桌面/文档/下载文件递归与读取    |
|   ├── /calendar, /tasks, /routines      |   |   ├── screen: 截屏 / UIA 控件树定位       |
|   ├── /memories, /health, /connectors   |   |   ├── ghost: 桌面自动化无感键鼠驱动       |
|   └── TCK Widget 动态微前端 (.tckb)     |   |   ├── mail / outlook / contacts / notes   |
+-----------------------------------------+   |   ├── shell: 受限系统脚本执行             |
            │ 页面渲染与交互通道              |   └── audio: 高保真录音与分贝电平监测     |
            ▼                                 +-------------------------------------------+
+-----------------------------------------+                 ▲
|        Electron 渲染进程 (BrowserWindow) |                 │ Win32 API 跨进程穿透
|                                         |                 │ AllowSetForegroundWindow
|  [Preload 隔离层] (desktop.cjs)         |                 ▼
|   └── window.__DesktopWebExtendedAPI    |   +-------------------------------------------+
|        (WEI: Web Extended Interface)    |   |       today-windows-foreground.node       |
|                                         |   |        (原生 C++ Node Addon 焦点锁)       |
|  [原生轻量级辅助窗口]:                  |   +-------------------------------------------+
|   ├── recording-capsule (悬浮录音胶囊)  |
|   ├── meeting-reminder (会议弹出通知)   |
|   └── tool-permissions (Agent 授权确认) |
+-----------------------------------------+
```

---

## 二、模块一：桌面主进程与生命周期编排模块 (Electron Main & Lifecycle)

### 2.1 源码位置与依赖注入结构
- **核心文件**：`extracted_app/dist/app/main/index.js` 与 `extracted_app/dist/app/app/index.js`
- **架构模式**：采用 **InversifyJS** 实现控制反转（IoC）与依赖注入（DI），通过 `@injectable()` 和 `@inject()` 组织各类系统服务，解耦平台相关实现。

### 2.2 启动编排序列（Startup Diagnostics Pipeline）
主进程在拉起整个应用时，引入了状态机式的启动诊断系统 `StartupDiagnostics`，将启动过程划分为 14 个精确阶段：

```
[enter] data_reset 
   │  --> 检测是否存在本地数据重置标识；若有，清空磁盘与 Session
[enter] network_inspection
   │  --> 探测系统网络代理（PAC/SOCKS5/HTTP），配置 Node 与 Chromium 代理转发
[enter] features_prepare
   │  --> 读取本地持久化的 Feature 开关列表
[enter] preflight
   │  --> 执行资源前置检查，校验 preload.cjs、loading-page 等文件哈希
[enter] protocol_recover & protocol_prepare
   │  --> 注册 Windows 协议（today-connector:// 与 today://）
[enter] native_host_start
   │  --> 派生拉起 C# 原生宿主进程 TodayWindowsPlatformHost.exe
[enter] adapter_create
   │  --> 创建 ClientNodeAdapter 适配中心，绑定 CPI 与 SEI
[enter] shell_prepare & shell_ready & shell_launch
   │  --> 构建主窗口 BrowserWindow、托盘图标、全局快捷键
[enter] web_runtime
   │  --> 启动命名管道，并拉起 Next.js Standalone 守护进程
[enter] shell_open
   │  --> 主窗口加载本地 WebRuntime 页面，消除白屏并完成展示
[enter] launched
   │  --> 发送启动成功信号，注销前置诊断监听
```

### 2.3 异常拦截与自动降级恢复 (`DesktopStartupRecovery`)
在 `dist/app/main/index.js` 中，主流程外层包裹了严密的恢复机制：
```javascript
const main = async () => {
    const recovery = new DesktopStartupRecovery();
    try {
        const desktopApp = await DesktopMainApp.create({
            application: app,
            bypassSecret: PACKAGED_VERCEL_BYPASS_SECRET,
            ipc: ipcMain,
            lane: PACKAGED_BACKEND_LANE,
            logs: { postHogHost: ..., postHogTokenProd: ..., sentryDsn: ... },
            recovery,
        });
        if (!desktopApp) return;
        await desktopApp.launch();
    } catch (error) {
        if (process.argv.includes(DESKTOP_PROTOCOL_RESTORE_ARGUMENT)) {
            console.error('[desktop] protocol restoration failed; recovery is pending');
            app.exit(1);
            return;
        }
        console.error('[desktop] startup failed');
        await recovery.show(error); // 独立降级窗口：允许用户重置缓存、切换灰度泳道或上报日志
    }
};
main();
```

---

## 三、模块二：Web 运行时托管与命名管道 IPC (Web Runtime Host & Named Pipe)

### 3.1 传统端口绑定的安全缺陷与命名管道革新
传统 Electron 混合桌面端在内置 Web 服务时通常监听 `127.0.0.1:3000` 等 TCP 端口，存在：
1. **端口碰撞**：宿主机已有服务占用端口导致崩溃；
2. **跨站风险**：浏览器任意网页可通过 `fetch('http://localhost:3000')` 攻击本地服务；
3. **恶意窥探**：本地其它未受信任进程可直接向该端口注入请求。

Today AI 采用了 **Windows 命名管道（Named Pipe）隔离方案**。

### 3.2 命名管道实现细节
在 `dist/app/app/index.js:233526`：
```typescript
class DesktopWebRuntimeIpcEndpoint {
    async create() {
        this.dispose();
        if (process.platform === 'win32') {
            return `\\\\.\\pipe\\today-web-runtime-${randomUUID()}`;
        }
        // Linux/macOS 则使用严格权限的 Unix Domain Socket
        const directory = await mkdtemp(join("/tmp", 'today-wr-'));
        return join(directory, 'runtime.sock');
    }
}
```

### 3.3 UtilityProcess 子进程与服务钩子拦截
主进程通过 Electron 的 `utilityProcess.fork` 拉起 `dist/app/web-runtime-host.cjs`：
```typescript
const child = utilityProcess.fork(runtimeHostPath, [], {
    env: processEnvironment,
    serviceName: 'Today Web Runtime',
    stdio: 'pipe'
});
```

在 `web-runtime-host.cjs:48370` 中，宿主环境使用猴子补丁（Monkey-Patch）动态拦截了 Node.js 的原生 `http.createServer`：
```javascript
const guardedCreateServer = (...args) => {
    const server = originalCreateServer(...args);
    // 强制将 server.listen 绑定至指定的命名管道，而不是暴露 TCP 端口
    server.listen(endpointPath, () => {
        this.parentPort.postMessage({ type: 'listening', endpointPath });
    });
    return server;
};
http.createServer = guardedCreateServer;
```

### 3.4 三重验证安全请求头
当 Electron 窗口请求加载页面及内部 API 时，主进程的协议拦截器自动注入不可伪造的安全头：
- `x-today-desktop-runtime-token`：每次启动生成的 256 位随机凭证。
- `x-today-desktop-logical-origin`：逻辑源头校验（要求来源必须完全匹配客户端 baseDomain）。
- `x-today-desktop-traffic-lane`：灰度环境泳道控制。

---

## 四、模块三：三层 Bridge 接口契约体系 (WEI, SEI, CPI)

Today AI 设计了分工明确、职责隔离的三层接口契约：

```
+--------------------------------------------------------------------------------+
| 前端页面 (Next.js / React)                                                      |
+--------------------------------------------------------------------------------+
       ▲
       │ WEI (Web Extended Interface) - 24 个暴露模块，基于 contextBridge 深度冻结
       ▼
+--------------------------------------------------------------------------------+
| Preload 隔离层 (desktop.cjs)                                                   |
+--------------------------------------------------------------------------------+
       ▲
       │ Electron IPC (ipcRenderer.invoke <--> ipcMain.handle)
       ▼
+--------------------------------------------------------------------------------+
| Node.js 主进程 (ClientNodeAdapter)                                              |
|  └── SEI (System Extended Interface): 会话镜像 / 文件缓存 / 偏好 / 网络分类器   |
+--------------------------------------------------------------------------------+
       ▲
       │ CPI (Cross Platform Interface) - JSON-RPC 2.0 (NDJSON) over Stdin/Stdout
       ▼
+--------------------------------------------------------------------------------+
| C# 原生宿主进程 (TodayWindowsPlatformHost.exe)                                  |
+--------------------------------------------------------------------------------+
```

### 4.1 WEI 模块完整清单
在 `dist/preload/desktop.cjs` 中，通过 `interfaceDefinitions.wei.modules` 定义并经 `createWebExtendedFacade()` 冻结暴露给 `window.__DesktopWebExtendedAPI` 的 24 个模块：

| 模块名 | 核心方法 (Methods) | 事件通知 (Events) | 业务职责 |
| :--- | :--- | :--- | :--- |
| **`runtime`** | `getRuntimeInfo` | - | 获取运行时版本、构建哈希与运行环境 |
| **`account`** | `signInWithOAuth`, `requestPhoneCode`, `verifyPhoneCode`, `switchAccount`, `signOut` | `changed`, `afterSignIn`, `afterSwitch` | 账号鉴权中心与多身份切换 |
| **`shell`** | `getForegroundState`, `activate`, `dismiss`, `setSize`, `animateSize` | `foregroundChanged`, `deepLinkRequested` | 窗口控制、无感缩放与深层链接拦截 |
| **`tools`** | `listTools`, `getToolInfo`, `getRunningTasks`, `startTask`, `cancelTask` | `catalogChanged`, `taskChanged` | 本地 AI Agent 工具集执行与任务管理 |
| **`permissions`**| `listPermissions`, `getPermissionInfo`, `performPermissionAction` | - | 本地危险操作鉴权决策 |
| **`record`** | `getState`, `start`, `setPaused`, `stop`, `retry`, `exportAudio` | `stateChanged` | 会议录音生命周期与音频流导出 |
| **`audio`** | `startCapture`, `stopCapture` | `segmentCompleted`, `levelChanged`, `healthChanged` | 高精录音分片与实时音量电平推送 |
| **`fileCache`** | `open`, `read`, `beginWrite`, `writeChunk`, `commitWrite` | - | 会话内大文件流式传输分片缓存 |
| **`socket`** | `getSocketState`, `forceSync`, `receive` | `stateChange`, `notificationActivated` | WebSocket 长连接穿透通信 |
| **`system`** | `getSystemInfo`, `getDeviceInfo`, `setPreventSleepWhileRunning` | - | 硬件信息与阻止系统休眠 |
| **`shortcuts`** | `listShortcuts`, `setShortcutBinding` | `triggered` | 全局快捷键注册与动态改绑 |

### 4.2 CPI 契约与序列化
CPI 负责将 Node.js 的异步调用序列化为跨进程请求，传输给 C# 宿主：
```typescript
class CrossPlatformRpc extends ReadonlyEvents {
    async sendRequest(method, params) {
        if (params === undefined) {
            return await this.connection.sendRequest(method);
        }
        return await this.connection.sendRequest(method, params);
    }
}
```

---

## 五、模块四：Windows 原生宿主与 53 项本地 Agent 工具矩阵 (Platform Host & Native Tools)

### 5.1 `TodayWindowsPlatformHost.exe` 架构特征
- **技术选型**：**.NET 10 / CoreCLR** 编译的单文件独立程序（Self-contained Single-file），体积约 38MB。
- **IPC 管道机制**：通过 `PlatformHostTransport` 绑定子进程标准输入输出流。
- **消息边界约束**：
  - 单条 NDJSON 消息容量最大支持：`PLATFORM_HOST_MAX_MESSAGE_BYTES = 32MB`
  - 单行日志最大截断字节：`PLATFORM_HOST_MAX_STDERR_LINE_BYTES = 8KB`
  - 优雅终止与强制退出定时器（6秒优雅退出，1秒后强制 `SIGKILL`）。

### 5.2 15 大连接器与 53 项本地能力矩阵 (`DESKTOP_CONNECTOR_CAPABILITIES`)
代码中完整注册了如下 Windows 系统原子能力（Capability IDs）：

```
[15大类 Connectors 与 53项原子能力清单]
├── 1. 文件系统族 (File Connectors)
│    ├── windows_desktop    --> [fs.read, fs.list, fs.stat]
│    ├── windows_documents  --> [fs.read, fs.list, fs.stat]
│    ├── windows_downloads  --> [fs.read, fs.list, fs.stat]
│    └── windows_other_files--> [fs.read, fs.list, fs.stat]
├── 2. 屏幕与视觉感知 (Vision Connectors)
│    └── windows_screen     --> [screen.capture (高分截屏), screen.get (屏幕拓扑), screen.elements.find (UIA 控件定位)]
├── 3. 桌面 Agent 自动化 (Ghost Automation)
│    └── windows_ghost      --> [ghost.context (窗口状态提取), ghost.click (坐标/控件模拟键鼠操作)]
├── 4. 系统脚本与执行 (System Execution)
│    └── windows_shell      --> [script.shell (受限环境命令执行)]
├── 5. 个人信息与办公生态 (PIM & Office Connectors)
│    ├── windows_calendar   --> [calendar.list, calendar.events.list]
│    ├── windows_contacts   --> [contacts.list, contacts.get]
│    ├── windows_reminders  --> [reminders.list, reminders.create]
│    ├── windows_notes      --> [notes.list, notes.get]
│    ├── windows_mail       --> [mail.accounts.list, mail.messages.list]
│    └── windows_outlook    --> [calendar.events.list, contacts.list, mail.messages.list, notes.list, reminders.list]
└── 6. 辅助原生能力 (Device & Aux Connectors)
     ├── windows_clipboard  --> [clipboard.read, clipboard.write]
     ├── windows_battery    --> [battery.get]
     ├── windows_location   --> [location.get]
     ├── windows_system     --> [system.get, system.apps.list]
     └── windows_device     --> [battery.get, system.get]
```

### 5.3 `today-windows-foreground.node` C++ 原生焦点穿透插件
Windows 为了防止恶意流氓软件弹窗，有 `LockSetForegroundWindow` 机制。Today AI 自行编写了 C++ 动态链接库：
```typescript
// 摘自 dist/app/app/index.js:230550
class WindowsStatusMenuForeground {
    grant(processId) {
        // 调用底层 Win32 API: AllowSetForegroundWindow(processId)
        if (!this.binding.allowSetForegroundWindow(processId)) {
            throw new Error('Windows did not allow the status menu host to acquire foreground focus.');
        }
    }
}
```
该机制保证了无论用户当前在打游戏、看全屏视频还是进行代码编写，悬浮胶囊和快捷唤起（QuickChat）总能第一时间稳定抢占键盘焦点，避免“唤出后需鼠标再点一次才能打字”的体验瑕疵。

---

## 六、模块五：云端长连接与远程 Agent 任务调度 (Socket & Realtime Contract)

### 6.1 模块定位与职责
端侧维护一条直连 `api.todayai.cn` 的 WebSocket 链路。该链路不仅是双向通知通道，更是**云端 LLM Agent 控制本地电脑执行工具调用的控制中枢**。

### 6.2 远程工具调用时序图 (Remote Invocation Flow)

```
[云端 LLM Agent]                   [SocketNativeTools]           [CPI / C# Platform Host]
       │                                   │                                 │
       │  1. invocation.request            │                                 │
       │──────────────────────────────────>│                                 │
       │                                   │ 2. 校验权限与作用域            │
       │                                   │    assertCurrentScope()         │
       │  3. invocation.progress (每15秒)  │                                 │
       │<──────────────────────────────────│                                 │
       │                                   │ 4. 派发工具执行请求             │
       │                                   │────────────────────────────────>│
       │                                   │                                 │ 5. 执行本地系统调用
       │                                   │                                 │    (如截屏/读取Outlook)
       │                                   │ 6. 返回执行数据 (NDJSON)        │
       │                                   │<────────────────────────────────│
       │  7. invocation.result             │                                 │
       │<──────────────────────────────────│                                 │
       │                                   │                                 │
[LLM 聚合结果，生成下一步回答]
```

### 6.3 核心实现代码走读
在 `client-node-adapter/.../modules/socket/modules/native-tools/index.ts:203440`：
```typescript
async route(message) {
    switch (message['type']) {
        case 'invocation.request': {
            const invocationId = message['invocationId'];
            const request = toNativeToolInvocationRequest(message);
            if (!request) {
                this.client?.sendInvocationResult?.({
                    error: { code: 'INVALID_ARGS', message: 'The remote tool invocation payload is invalid.' },
                    invocationId
                });
                return true;
            }
            // 校验权限（若未授权，抛出异常或拉起原生 tool-permissions 窗口向用户索权）
            this.authorization.assertCurrentScope(invocation.scope);
            // 启动定时心跳，防止云端长任务超时
            this.startProgress(invocationId, running);
            // 调度 CPI 执行
            const result = await this.cpi.tools.startTask(request);
            // 回传给云端
            this.client?.sendInvocationResult?.({ invocationId, result });
            return true;
        }
    }
}
```

---

## 七、模块六：原生轻量多窗口与悬浮 UI 系统 (Multi-Window & Floating Shell)

主进程除管理主渲染视窗外，还内置了一套基于纯原生 HTML/CSS/Preload 的多窗口弹层系统（位于 `dist/pages/`），避免了重型界面的资源开销：

### 7.1 录音胶囊悬浮条 (`recording-capsule`)
- **窗口属性**：`alwaysOnTop: true`, `frame: false`, `transparent: true`。
- **IPC 通道**：
  - `desktop-recording-capsule:pointer`: 鼠标穿透与拖拽控制。
  - `desktop-recording-capsule:state-changed`: 音频电平变化与录制时长。
  - `desktop-recording-capsule:open-notes`: 一键收起胶囊并打开完整会议纪要页面。

### 7.2 会议通知提醒弹窗 (`meeting-reminder`)
- 日历事件触发时在桌面右下角弹出，具备优雅退出的平滑过渡状态机（`ready` -> `finish-exit`）。
- 允许用户一键开启“自动录音并生成 AI 纪要”。

### 7.3 Agent 工具权限确认弹窗 (`tool-permissions`)
- 拦截敏感指令（如 Shell 执行、文件覆盖写、邮箱导出等）。
- 通过 `ClientToolPermissionsAPI` 向渲染层暴露：
  ```javascript
  const toolPermissionsAPI = {
      close: () => ipcRenderer.invoke('desktop-tool-permissions:close'),
      getPermissions: () => ipcRenderer.invoke('desktop-tool-permissions:get'),
      setPermissions: (params) => ipcRenderer.invoke('desktop-tool-permissions:set', params),
      setRejectionCode: (params) => ipcRenderer.invoke('desktop-tool-permissions:set-rejection-code', params)
  };
  contextBridge.exposeInMainWorld('ClientToolPermissionsAPI', Object.freeze(toolPermissionsAPI));
  ```

---

## 八、模块七：Next.js Standalone 与 TCK 动态卡片微前端引擎 (Frontend & TCK Engine)

### 8.1 Next.js 16.3.4 生产架构
- 前端代码位于 `resources/web-runtimes/prod.asar/apps/web/`。
- 启动脚本 `server.js` 采用 Next.js 官方 **Standalone 模式**，内置精简版 NodeJS Server 运行时，结合 React 19 和 Turbopack 构建。
- **App Router 核心路由拓扑**：
  - `/(app)/(main-app)/(opal)/today`: 核心 Today Feed（日程卡片、AI 每日建议、动态任务简报）。
  - `/(app)/(main-app)/(opal)/chat`: 智能对话主界面。
  - `/(app)/(main-app)/(opal)/memories`: 长期记忆库与音频笔记回放。
  - `/(app)/(main-app)/(opal)/connectors`: 设备连接器状态与授权面板。
  - `/(app)/(authenticated-chromeless)/browser-viewer`: 无边框浏览器自动化查看器。

### 8.2 TCK (Today Card Kit) 动态卡片微前端规范
Today AI 最具创新性的前端技术在于其 **Today Card Kit (`.tckb`) 动态卡片下发系统**（定义于 `packages/today-widget-runtime`）。

#### 1. `.tckb` 容器物理规范
每个 Widget 是一个以 SHA-384 Base64URL 命名的 ZIP 容器：
```
{hash}.tckb
 ├── manifest.json         # 卡片元信息、支持的尺寸（Compact/Full）、输入 Schema
 ├── widget.mjs            # 核心业务 ES Module 逻辑
 ├── widget.css            # 卡片布局样式
 ├── widget.properties.css # 动态设计变量（自适应 Opal 主题色）
 └── integrity.json        # 防篡改加密校验
```

#### 2. 动态加载与沙箱渲染流程
1. 云端向客户端推送包含 Widget 哈希引用的卡片数据流；
2. 前端请求内置 Next.js 路由：`GET /api/widgets/v1/{hash}/bundle.tckb`；
3. `today-widget-runtime` 拦截并解压 `.tckb` 包，验证 `integrity.json` 哈希指纹；
4. 动态载入 `widget.mjs`，并将其挂载在由 CSS 隔离属性包裹的 Shadow DOM / 动态容器内完成呈现；
5. **架构价值**：无需发布新版客户端安装包，服务端即可热更新全新的卡片交互、微图表和复杂展示组件。

---

## 九、总结与架构设计启示

Today AI 桌面端（`today-windows-x64.exe`）的设计代表了当前顶级 AI Agent 客户端工程的前沿水准：

1. **极致的安全性与进程隔离**：
   通过 **Windows 命名管道** 取代本地开放 TCP 端口，结合 256 位随机 Token 和严密的 Origin 检验，彻底根除了本地 Web 服务被浏览器页面跨站恶意调用的隐患。
2. **全栈异构分工的工程范式**：
   - **Next.js + React 19**：提供顶级的渲染表现力、微前端灵活性与极短白屏响应；
   - **Electron (Node.js)**：提供高效的窗口生命周期管理、协议拦截与长连接网络中继；
   - **.NET 10 / C#**：专门承担对操作系统底层的直接访问，隔离可能导致崩溃的 Win32 API / COM / UIA 调用。
3. **安全受控的端侧 Agent 闭环**：
   53 种原子能力在端侧具备独立清单、实时心跳、单次弹窗确认机制，云端 LLM 仅负责意图决策，执行过程牢固受控于本地鉴权沙箱。
