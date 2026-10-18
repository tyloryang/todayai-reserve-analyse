(() => {
"use strict";
var __webpack_exports__ = {};

;// CONCATENATED MODULE: external "electron"
const external_electron_namespaceObject = require("electron");
;// CONCATENATED MODULE: ../../modules/logs-debug-api.ts
const LOGS_DEBUG_CLOSE_CHANNEL = 'desktop-logs-debug:close';
const LOGS_DEBUG_EVENT_CHANNEL = 'desktop-logs-debug:event';
const LOGS_DEBUG_LIST_FILE_LOGS_CHANNEL = 'desktop-logs-debug:list-file-logs';
const LOGS_DEBUG_LIST_TARGETS_CHANNEL = 'desktop-logs-debug:list-targets';
const LOGS_DEBUG_SUBSCRIBE_CHANNEL = 'desktop-logs-debug:subscribe';
const LOGS_DEBUG_UNSUBSCRIBE_CHANNEL = 'desktop-logs-debug:unsubscribe';
const LOGS_DEBUG_UPLOAD_LOCAL_CHANNEL = 'desktop-logs-debug:upload-local';

;// CONCATENATED MODULE: ../logs-debug/preload.ts


const deliverEvent = async (listener, event)=>{
    try {
        await listener(event);
    } catch  {
    // A renderer observer must not break the isolated preload event bridge.
    }
};
const logsDebugAPI = {
    close: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_CLOSE_CHANNEL);
    },
    listFileLogs: (params)=>external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_LIST_FILE_LOGS_CHANNEL, params),
    listTargets: ()=>external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_LIST_TARGETS_CHANNEL),
    subscribe: async (listener)=>{
        if (typeof listener !== 'function') {
            throw new TypeError('Logs debug listener must be a function');
        }
        const ipcListener = (_event, debugEvent)=>{
            deliverEvent(listener, debugEvent);
        };
        external_electron_namespaceObject.ipcRenderer.on(LOGS_DEBUG_EVENT_CHANNEL, ipcListener);
        try {
            await external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_SUBSCRIBE_CHANNEL);
        } catch (error) {
            external_electron_namespaceObject.ipcRenderer.removeListener(LOGS_DEBUG_EVENT_CHANNEL, ipcListener);
            throw error;
        }
        let subscribed = true;
        return Object.freeze({
            unsubscribe: async ()=>{
                if (!subscribed) {
                    return;
                }
                subscribed = false;
                external_electron_namespaceObject.ipcRenderer.removeListener(LOGS_DEBUG_EVENT_CHANNEL, ipcListener);
                await external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_UNSUBSCRIBE_CHANNEL);
            }
        });
    },
    uploadLocal: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(LOGS_DEBUG_UPLOAD_LOCAL_CHANNEL);
    }
};
external_electron_namespaceObject.contextBridge.exposeInMainWorld('ClientLogsDebugAPI', Object.freeze(logsDebugAPI));

;// CONCATENATED MODULE: ../../modules/rpc-debug-api.ts
const RPC_DEBUG_CLOSE_CHANNEL = 'desktop-rpc-debug:close';
const RPC_DEBUG_RECORD_CHANNEL = 'desktop-rpc-debug:record';
const RPC_DEBUG_SUBSCRIBE_CHANNEL = 'desktop-rpc-debug:subscribe';
const RPC_DEBUG_UNSUBSCRIBE_CHANNEL = 'desktop-rpc-debug:unsubscribe';

;// CONCATENATED MODULE: ../rpc-debug/preload.ts


const deliverRecord = async (listener, record)=>{
    try {
        await listener(record);
    } catch  {
    // A renderer observer must not break the isolated preload event bridge.
    }
};
const rpcDebugAPI = {
    close: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(RPC_DEBUG_CLOSE_CHANNEL);
    },
    subscribe: async (listener)=>{
        if (typeof listener !== 'function') {
            throw new TypeError('RPC debug listener must be a function');
        }
        const ipcListener = (_event, record)=>{
            deliverRecord(listener, record);
        };
        external_electron_namespaceObject.ipcRenderer.on(RPC_DEBUG_RECORD_CHANNEL, ipcListener);
        try {
            await external_electron_namespaceObject.ipcRenderer.invoke(RPC_DEBUG_SUBSCRIBE_CHANNEL);
        } catch (error) {
            external_electron_namespaceObject.ipcRenderer.removeListener(RPC_DEBUG_RECORD_CHANNEL, ipcListener);
            throw error;
        }
        let subscribed = true;
        return Object.freeze({
            unsubscribe: async ()=>{
                if (!subscribed) {
                    return;
                }
                subscribed = false;
                external_electron_namespaceObject.ipcRenderer.removeListener(RPC_DEBUG_RECORD_CHANNEL, ipcListener);
                await external_electron_namespaceObject.ipcRenderer.invoke(RPC_DEBUG_UNSUBSCRIBE_CHANNEL);
            }
        });
    }
};
external_electron_namespaceObject.contextBridge.exposeInMainWorld('ClientRpcDebugAPI', Object.freeze(rpcDebugAPI));

