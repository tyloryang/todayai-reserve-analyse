# Today AI Desktop Architecture & Source Code Reverse Engineering Analysis

[ 简体中文 (README.md) ](./README.md) | **[ English Version ](./README_EN.md)**

---

This repository provides an in-depth reverse engineering and architectural analysis of the official **Today AI** Windows desktop client installer (`today-windows-x64.exe`, version `1.21.6.0`).

---

## Table of Contents
- [1. Architectural Overview & Topology](#1-architectural-overview--topology)
- [2. Physical Artifact Layout](#2-physical-artifact-layout)
- [3. Deep Dive into Seven Core Modules](#3-deep-dive-into-seven-core-modules)
  - [Module 1: Main Process & Lifecycle Orchestration (Electron Main & Lifecycle)](#module-1-main-process--lifecycle-orchestration-electron-main--lifecycle)
  - [Module 2: Web Runtime Host & Windows Named Pipe IPC](#module-2-web-runtime-host--windows-named-pipe-ipc)
  - [Module 3: Three-Tier Bridge Interface Architecture (WEI, SEI, CPI)](#module-3-three-tier-bridge-interface-architecture-wei-sei-cpi)
  - [Module 4: Windows Native Platform Host & 53 Native Agent Tools Matrix](#module-4-windows-native-platform-host--53-native-agent-tools-matrix)
  - [Module 5: Cloud Realtime Socket & Remote Agent Task Dispatcher](#module-5-cloud-realtime-socket--remote-agent-task-dispatcher)
  - [Module 6: Multi-Window & Floating Shell System](#module-6-multi-window--floating-shell-system)
  - [Module 7: Standalone Next.js & TCK Dynamic Widget Microfrontend Engine](#module-7-standalone-nextjs--tck-dynamic-widget-microfrontend-engine)
- [4. End-to-End User Request Data Flow](#4-end-to-end-user-request-data-flow)
- [5. Architectural Highlights & Key Takeaways](#5-architectural-highlights--key-takeaways)

---

## 1. Architectural Overview & Topology

Today AI Desktop is not a conventional single-process Electron wrapper. Instead, it employs a **three-tier heterogeneous runtime architecture** consisting of:
1. **Electron Main Orchestration Layer** (`Node.js`),
2. **Embedded Standalone Next.js Web Server** (`React 19 + Turbopack`),
3. **C# (.NET Core) Native Operating System Host** (`TodayWindowsPlatformHost.exe`).

```
+-----------------------------------------------------------------------------------------+
|                                Today AI Cloud Backend                                   |
|                      (api.todayai.cn / api.today.ai - LLM Brain)                        |
+-----------------------------------------------------------------------------------------+
                                             ▲
                                             │ Bidirectional WSS (realtime-contract)
                                             │ [State Sync / Offline Messages / Agent invocation.request]
                                             ▼
+=========================================================================================+
|                          Electron Main Process (Node.js Runtime)                        |
|                                                                                         |
|  [DesktopMainApp] (Lifecycle Orchestration / Single-Instance / Deep Links / Diagnostics)|
|                                                                                         |
|  [ClientNodeAdapter]                                                                    |
|   ├── SEI (System Extended Interface): Cookie Mirror / Session / Auth / File Cache       |
|   ├── SocketNativeTools: Remote Tool Interception, Safety Gate & Dispatcher             |
|   └── ToolCatalogSync: Dynamic Registration of 53 Local Native Agent Tools              |
|                                                                                         |
|  [DesktopWebRuntime]                                                                    |
|   └── utilityProcess.fork(web-runtime-host.cjs)                                         |
+=========================================================================================+
            │                                                           │
            │ Windows Named Pipe (HTTP over IPC)                        │ Stdin/Stdout (JSON-RPC 2.0)
            │ \\.\pipe\today-web-runtime-${UUID}                        │ (CrossPlatformRpc / CPI)
            ▼                                                           ▼
+-----------------------------------------+   +-------------------------------------------+
|      Embedded Next.js Standalone        |   |       TodayWindowsPlatformHost.exe        |
|   (resources/web-runtimes/prod.asar)    |   |     (resources/tools/windows/ - .NET)     |
|                                         |   |                                           |
|  [Next.js 16.3.4 (React 19 + Turbopack)]|   |  [53 Windows OS-Level Atomic Capabilities]|
|   ├── /today, /chat (Primary App)       |   |   ├── fs: Desktop/Docs/Downloads I/O      |
|   ├── /calendar, /tasks, /routines      |   |   ├── screen: Screenshot / UIA Elements   |
|   ├── /memories, /health, /connectors   |   |   ├── ghost: OS Automation Click / Type   |
|   └── TCK Widget Microfrontends (.tckb) |   |   ├── mail / outlook / contacts / notes   |
+-----------------------------------------+   |   ├── shell: Restricted Script Execution  |
            │ Rendering & IPC Channel         |   └── audio: High-Fidelity Recording & VU |
            ▼                                 +-------------------------------------------+
+-----------------------------------------+                 ▲
|       Electron Renderer (BrowserWindow) |                 │ Win32 API Injection
|                                         |                 │ AllowSetForegroundWindow
|  [Preload Layer] (desktop.cjs)          |                 ▼
|   └── window.__DesktopWebExtendedAPI    |   +-------------------------------------------+
|        (WEI: Web Extended Interface)    |   |       today-windows-foreground.node       |
|                                         |   |        (Native C++ Node Addon Focus Lock) |
|  [Native Auxiliary Floating Windows]:   |   +-------------------------------------------+
|   ├── recording-capsule (Audio Capsule) |
|   ├── meeting-reminder (Meeting Alert)  |
|   └── tool-permissions (Agent Auth Pop) |
+-----------------------------------------+
```

---

## 2. Physical Artifact Layout

```
todayai-reserve-analyse/
├── .gitignore                                  # Ignores >100MB installers and heavy dependencies
├── README.md                                   # Chinese Technical Documentation
├── README_EN.md                                # English Technical Documentation
├── today-windows-x64-architecture-analysis.md  # Exhaustive Analysis Report
├── extracted_app/                              # Unpacked app.asar (Main Process & Preload source)
│   ├── package.json                            # Package config (today-desktop-cn, v1.21.6)
│   └── dist/
│       ├── app/
│       │   ├── main/index.js                   # Main process entry point
│       │   ├── app/index.js                    # Inversify IoC container & core bootstrap
│       │   ├── consts/                         # Build consts, API URLs, and endpoint profiles
│       │   ├── modules/                        # Submodules (Shell, Audio, Diagnostics, Auth)
│       │   └── web-runtime-host.cjs            # Next.js bootstrap script in utilityProcess
│       ├── preload/desktop.cjs                 # Preload bridge (exposes WEI Facade)
│       └── pages/                              # Native auxiliary window assets
│           ├── recording-capsule/              # Floating recording pill window
│           ├── meeting-reminder/               # Meeting notification window
│           ├── tool-permissions/               # Local Agent execution approval dialog
│           ├── loading-page/                   # Cold-boot splash screen
│           └── error-page/                     # Crash recovery fallback page
└── extracted_prod/                             # Unpacked prod.asar (Embedded Next.js Runtime)
    ├── apps/web/
    │   ├── server.js                           # Next.js 16.3.4 Standalone production server
    │   ├── package.json                        # Frontend dependencies & monorepo aliases
    │   └── public/                             # Static assets & brand media
    └── packages/
        └── today-widget-runtime/               # TCK (Today Card Kit) microfrontend runtime
            └── src/testing/tckb/               # .tckb dynamic widget package specification
```

---

## 3. Deep Dive into Seven Core Modules

### Module 1: Main Process & Lifecycle Orchestration (Electron Main & Lifecycle)

#### 1.1 InversifyJS Dependency Injection Architecture
The main process is written in TypeScript and compiled into `extracted_app/dist/app/app/index.js`. It extensively relies on **InversifyJS** to achieve modular decoupling across operating systems (Win32, macOS, Linux). Services like single-instance locking, tray icon management, shortcut listening, and protocol registration are declared via `@injectable()` and bound in a central IoC container.

#### 1.2 Deterministic 14-Stage Startup Pipeline
`DesktopMainApp.create()` and `launch()` track startup progress using an internal `StartupDiagnostics` state machine:

```
[enter] data_reset 
   │  --> Detects if user requested a data reset; wipes disk & session state
[enter] network_inspection
   │  --> Inspects system PAC / SOCKS5 / HTTP proxies for Node and Chromium
[enter] features_prepare
   │  --> Loads persistent local feature flags (featureIds)
[enter] preflight
   │  --> Validates integrity of required resources (preload.cjs, loading-page, etc.)
[enter] protocol_recover & protocol_prepare
   │  --> Registers OS URI schemes: today-connector:// and today://
[enter] native_host_start
   │  --> Spawns C# native backend process TodayWindowsPlatformHost.exe
[enter] adapter_create
   │  --> Initializes ClientNodeAdapter binding CPI, SEI, and WEI
[enter] shell_prepare & shell_ready & shell_launch
   │  --> Creates Electron BrowserWindow, tray menu, and global shortcuts
[enter] web_runtime
   │  --> Sets up Windows Named Pipe and boots Next.js Standalone process
[enter] shell_open
   │  --> BrowserWindow navigates to local WebRuntime pipe, eliminating white flash
[enter] launched
   │  --> Fires launch success telemetry to cloud observability endpoints
```

#### 1.3 Automatic Crash Recovery (`DesktopStartupRecovery`)
In `dist/app/main/index.js`:
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
        await recovery.show(error); // Shows an isolated, lightweight fallback dialog
    }
};
main();
```

---

### Module 2: Web Runtime Host & Windows Named Pipe IPC

#### 2.1 The Named Pipe Security Paradigm
Binding an embedded web server to `http://127.0.0.1:3000` is susceptible to port collisions, local port scanning, and Cross-Site Request Forgery (CSRF). 

Today AI eliminates this attack surface by utilizing a **Windows Named Pipe**:
```typescript
// Extracted from dist/app/app/index.js:233526
if (process.platform === 'win32') {
    return `\\\\.\\pipe\\today-web-runtime-${(0, crypto.randomUUID)()}`;
}
```

#### 2.2 UtilityProcess & Monkey-Patched `http.createServer`
The main process uses Electron's modern `utilityProcess.fork` to launch `dist/app/web-runtime-host.cjs`:
```typescript
const child = utilityProcess.fork(runtimeHostPath, [], {
    env: processEnvironment,
    serviceName: 'Today Web Runtime',
    stdio: 'pipe'
});
```

In `web-runtime-host.cjs:48370`, Node's built-in `http.createServer` is dynamically monkey-patched:
```javascript
const guardedCreateServer = (...args) => {
    const server = originalCreateServer(...args);
    // Forces Next.js server to listen on the Windows Named Pipe instead of a TCP port
    server.listen(endpointPath, () => {
        this.parentPort.postMessage({ type: 'listening', endpointPath });
    });
    return server;
};
http.createServer = guardedCreateServer;
```

#### 2.3 Cryptographic Security Request Headers
All requests routed from Electron to the Next.js standalone runtime carry mandatory security headers:
- `x-today-desktop-runtime-token`: A 256-bit cryptographic ephemeral token generated upon launch.
- `x-today-desktop-logical-origin`: Validates that the request origin matches the client's registered base domain.
- `x-today-desktop-traffic-lane`: Specifies gray-release deployment routing.

---

### Module 3: Three-Tier Bridge Interface Architecture (WEI, SEI, CPI)

```
+--------------------------------------------------------------------------------+
| Web Frontend (Next.js / React 19)                                              |
+--------------------------------------------------------------------------------+
       ▲
       │ WEI (Web Extended Interface) - 24 Frozen Facade Modules on window
       ▼
+--------------------------------------------------------------------------------+
| Preload Isolation Boundary (desktop.cjs)                                       |
+--------------------------------------------------------------------------------+
       ▲
       │ Electron IPC (ipcRenderer.invoke <--> ipcMain.handle)
       ▼
+--------------------------------------------------------------------------------+
| Node.js Main Process (ClientNodeAdapter)                                       |
|  └── SEI (System Extended Interface): Cookie Mirror / Cache / Auth / Network   |
+--------------------------------------------------------------------------------+
       ▲
       │ CPI (Cross Platform Interface) - JSON-RPC 2.0 (NDJSON) over Stdin/Stdout
       ▼
+--------------------------------------------------------------------------------+
| Native C# Host (.NET Core / TodayWindowsPlatformHost.exe)                       |
+--------------------------------------------------------------------------------+
```

#### 3.1 WEI (Web Extended Interface) Modules
Exposed globally via `window.__DesktopWebExtendedAPI`:

| Module | Core Methods | Event Listeners | Functional Role |
| :--- | :--- | :--- | :--- |
| **`runtime`** | `getRuntimeInfo` | - | Client version, commit hash, build identity |
| **`account`** | `signInWithOAuth`, `requestPhoneCode`, `verifyPhoneCode`, `switchAccount`, `signOut` | `changed`, `afterSignIn`, `afterSwitch` | Auth state synchronization & multi-account switching |
| **`shell`** | `getForegroundState`, `activate`, `dismiss`, `setSize`, `animateSize` | `foregroundChanged`, `deepLinkRequested` | Window resize animation, focus handling |
| **`tools`** | `listTools`, `getToolInfo`, `getRunningTasks`, `startTask`, `cancelTask` | `catalogChanged`, `taskChanged` | Local Agent tool execution and tracking |
| **`permissions`**| `listPermissions`, `getPermissionInfo`, `performPermissionAction` | - | User consent decision gate for system access |
| **`record`** | `getState`, `start`, `setPaused`, `stop`, `retry`, `exportAudio` | `stateChanged` | Meeting audio recording session lifecycle |
| **`audio`** | `startCapture`, `stopCapture` | `segmentCompleted`, `levelChanged`, `healthChanged` | Low-latency audio chunks and real-time VU meter levels |
| **`fileCache`** | `open`, `read`, `beginWrite`, `writeChunk`, `commitWrite` | - | Streaming chunked local cache for large chat files |
| **`socket`** | `getSocketState`, `forceSync`, `receive` | `stateChange`, `notificationActivated` | Passthrough WebSocket control & status |
| **`system`** | `getSystemInfo`, `getDeviceInfo`, `setPreventSleepWhileRunning` | - | Hardware inspection & OS sleep prevention |

#### 3.2 CPI (Cross Platform Interface)
The CPI contract defines communication with the C# native backend using `CrossPlatformRpc`. It guarantees typed RPC calls (`sendRequest`) and validates returned JSON schemas via `assertWireResult`.

---

### Module 4: Windows Native Platform Host & 53 Native Agent Tools Matrix

#### 4.1 C# (.NET Core) Native Executable Profile
- **File**: `TodayWindowsPlatformHost.exe` (38MB)
- **Runtime**: Compiled using **.NET 10 / CoreCLR Single-File Bundle**, containing `.CLR_UEF`, embedded metadata, and CoreCLR runtime DLLs.
- **IPC Invariants**:
  - Maximum NDJSON message buffer: `32MB` (`PLATFORM_HOST_MAX_MESSAGE_BYTES`)
  - Stderr line truncation limit: `8KB`
  - Graceful exit deadline: 6000ms, followed by 1000ms force kill.

#### 4.2 15 Connectors & 53 Atomic Capability Matrix
Declared in `DESKTOP_CONNECTOR_CAPABILITIES`:

| Connector | Capability IDs | Capabilities & Operations |
| :--- | :--- | :--- |
| **File Systems**<br>`windows_desktop`<br>`windows_documents`<br>`windows_downloads`<br>`windows_other_files` | `fs.read`<br>`fs.list`<br>`fs.stat` | Traverses directories, inspects metadata, reads contents of desktop/documents/downloads and user-approved paths. |
| **Screen & UI Automation**<br>`windows_screen` | `screen.capture`<br>`screen.get`<br>`screen.elements.find` | Multi-monitor screenshot capture; inspects Windows UI Automation (UIA) tree for on-screen controls and text. |
| **Ghost UI Automation**<br>`windows_ghost` | `ghost.context`<br>`ghost.click` | Autonomous GUI Agent: acquires active window context and executes synthetic mouse clicks, scrolls, and keystrokes. |
| **System Shell**<br>`windows_shell` | `script.shell` | Executes PowerShell / CMD scripts in a sandboxed, restricted working directory. |
| **Hardware & Apps**<br>`windows_system`<br>`windows_device`<br>`windows_battery` | `system.get`<br>`system.apps.list`<br>`battery.get` | Enumerates installed software, hardware metrics, battery status, and device identity. |
| **Productivity & Outlook**<br>`windows_calendar`<br>`windows_contacts`<br>`windows_reminders`<br>`windows_notes`<br>`windows_mail`<br>`windows_outlook` | `calendar.events.list`<br>`contacts.list / get`<br>`reminders.create / list`<br>`notes.list / get`<br>`mail.messages.list` | Connects to Windows PIM APIs and native Microsoft Outlook COM interfaces to read emails, calendars, and reminders. |
| **Clipboard**<br>`windows_clipboard` | `clipboard.read`<br>`clipboard.write` | Monitors and reads/writes clipboard text and image streams. |
| **Location**<br>`windows_location` | `location.get` | Reads geographic coordinates via the Win32 Location API. |

#### 4.3 Native Window Focus Piercing (`today-windows-foreground.node`)
Windows prevents background apps from stealing foreground focus (`LockSetForegroundWindow`). Today AI ships a native C++ addon:
```typescript
// Extracted from dist/app/app/index.js:230550
class WindowsStatusMenuForeground {
    grant(processId) {
        // Calls Win32 API: AllowSetForegroundWindow(processId)
        if (!this.binding.allowSetForegroundWindow(processId)) {
            throw new Error('Windows did not allow the status menu host to acquire foreground focus.');
        }
    }
}
```
This guarantees that floating capsules and QuickChat inputs immediately receive keyboard focus without requiring an extra mouse click.

---

### Module 5: Cloud Realtime Socket & Remote Agent Task Dispatcher

#### 5.1 Remote Tool Invocation Flow
The client maintains a continuous WebSocket session with `api.todayai.cn`:

```
[Cloud LLM Agent]                   [SocketNativeTools]           [CPI / C# Platform Host]
       │                                   │                                 │
       │  1. invocation.request            │                                 │
       │──────────────────────────────────>│                                 │
       │                                   │ 2. Validate scope & permissions │
       │                                   │    assertCurrentScope()         │
       │  3. invocation.progress (every 15s│                                 │
       │<──────────────────────────────────│                                 │
       │                                   │ 4. Dispatch tool task via CPI   │
       │                                   │────────────────────────────────>│
       │                                   │                                 │ 5. Execute OS syscall
       │                                   │                                 │    (Screen capture / FS)
       │                                   │ 6. Return NDJSON execution data │
       │                                   │<────────────────────────────────│
       │  7. invocation.result             │                                 │
       │<──────────────────────────────────│                                 │
       │                                   │                                 │
[LLM aggregates result and continues conversation]
```

#### 5.2 Implementation Details (`native-tools/index.ts:203440`)
```typescript
async route(message) {
    switch (message['type']) {
        case 'invocation.request': {
            const invocationId = message['invocationId'];
            const request = toNativeToolInvocationRequest(message);
            // 1. Strict scope & authorization validation
            this.authorization.assertCurrentScope(invocation.scope);
            // 2. Transmit 15-second heartbeats to prevent cloud timeout
            this.startProgress(invocationId, running);
            // 3. Dispatch to C# Platform Host via CPI
            const result = await this.cpi.tools.startTask(request);
            // 4. Return result envelope to cloud
            this.client?.sendInvocationResult?.({ invocationId, result });
            return true;
        }
    }
}
```

---

### Module 6: Multi-Window & Floating Shell System

In addition to the primary BrowserWindow, the main process hosts several lightweight, frameless utility windows (`dist/pages/`):
1. **Recording Pill Capsule (`recording-capsule`)**: Frameless, transparent, always-on-top floating pill. Animates real-time audio waveforms driven by native `cpi.audio.levelChanged` events.
2. **Meeting Notification Dialog (`meeting-reminder`)**: Smoothly slides into view when a calendar meeting approaches, offering one-click AI note generation.
3. **Agent Authorization Window (`tool-permissions`)**: Intercepts privileged operations (shell execution, bulk file exports) and prompts user consent before execution.

---

### Module 7: Standalone Next.js & TCK Dynamic Widget Microfrontend Engine

#### 7.1 Next.js 16.3.4 Standalone Architecture
The frontend in `extracted_prod/apps/web/` runs in Next.js Standalone mode with React 19:
- `/(app)/(main-app)/(opal)/today`: Personalized Today Feed (daily briefs, schedules, dynamic AI widgets).
- `/(app)/(main-app)/(opal)/chat`: Multimodal AI conversation interface.
- `/(app)/(main-app)/(opal)/memories`: Long-term memory retrieval and meeting transcript playback.
- `/(app)/(main-app)/(opal)/connectors`: Local device connector management.

#### 7.2 TCK (Today Card Kit) Dynamic Microfrontend Engine
TCK (`packages/today-widget-runtime`) is a proprietary dynamic widget framework:

##### `.tckb` Physical Container Format
Every widget bundle is packaged as a `.tckb` ZIP archive, identified by a SHA-384 base64url hash:
```
{hash}.tckb
 ├── manifest.json         # Widget schema, dimensions (Compact/Full), inputs
 ├── widget.mjs            # ES Module component logic
 ├── widget.css            # Scoped widget styling
 ├── widget.properties.css # Adaptive theme tokens (Opal Design System)
 └── integrity.json        # SHA-384 cryptographic integrity manifest
```

##### Dynamic Hot-Loading Lifecycle
1. Cloud pushes feed data containing `{ bundleHash }`;
2. Client queries internal Next.js route: `GET /api/widgets/v1/{hash}/bundle.tckb`;
3. `today-widget-runtime` unpacks the `.tckb` archive and verifies checksums against `integrity.json`;
4. Mounts `widget.mjs` inside an isolated Shadow DOM container;
5. **Architectural Value**: Entirely eliminates the need to push client-side app updates when releasing new AI widgets (stock charts, weather radars, habit trackers).

---

## 4. End-to-End User Request Data Flow

### 4.1 Scenario 1: Standard Chat & Streaming Inference Flow

When a user submits a prompt in the conversation interface (e.g., *"Summarize my core agenda for today"*):

```
[React 19 Frontend UI]
       │
       │ 1. fetch('/api/cloud/v1/chat/completions', { method: 'POST', body })
       ▼
[Windows Named Pipe (\\.\pipe\today-web-runtime-${UUID})]
       │
       │ 2. DesktopWebRuntimeCookieBridge intercepts request
       │    Calls sei.account.getFreshAuthContext() for short-lived JWT
       │    Injects header Authorization: Bearer <AccessToken>
       ▼
[Internal Next.js Standalone Server (server.js)]
       │
       │ 3. Reverse-proxies via _originalRewrites rule:
       │    /api/cloud/:path*  ──►  https://api.todayai.cn/:path*
       ▼
[Today AI Cloud Gateway & LLM Cluster (api.todayai.cn)]
       │
       │ 4. LLM parses intent and streams generated tokens
       │    via Server-Sent Events (SSE) back to client
       ▼
[Frontend Incremental Rendering] (Driven by Virtual DOM typing effect)
```

---

### 4.2 Scenario 2: Agentic Local Tool Execution Closed Loop

When a user triggers an action requiring local OS privilege (e.g., *"Find the contracts on my desktop and take a screenshot"*):

```
+----------------------------------------------------------------------------------------------------+
| Step 1: Cloud Emits Tool Invocation Request                                                        |
| The Cloud LLM selects fs.list and screen.capture from the registered 53 tools and pushes via WSS:  |
+----------------------------------------------------------------------------------------------------+
       │
       │ WebSocket: { "type": "invocation.request", "invocationId": "inv_8f7b...", "capabilityId": "fs.list", "arguments": { "path": "desktop" } }
       ▼
+----------------------------------------------------------------------------------------------------+
| Step 2: Client Security Gateway Interception (SocketNativeTools.route)                             |
| 1. Compute execution deadline: budgetMs = Math.min(300000, request.timeoutMs ?? 30000)            |
| 2. Scope & Permission assertion: await this.authorization.isInvocationAuthorized(capId, args)      |
| 3. If unapproved or privileged, opens native tool-permissions dialog for explicit user consent     |
| 4. Heartbeat: sends sendProgress(invocationId) every 15s to keep LLM connection alive              |
+----------------------------------------------------------------------------------------------------+
       │
       │ CPI Serialization: JSON-RPC 2.0 (NDJSON) over Stdin
       ▼
+----------------------------------------------------------------------------------------------------+
| Step 3: Cross-Process Execution in C# Host (TodayWindowsPlatformHost.exe)                          |
| 1. Stdin receives: nei.tools.invocationRequested                                                   |
| 2. C# host breaks out of Chromium sandbox, executing Win32 file traversal directly                 |
| 3. For screen.capture, invokes Desktop Duplication API (DXGI) for multi-monitor frame grab         |
+----------------------------------------------------------------------------------------------------+
       │
       │ C# host writes response to Stdout in NDJSON:
       │ { "jsonrpc": "2.0", "method": "nei.tools.completeInvocation", "params": { "invocationId": "inv_8f7b...", "success": true, "data": { ... } } }
       ▼
+----------------------------------------------------------------------------------------------------+
| Step 4: Main Process Result Collection & Local Event Dispatch                                      |
| 1. completeInvocation validates result consistency                                                 |
| 2. nativeToolCompletions.emit('completed', result) triggers instant local sync without debouncing  |
| 3. Sends execution result back to cloud via WebSocket: { "type": "invocation.result", ... }       |
+----------------------------------------------------------------------------------------------------+
       │
       │ WebSocket transmission to Cloud LLM
       ▼
+----------------------------------------------------------------------------------------------------+
| Step 5: Cloud Second-Pass Inference & TCK Dynamic Widget Dispatch                                  |
| LLM ingests local tool output into context, generates final answer, and outputs a dynamic card ref |
| { "message": "I found 3 contracts on your desktop...", "widget": { "bundleHash": "contract_v1" } }  |
+----------------------------------------------------------------------------------------------------+
       │
       │ Frontend receives widget reference
       ▼
+----------------------------------------------------------------------------------------------------+
| Step 6: TCK Dynamic Microfrontend Unpack & Render                                                  |
| 1. Frontend requests: GET /api/widgets/v1/contract_v1/bundle.tckb                                  |
| 2. today-widget-runtime unpacks .tckb ZIP archive and verifies cryptographic integrity.json        |
| 3. Mounts widget.mjs inside Shadow DOM sandbox, presenting an interactive custom UI card           |
+----------------------------------------------------------------------------------------------------+
```

---

### 4.3 Scenario 3: Real-Time Audio Capture & Meeting Note Generation

When a user initiates a voice query or starts meeting transcription:

```
[Floating Recording Capsule UI / Main App]
       │
       │ 1. Invokes WEI API: window.__DesktopWebExtendedAPI.record.start()
       ▼
[Preload (desktop.cjs) ➔ IPC Main]
       │
       │ 2. Dispatches CPI: cpi.audio.startCapture({ sampleRate: 16000, channels: 1 })
       ▼
[TodayWindowsPlatformHost.exe (.NET Host)]
       │
       │ 3. Opens exclusive Windows CoreAudio / WASAPI input stream with acoustic echo cancellation
       │
       ├──► 4. Real-time VU Levels (every 50ms):
       │       Emits cpi.audio.levelChanged({ level: 0.78 }) ➔ Broadcasts to recording-capsule UI
       │
       └──► 5. Audio Chunk Stream (every 30s):
               Emits cpi.audio.segmentCompleted({ segmentId, buffer, durationMs })
               ➔ Node main process uploads chunks in streams to cloud ASR/Whisper pipeline
```

---

## 5. Architectural Highlights & Key Takeaways

1. **Security & Process Isolation by Default**:
   Using **Windows Named Pipes** instead of open localhost TCP ports, paired with 256-bit ephemeral tokens and strict origin checks, completely eliminates CSRF and port-scanning vulnerabilities.
2. **Full-Stack Heterogeneous Separation of Concerns**:
   - **Next.js & React 19**: Delivers high-performance UI rendering, dynamic microfrontends, and rapid cold-boot times;
   - **Electron (Node.js)**: Orchestrates window lifecycles, global hotkeys, and WebSocket networking;
   - **.NET 10 (C#)**: Isolate fragile or crash-prone Win32/COM/UIA OS system calls from the main JavaScript process.
3. **Secure Local-First AI Agent Pipeline**:
   The cloud LLM functions strictly as a reasoning engine, while 53 local capabilities execute inside a deterministic, permission-gated client runtime.
