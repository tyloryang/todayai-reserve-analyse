import { app, ipcMain } from 'electron';
import { DesktopMainApp, DesktopStartupRecovery } from '../app/index.js';
import { PACKAGED_BACKEND_LANE, PACKAGED_POSTHOG_HOST, PACKAGED_POSTHOG_SHADOW_HOST, PACKAGED_SENTRY_DSN, PACKAGED_VERCEL_BYPASS_SECRET, POSTHOG_TOKEN_DEV, POSTHOG_TOKEN_PROD, POSTHOG_SHADOW_TOKEN_DEV, POSTHOG_SHADOW_TOKEN_PROD, } from '../consts/build.js';
import { DESKTOP_PROTOCOL_RESTORE_ARGUMENT } from '../consts/deep-link-public-config.mjs';
const main = async () => {
    const recovery = new DesktopStartupRecovery();
    try {
        const desktopApp = await DesktopMainApp.create({
            application: app,
            bypassSecret: PACKAGED_VERCEL_BYPASS_SECRET,
            ipc: ipcMain,
            lane: PACKAGED_BACKEND_LANE,
            logs: {
                postHogHost: PACKAGED_POSTHOG_HOST,
                postHogTokenDev: POSTHOG_TOKEN_DEV,
                postHogTokenProd: POSTHOG_TOKEN_PROD,
                postHogShadowHost: PACKAGED_POSTHOG_SHADOW_HOST,
                postHogShadowTokenDev: POSTHOG_SHADOW_TOKEN_DEV,
                postHogShadowTokenProd: POSTHOG_SHADOW_TOKEN_PROD,
                sentryDsn: PACKAGED_SENTRY_DSN,
            },
            recovery,
        });
        if (!desktopApp) {
            return;
        }
        await desktopApp.launch();
    }
    catch (error) {
        if (process.argv.includes(DESKTOP_PROTOCOL_RESTORE_ARGUMENT)) {
            console.error('[desktop] protocol restoration failed; recovery is pending');
            app.exit(1);
            return;
        }
        console.error('[desktop] startup failed');
        await recovery.show(error);
    }
};
main();
