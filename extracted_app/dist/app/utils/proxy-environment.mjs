export const AMBIENT_PROXY_ENVIRONMENT_KEYS = Object.freeze([
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'NO_PROXY',
    'NODE_USE_ENV_PROXY',
    // Application debugging uses explicit CLI arguments. Do not let Node startup
    // flags re-enable public proxy discovery in an inherited application process.
    'NODE_OPTIONS',
]);
/** @param {string} key */
export const isDesktopAmbientProxyEnvironmentKey = (key) => AMBIENT_PROXY_ENVIRONMENT_KEYS.includes(key.toUpperCase());
/** @param {Record<string, string | undefined>} environment */
export const stripDesktopAmbientProxyEnvironment = (environment) => Object.fromEntries(Object.entries(environment).filter(([key]) => !isDesktopAmbientProxyEnvironmentKey(key)));
export const DESKTOP_NODE_PROXY_BYPASS_LIST = 'localhost,.localhost,127.0.0.1,127.0.0.0-127.255.255.255,::1,[::1]';
/** @param {string} hostname */
export const isDesktopLoopbackHostname = (hostname) => {
    const host = hostname
        .toLowerCase()
        .replace(/^\[|\]$/gu, '')
        .replace(/\.$/u, '');
    return (host === 'localhost' ||
        host.endsWith('.localhost') ||
        /^127\.\d+\.\d+\.\d+$/u.test(host) ||
        host === '::1' ||
        /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/u.test(host));
};
/** @param {string | undefined} value */
export const resolveDesktopHttpProxy = (value) => {
    const proxy = value?.trim();
    if (!proxy) {
        return undefined;
    }
    try {
        const hasHttpProtocol = /^http:\/\//iu.test(proxy);
        const addressWithOptionalRootPath = hasHttpProtocol ? proxy.slice('http://'.length) : proxy;
        const address = hasHttpProtocol && addressWithOptionalRootPath.endsWith('/')
            ? addressWithOptionalRootPath.slice(0, -1)
            : addressWithOptionalRootPath;
        const match = /^(?:\[[^\]]+\]|[^:[\]/?#\s]+):(\d+)$/u.exec(address);
        const port = Number(match?.[1]);
        if (!match || !Number.isInteger(port) || port < 1 || port > 65_535) {
            throw new Error();
        }
        const url = new URL(`http://${address}`);
        const { hash, hostname, password, pathname, search, username } = url;
        if (!hostname ||
            username.length > 0 ||
            password.length > 0 ||
            pathname !== '/' ||
            search.length > 0 ||
            hash.length > 0) {
            throw new Error();
        }
        return address;
    }
    catch {
        throw new Error('TODAY_HTTP_PROXY must use host:port or http://host:port format without credentials or a path');
    }
};
/** @param {Record<string, string | undefined>} environment */
export const resolveDesktopEnvironmentHttpProxy = (environment) => {
    try {
        return resolveDesktopHttpProxy(environment.TODAY_HTTP_PROXY);
    }
    catch {
        console.warn('[desktop] ignoring invalid TODAY_HTTP_PROXY environment variable');
        return undefined;
    }
};
