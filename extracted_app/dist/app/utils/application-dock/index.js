/** 主 bundle 默认以 LSUIElement 启动，仅在 Electron 主进程恢复前台应用身份。 */
export const showApplicationDock = async (application) => {
    const dock = application.dock;
    if (!dock) {
        return;
    }
    // macOS 27.2 的 isVisible() 可能读到混入子进程 policy 的缓存；启动时直接提升主进程。
    await dock.show();
};
