/** Untrusted scene documents are excluded even when loaded as a top-level surface. */
export const isTodayDemoSceneUrl = (value) => {
    try {
        const { pathname } = new URL(value);
        return pathname === '/today-demo/scene' || pathname === '/today-demo/scene/';
    }
    catch {
        return false;
    }
};
