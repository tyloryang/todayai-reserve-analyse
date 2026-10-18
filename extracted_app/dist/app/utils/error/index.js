import { getDesktopText } from '../../modules/error-page/copy.js';
import { resolveErrorPresentation } from './utils.js';
export class LaunchError extends Error {
    title;
    detail;
    options;
    constructor(error, locale, options = {}) {
        const cause = error instanceof LaunchError ? error.cause : error;
        const resolvedOptions = {
            ...(error instanceof LaunchError ? error.options : {}),
            ...options,
        };
        const presentation = resolveErrorPresentation(cause);
        let description = '';
        if (cause instanceof Error) {
            description = cause.message;
        }
        else if (typeof cause === 'string') {
            description = cause;
        }
        let messageKey = 'desktop.errors.startFailed';
        if (presentation) {
            messageKey =
                (resolvedOptions.platform &&
                    presentation.platformMessageKeys?.[resolvedOptions.platform]) ??
                    presentation.messageKey;
        }
        else if (/ERR_CERT_|ERR_SSL_|SEC_E_UNTRUSTED_ROOT/u.test(description)) {
            messageKey = 'desktop.errors.certificate';
        }
        else if (/ERR_(?:CONNECTION_|INTERNET_|NAME_NOT_RESOLVED|NETWORK_|TIMED_OUT)/u.test(description)) {
            messageKey = 'desktop.errors.network';
        }
        super(getDesktopText(messageKey, locale), { cause });
        this.name = 'LaunchError';
        this.title = getDesktopText('desktop.errors.startTitle', locale);
        this.options = resolvedOptions;
        this.detail = [
            this.message,
            ...(presentation?.recoveryKey ? [getDesktopText(presentation.recoveryKey, locale)] : []),
            getDesktopText('desktop.errors.resetDescription', locale),
        ].join('\n\n');
    }
}