;// CONCATENATED MODULE: ../../modules/tools-debug-api.ts
const TOOLS_DEBUG_CLOSE_CHANNEL = 'desktop-tools-debug:close';
const TOOLS_DEBUG_OPEN_TOOL_PERMISSIONS_CHANNEL = 'desktop-tools-debug:open-tool-permissions';
const TOOLS_DEBUG_RECORD_CHANNEL = 'desktop-tools-debug:record';
const TOOLS_DEBUG_SUBSCRIBE_CHANNEL = 'desktop-tools-debug:subscribe';
const TOOLS_DEBUG_UNSUBSCRIBE_CHANNEL = 'desktop-tools-debug:unsubscribe';

;// CONCATENATED MODULE: ../tools-debug/preload.ts


const preload_deliverRecord = async (listener, record)=>{
    try {
        await listener(record);
    } catch  {
    // A renderer observer must not break the isolated preload event bridge.
    }
};
const toolsDebugAPI = {
    openToolPermissions: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(TOOLS_DEBUG_OPEN_TOOL_PERMISSIONS_CHANNEL);
    },
    close: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(TOOLS_DEBUG_CLOSE_CHANNEL);
    },
    subscribe: async (listener)=>{
        if (typeof listener !== 'function') {
            throw new TypeError('Tools debug listener must be a function');
        }
        const ipcListener = (_event, record)=>{
            preload_deliverRecord(listener, record);
        };
        external_electron_namespaceObject.ipcRenderer.on(TOOLS_DEBUG_RECORD_CHANNEL, ipcListener);
        try {
            await external_electron_namespaceObject.ipcRenderer.invoke(TOOLS_DEBUG_SUBSCRIBE_CHANNEL);
        } catch (error) {
            external_electron_namespaceObject.ipcRenderer.removeListener(TOOLS_DEBUG_RECORD_CHANNEL, ipcListener);
            throw error;
        }
        let subscribed = true;
        return Object.freeze({
            unsubscribe: async ()=>{
                if (!subscribed) {
                    return;
                }
                subscribed = false;
                external_electron_namespaceObject.ipcRenderer.removeListener(TOOLS_DEBUG_RECORD_CHANNEL, ipcListener);
                await external_electron_namespaceObject.ipcRenderer.invoke(TOOLS_DEBUG_UNSUBSCRIBE_CHANNEL);
            }
        });
    }
};
external_electron_namespaceObject.contextBridge.exposeInMainWorld('ClientToolsDebugAPI', Object.freeze(toolsDebugAPI));

;// CONCATENATED MODULE: ../../modules/socket-debug-api.ts
const SOCKET_DEBUG_CLOSE_CHANNEL = 'desktop-socket-debug:close';
const SOCKET_DEBUG_GET_STATE_CHANNEL = 'desktop-socket-debug:get-state';
const SOCKET_DEBUG_RECORD_CHANNEL = 'desktop-socket-debug:record';
const SOCKET_DEBUG_SUBSCRIBE_CHANNEL = 'desktop-socket-debug:subscribe';
const SOCKET_DEBUG_UNSUBSCRIBE_CHANNEL = 'desktop-socket-debug:unsubscribe';
const MAX_SOCKET_DEBUG_RECORDS = 500;

;// CONCATENATED MODULE: ../socket-debug/preload.ts


const socket_debug_preload_deliverRecord = async (listener, event)=>{
    try {
        await listener(event);
    } catch  {
    // A renderer observer must not break the isolated preload event bridge.
    }
};
const socketDebugAPI = {
    close: async ()=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(SOCKET_DEBUG_CLOSE_CHANNEL);
    },
    getState: ()=>external_electron_namespaceObject.ipcRenderer.invoke(SOCKET_DEBUG_GET_STATE_CHANNEL),
    subscribe: async (listener)=>{
        if (typeof listener !== 'function') {
            throw new TypeError('Socket debug listener must be a function');
        }
        const ipcListener = (_event, packetEvent)=>{
            socket_debug_preload_deliverRecord(listener, packetEvent);
        };
        external_electron_namespaceObject.ipcRenderer.on(SOCKET_DEBUG_RECORD_CHANNEL, ipcListener);
        try {
            await external_electron_namespaceObject.ipcRenderer.invoke(SOCKET_DEBUG_SUBSCRIBE_CHANNEL);
        } catch (error) {
            external_electron_namespaceObject.ipcRenderer.removeListener(SOCKET_DEBUG_RECORD_CHANNEL, ipcListener);
            throw error;
        }
        let subscribed = true;
        return Object.freeze({
            unsubscribe: async ()=>{
                if (!subscribed) {
                    return;
                }
                subscribed = false;
                external_electron_namespaceObject.ipcRenderer.removeListener(SOCKET_DEBUG_RECORD_CHANNEL, ipcListener);
                await external_electron_namespaceObject.ipcRenderer.invoke(SOCKET_DEBUG_UNSUBSCRIBE_CHANNEL);
            }
        });
    }
};
external_electron_namespaceObject.contextBridge.exposeInMainWorld('ClientSocketDebugAPI', Object.freeze(socketDebugAPI));

;// CONCATENATED MODULE: ./preload.ts
// All capture bridges share the same isolated, trusted Desktop Capture Debug window.





module.exports = __webpack_exports__;
})()
;