# Today AI 桌面客户端架构与源码逐模块逆向分析

**[ 简体中文 ](./README.md)** | [ English Version (README_EN.md) ](./README_EN.md)

---

## 目录
- [一、项目架构全景概览](#一项目架构全景概览)
- [二、目录与物理产物结构](#二目录与物理产物结构)
- [三、七大核心模块深入分析](#三七大核心模块深入分析)
  - [1. 模块一：桌面主进程与生命周期编排 (Electron Main & Lifecycle)](#1-模块一桌面主进程与生命周期编排-electron-main--lifecycle)
  - [2. 模块二：Web 运行时托管与 Windows 命名管道 IPC (Web Runtime Host)](#2-模块二web-运行时托管与-windows-命名管道-ipc-web-runtime-host)
  - [3. 模块三：三层 Bridge 接口契约体系 (WEI, SEI, CPI)](#3-模块三三层-bridge-接口契约体系-wei-sei-cpi)
  - [4. 模块四：Windows 原生宿主与 53 项本地 Agent 工具矩阵 (Platform Host & Native Tools)](#4-模块四windows-原生宿主与-53-项本地-agent-工具矩阵-platform-host--native-tools)
  - [5. 模块五：云端长连接与远程 Agent 任务调度 (Socket & Realtime Contract)](#5-模块五云端长连接与远程-agent-任务调度-socket--realtime-contract)
  - [6. 模块六：原生多窗口与悬浮 UI 体系 (Multi-Window & Floating Shell)](#6-模块六原生多窗口与悬浮-ui-体系-multi-window--floating-shell)
  - [7. 模块七：Next.js Standalone 与 TCK 动态卡片微前端引擎 (Frontend & TCK Engine)](#7-模块七nextjs-standalone-与-tck-动态卡片微前端引擎-frontend--tck-engine)
- [四、架构设计亮点与总结](#四架构设计亮点与总结)

---

## 一、项目架构全景概览

Today AI 桌面端并不是普通的单体 Electron Webview 包裹程序，而是由 **Electron 调度编排层**、**Next.js 独立 Web 服务层**、**C# (.NET Core) 操作系统能力宿主层** 构成的三层异构协同体系。

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

## 二、目录与物理产物结构

```
todayai-reserve-analyse/
├── .gitignore                                  # 忽略大型二进制包与依赖
├── README.md                                   # 项目全景架构白皮书
├── today-windows-x64-architecture-analysis.md  # 详细架构与代码分析报告
├── extracted_app/                              # 萃取的 app.asar (Electron 主进程与适配源码)
│   ├── package.json                            # 客户端配置 (today-desktop-cn, v1.21.6)
│   └── dist/
│       ├── app/
│       │   ├── main/index.js                   # 主进程入口
│       │   ├── app/index.js                    # 核心业务聚合与依赖注入容器
│       │   ├── consts/                         # 编译常量、API基地址与端配置
│       │   ├── modules/                        # 业务子模块 (Shell, 录音, 诊断, 认证)
│       │   └── web-runtime-host.cjs            # 运行于 utilityProcess 的 Next.js 引导宿主
│       ├── preload/desktop.cjs                 # 前端注入层 (暴露 WEI Facade)
│       └── pages/                              # 原生辅助窗口静态资源
│           ├── recording-capsule/              # 悬浮录音胶囊
│           ├── meeting-reminder/               # 会议提醒通知浮窗
│           ├── tool-permissions/               # 本地 Agent 工具执行授权窗
│           ├── loading-page/                   # 冷启动预热页面
│           └── error-page/                     # 崩溃容灾兜底页面
└── extracted_prod/                             # 萃取的 prod.asar (内嵌 Next.js 独立运行时)
    ├── apps/web/
    │   ├── server.js                           # Next.js 16.3.4 Standalone 生产服务入口
    │   ├── package.json                        # 前端依赖配置与微前端别名
    │   └── public/                             # 静态资源与资产
    └── packages/
        └── today-widget-runtime/               # TCK (Today Card Kit) 动态卡片微前端核心包
            └── src/testing/tckb/               # .tckb 卡片二进制包规范与测试基线
```

---

## 三、七大核心模块深入分析

### 1. 模块一：桌面主进程与生命周期编排 (Electron Main & Lifecycle)

#### 1.1 设计哲学与 IoC 容器
主进程基于 TypeScript 开发，采用 **InversifyJS** 控制反转容器进行组件装配。每个功能模块（如托盘、单实例锁、快捷键管理器、诊断记录器）被定义为独立的 `@injectable()` 服务，通过常量 Token 进行绑定注入。

#### 1.2 启动编排序列（Startup Diagnostics Pipeline）
主进程在 `DesktopMainApp.create()` 和 `launch()` 中，划分出 14 个确定性启动阶段：

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

#### 1.3 崩溃容灾恢复 (`DesktopStartupRecovery`)
在 `dist/app/main/index.js` 中：
```javascript
const main = async () => {
    const recovery = new DesktopStartupRecovery();
    try {
        const desktopApp = await DesktopMainApp.create({ ... });
        await desktopApp.launch();
    } catch (error) {
        if (process.argv.includes(DESKTOP_PROTOCOL_RESTORE_ARGUMENT)) {
            app.exit(1);
            return;
        }
        console.error('[desktop] startup failed');
        await recovery.show(error); // 独立容灾轻量窗口：允许清理缓存或上报日志
    }
};
main();
```

---

### 2. 模块二：Web 运行时托管与 Windows 命名管道 IPC (Web Runtime Host)

#### 2.1 命名管道隔离机制
为了杜绝传统 `127.0.0.1:3000` 端口暴露可能遭受的端口冲突、本地端口扫描以及浏览器跨站请求伪造（CSRF）问题，Today AI 在 Windows 环境下采用专有的 **Windows 命名管道（Named Pipe）**：
```typescript
// 摘自 dist/app/app/index.js:233526
if (process.platform === 'win32') {
    return `\\\\.\\pipe\\today-web-runtime-${(0, crypto.randomUUID)()}`;
}
```

#### 2.2 UtilityProcess 派生与 HTTP 创建拦截
主进程通过 Electron 现代化的高性能子进程 API `utilityProcess.fork` 拉起服务：
```typescript
const child = utilityProcess.fork(runtimeHostPath, [], {
    env: processEnvironment,
    serviceName: 'Today Web Runtime',
    stdio: 'pipe'
});
```
在 `web-runtime-host.cjs:48370` 中，宿主通过 Monkey-Patch 拦截了 Node.js 原生的 `http.createServer`：
```javascript
const guardedCreateServer = (...args) => {
    const server = originalCreateServer(...args);
    // 强制将 server.listen 绑定至 Windows 命名管道
    server.listen(endpointPath, () => {
        this.parentPort.postMessage({ type: 'listening', endpointPath });
    });
    return server;
};
http.createServer = guardedCreateServer;
```

#### 2.3 安全验证标头
Electron 拦截主视窗发往内置 Web 服务的每一个请求，动态注入：
- `x-today-desktop-runtime-token`：每次启动时随机生成的 256 位强校验令牌。
- `x-today-desktop-logical-origin`：逻辑来源域校验。
- `x-today-desktop-traffic-lane`：灰度流量泳道控制标头。

---

### 3. 模块三：三层 Bridge 接口契约体系 (WEI, SEI, CPI)

#### 3.1 WEI (Web Extended Interface)
- **位置**：`dist/preload/desktop.cjs`
- **挂载点**：`window.__DesktopWebExtendedAPI`
- **模块清单**：包含 24 个冻结的门面模块（Facade）：
  - `account`：登录、OAuth 流程、手机号验证码验证、多账号切换
  - `shell`：窗口尺寸平滑动画 (`animateSize`)、窗口激活/收起
  - `tools`：本地 Agent 工具清单枚举、正在运行的任务控制、取消任务
  - `permissions`：系统操作权限查询与决策操作
  - `record` & `audio`：会议录音控制、分贝电平监测 (`levelChanged`)、健康度上报
  - `fileCache`：大文件分块流式传输缓存

#### 3.2 SEI (System Extended Interface)
- **位置**：`dist/app/app/index.js`（`ClientNodeAdapter.sei`）
- **职责**：在 Node.js 主进程内部聚合会话状态，负责与本地 SQLite / 配置文件同步用户凭证、流量偏好和文件缓存。

#### 3.3 CPI (Cross Platform Interface)
- **位置**：`CrossPlatformRpc`
- **协议**：遵循标准 **JSON-RPC 2.0 (NDJSON)** 协议，通过 Stdin/Stdout 双向流直接驱动底层 C# 宿主。

---

### 4. 模块四：Windows 原生宿主与 53 项本地 Agent 工具矩阵 (Platform Host & Native Tools)

#### 4.1 C# 原生宿主特征
- **二进制文件**：`TodayWindowsPlatformHost.exe`（38MB）
- **技术结构**：采用 **.NET 10 / CoreCLR Single-File Bundle** 编译，包含 `.CLR_UEF` 与调试信息节区。
- **保护边界**：
  - 单条 NDJSON 消息缓冲上限：`32MB`
  - 单行日志截断上限：`8KB`
  - 具备 6 秒优雅退出与 1 秒强制终止控制。

#### 4.2 15 大连接器与 53 项系统原子能力清单 (`DESKTOP_CONNECTOR_CAPABILITIES`)
代码中完整注册了如下 Windows 系统原子能力（Capability IDs）：

| 连接器类别 (Connector) | 具备的原子能力 (Capability IDs) | 实际功能描述 |
| :--- | :--- | :--- |
| **文件系统类**<br>`windows_desktop`<br>`windows_documents`<br>`windows_downloads`<br>`windows_other_files` | `fs.read`<br>`fs.list`<br>`fs.stat` | 访问桌面、我的文档、下载文件夹及受限外部路径，实现文件索引、大纲提取和内容读取。 |
| **屏幕与视觉识别**<br>`windows_screen` | `screen.capture`<br>`screen.get`<br>`screen.elements.find` | 桌面截屏多显示器抓取，调用 Windows 原生 UI Automation 识别屏幕控件与文本。 |
| **GUI Agent 自动化**<br>`windows_ghost` | `ghost.context`<br>`ghost.click` | “幽灵模式”桌面 Agent 自动化，基于坐标和控件进行自动点击与键鼠操作。 |
| **系统控制台与脚本**<br>`windows_shell` | `script.shell` | 在安全沙箱边界内执行 PowerShell / CMD 脚本与系统查询。 |
| **系统与硬件信息**<br>`windows_system`<br>`windows_device`<br>`windows_battery` | `system.get`<br>`system.apps.list`<br>`battery.get` | 获取已安装应用程序列表、电池状态、系统硬件配置信息。 |
| **个人信息与办公套件**<br>`windows_calendar`<br>`windows_contacts`<br>`windows_reminders`<br>`windows_notes`<br>`windows_mail`<br>`windows_outlook` | `calendar.events.list`<br>`contacts.list / get`<br>`reminders.create / list`<br>`notes.list / get`<br>`mail.messages.list` | 深度集成 Windows 邮件、联系人、便签、日历以及本地 Microsoft Outlook。 |
| **剪贴板控制**<br>`windows_clipboard` | `clipboard.read`<br>`clipboard.write` | 剪贴板文本与富文本读写。 |
| **地理位置感知**<br>`windows_location` | `location.get` | 基于 Windows Location API 获取当前粗略/精细地理位置。 |

#### 4.3 `today-windows-foreground.node` C++ 插件
通过调用 Win32 原生 API `AllowSetForegroundWindow(processId)`，穿透 Windows 防弹窗抢占限制，使悬浮胶囊和全局快捷键呼出的交互窗口瞬间获取输入光标。

---

### 5. 模块五：云端长连接与远程 Agent 任务调度 (Socket & Realtime Contract)

端侧维护一条直连 `api.todayai.cn` 的 WebSocket 链路。当云端大模型 Agent 需要操作本地电脑时：

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

#### 关键实现代码 (`client-node-adapter/.../modules/socket/modules/native-tools/index.ts:203440`)
```typescript
async route(message) {
    switch (message['type']) {
        case 'invocation.request': {
            const invocationId = message['invocationId'];
            const request = toNativeToolInvocationRequest(message);
            // 1. 严格检查调用上下文与授权作用域
            this.authorization.assertCurrentScope(invocation.scope);
            // 2. 保持 15s 一次的长任务进度心跳，避免 LLM 超时断开
            this.startProgress(invocationId, running);
            // 3. 经由 CPI 协议调度本地 C# 进程执行
            const result = await this.cpi.tools.startTask(request);
            // 4. 将结构化结果回传云端
            this.client?.sendInvocationResult?.({ invocationId, result });
            return true;
        }
    }
}
```

---

### 6. 模块六：原生多窗口与悬浮 UI 体系 (Multi-Window & Floating Shell)

主进程基于轻量级 HTML/CSS/Preload 实现了一批独立的原生窗口（位于 `dist/pages/`）：
1. **悬浮录音胶囊 (`recording-capsule`)**：无边框置顶透明浮窗，实时由原生音频电平推送驱动波形展示。
2. **会议通知浮窗 (`meeting-reminder`)**：右下角平滑弹出的会议提醒，支持一键“立即开启录音并生成 AI 纪要”。
3. **权限确认窗口 (`tool-permissions`)**：高危系统操作（如脚本运行、批量文件提取）由原生弹窗向用户请求单次或永久授权。

---

### 7. 模块七：Next.js Standalone 与 TCK 动态卡片微前端引擎 (Frontend & TCK Engine)

#### 7.1 前端业务拓扑
- **技术栈**：Next.js 16.3.4 (App Router) + React 19 + Turbopack + Radix UI + Tailwind CSS。
- **App Router 核心页面**：
  - `/(app)/(main-app)/(opal)/today`：核心 Today Feed（日程卡片、AI 每日建议、动态任务简报）。
  - `/(app)/(main-app)/(opal)/chat`：智能对话主界面。
  - `/(app)/(main-app)/(opal)/memories`：长期记忆库与音频笔记回放。
  - `/(app)/(main-app)/(opal)/connectors`：设备连接器状态与授权面板。
  - `/(app)/(authenticated-chromeless)/browser-viewer`：内嵌浏览器自动化查看器。

#### 7.2 TCK (Today Card Kit) 动态卡片微前端规范
Today AI 最具创新性的前端技术在于其 **Today Card Kit (`.tckb`) 动态卡片下发系统**（定义于 `packages/today-widget-runtime`）。

##### `.tckb` 容器物理规范
每个 Widget 是一个以 SHA-384 Base64URL 命名的 ZIP 容器：
```
{hash}.tckb
 ├── manifest.json         # 卡片声明、展示尺寸约束、入参定义
 ├── widget.mjs            # 核心业务 ES Module 逻辑 
 ├── widget.css            # 卡片布局样式
 ├── widget.properties.css # 动态设计变量（自适应 Opal 主题色）
 └── integrity.json        # 防篡改加密校验
```

##### 动态加载与沙箱渲染流程
1. 云端向客户端推送包含 Widget 哈希引用的卡片数据流；
2. 前端请求内置 Next.js 路由：`GET /api/widgets/v1/{hash}/bundle.tckb`；
3. `today-widget-runtime` 拦截并解压 `.tckb` 包，验证 `integrity.json` 哈希指纹；
4. 动态载入 `widget.mjs`，并将其挂载在由 CSS 隔离属性包裹的 Shadow DOM / 动态容器内完成呈现；
5. **架构价值**：无需发布新版客户端安装包，服务端即可热更新全新的卡片交互、微图表和复杂展示组件。

---

## 四、架构设计亮点与总结

Today AI 桌面端（`today-windows-x64.exe`）的设计代表了当前顶级 AI Agent 客户端工程的前沿水准：

1. **极致的安全性与进程隔离**：
   通过 **Windows 命名管道** 取代本地开放 TCP 端口，结合 256 位随机 Token 和严密的 Origin 检验，彻底根除了本地 Web 服务被浏览器页面跨站恶意调用的隐患。
2. **全栈异构分工的工程范式**：
   - **Next.js + React 19**：提供顶级的渲染表现力、微前端灵活性与极短白屏响应；
   - **Electron (Node.js)**：提供高效的窗口生命周期管理、协议拦截与长连接网络中继；
   - **.NET 10 / C#**：专门承担对操作系统底层的直接访问，隔离可能导致崩溃的 Win32 API / COM / UIA 调用。
3. **安全受控的端侧 Agent 闭环**：
   53 种原子能力在端侧具备独立清单、实时心跳、单次弹窗确认机制，云端 LLM 仅负责意图决策，执行过程牢固受控于本地鉴权沙箱。
