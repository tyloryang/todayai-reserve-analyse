import { RuntimeEnvironment } from '@todayai-labs/platform-interface';
import { DEFAULT_DESKTOP_RELEASE_REGION, DESKTOP_DEEP_LINK_BUILD_SCHEMES, } from '@todayai-labs/vars/desktop-identity';
import { DESKTOP_PROTOCOL_CALLBACK_ARGUMENT as PROTOCOL_CALLBACK_ARGUMENT, DESKTOP_PROTOCOL_RESTORE_ARGUMENT as PROTOCOL_RESTORE_ARGUMENT, } from './deep-link-public-config.mjs';
const DEEP_LINK_BUILD_KEYS = {
    [RuntimeEnvironment.Development]: 'dev',
    [RuntimeEnvironment.Staging]: 'staging',
    [RuntimeEnvironment.Production]: 'prod',
};
export const DESKTOP_OAUTH_CALLBACK_SCHEME = 'today-connector';
export const DESKTOP_PROTOCOL_CALLBACK_ARGUMENT = PROTOCOL_CALLBACK_ARGUMENT;
export const DESKTOP_PROTOCOL_RESTORE_ARGUMENT = PROTOCOL_RESTORE_ARGUMENT;
/**
 * 地区缺省为国际版。发布地区仍作为显式构建身份输入；当前国内与国际版
 * 按服务端回调约定复用同一渠道 scheme。
 */
export const resolveDesktopDeepLinkScheme = (buildEnvironment, releaseRegion = DEFAULT_DESKTOP_RELEASE_REGION) => DESKTOP_DEEP_LINK_BUILD_SCHEMES[releaseRegion][DEEP_LINK_BUILD_KEYS[buildEnvironment]];
const DESKTOP_OAUTH_CALLBACK_HOSTS = new Set(['connects', 'macos_channel']);
export const isDesktopOAuthCallbackUrl = (value, expectedScheme) => {
    try {
        const url = new URL(value);
        return (url.protocol === `${expectedScheme}:` &&
            DESKTOP_OAUTH_CALLBACK_HOSTS.has(url.hostname) &&
            url.pathname === '/callback');
    }
    catch {
        return false;
    }
};
