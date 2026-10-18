/**
 * Public product URL schemes shared by the Desktop application composition
 * and its packaged Next.js build.
 *
 * @type {Readonly<Record<'dev' | 'staging' | 'prod', 'today' | 'today-canary'>>}
 */
export declare const DESKTOP_DEEP_LINK_BUILD_SCHEMES: Readonly<Record<'dev' | 'staging' | 'prod', 'today' | 'today-canary'>>;
export declare const DESKTOP_PROTOCOL_CALLBACK_ARGUMENT = "--protocol-callback";
export declare const DESKTOP_PROTOCOL_RESTORE_ARGUMENT = "--restore-protocols";
