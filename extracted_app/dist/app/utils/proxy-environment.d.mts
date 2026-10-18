export declare const AMBIENT_PROXY_ENVIRONMENT_KEYS: readonly string[];
/** @param {string} key */
export declare const isDesktopAmbientProxyEnvironmentKey: (key: string) => boolean;
/** @param {Record<string, string | undefined>} environment */
export declare const stripDesktopAmbientProxyEnvironment: (environment: Record<string, string | undefined>) => {
    [k: string]: string | undefined;
};
export declare const DESKTOP_NODE_PROXY_BYPASS_LIST = "localhost,.localhost,127.0.0.1,127.0.0.0-127.255.255.255,::1,[::1]";
/** @param {string} hostname */
export declare const isDesktopLoopbackHostname: (hostname: string) => boolean;
/** @param {string | undefined} value */
export declare const resolveDesktopHttpProxy: (value: string | undefined) => string | undefined;
/** @param {Record<string, string | undefined>} environment */
export declare const resolveDesktopEnvironmentHttpProxy: (environment: Record<string, string | undefined>) => string | undefined;
