import http from 'node:http';
import https from 'node:https';
import { Agent, Pool, ProxyAgent, setGlobalDispatcher } from 'undici';
import { DESKTOP_NODE_PROXY_BYPASS_LIST, isDesktopAmbientProxyEnvironmentKey, isDesktopLoopbackHostname, resolveDesktopEnvironmentHttpProxy, } from '../proxy-environment.mjs';
// Called before importing the application owners. Deleting environment variables
// alone does not replace agents that Node created while initializing the process.
export const initializeDesktopNodeNetwork = (environment) => {
    // Also sanitize the child entry point. Its normal launch environment is already
    // allowlisted, but modules loaded later must never discover ambient opt-in flags.
    for (const key of Object.keys(environment)) {
        if (isDesktopAmbientProxyEnvironmentKey(key)) {
            delete environment[key];
        }
    }
    const proxy = resolveDesktopEnvironmentHttpProxy(environment);
    const proxyUrl = proxy ? `http://${proxy}` : undefined;
    const proxyEnv = proxyUrl
        ? {
            HTTP_PROXY: proxyUrl,
            HTTPS_PROXY: proxyUrl,
            NO_PROXY: DESKTOP_NODE_PROXY_BYPASS_LIST,
        }
        : {};
    const options = { keepAlive: true, scheduling: 'lifo', timeout: 5_000, proxyEnv };
    http.globalAgent = new http.Agent(options);
    https.globalAgent = new https.Agent(options);
    const dispatcher = new Agent({
        factory: (origin, options) => {
            if (!proxyUrl || isDesktopLoopbackHostname(new URL(origin).hostname)) {
                return new Pool(origin, options);
            }
            return new ProxyAgent({ ...options, uri: proxyUrl });
        },
    });
    setGlobalDispatcher(dispatcher);
};
