(() => {
"use strict";
var __webpack_exports__ = {};

;// CONCATENATED MODULE: external "electron"
const external_electron_namespaceObject = require("electron");
;// CONCATENATED MODULE: ../../modules/meeting-reminder-menu-api/index.ts
const MEETING_REMINDER_MENU_CHANNEL = 'desktop-meeting-reminder-menu:action';

;// CONCATENATED MODULE: ./preload.ts


const api = {
    getState: ()=>external_electron_namespaceObject.ipcRenderer.invoke(MEETING_REMINDER_MENU_CHANNEL, 'get'),
    ready: (requestId)=>external_electron_namespaceObject.ipcRenderer.invoke(MEETING_REMINDER_MENU_CHANNEL, 'ready', requestId),
    close: async (requestId)=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(MEETING_REMINDER_MENU_CHANNEL, 'close', requestId);
    },
    openSettings: async (requestId)=>{
        await external_electron_namespaceObject.ipcRenderer.invoke(MEETING_REMINDER_MENU_CHANNEL, 'open-settings', requestId);
    }
};
external_electron_namespaceObject.contextBridge.exposeInMainWorld('ClientMeetingReminderMenuAPI', api);

module.exports = __webpack_exports__;
})()
;