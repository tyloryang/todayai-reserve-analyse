import { getPatchTranslateMap } from '@todayai-labs/i18n-patch/patch';
import { resolveSupportedLanguage } from '@todayai-labs/language';
export const getDesktopText = (key, locale = globalThis.navigator?.language) => {
    const copy = getPatchTranslateMap(resolveSupportedLanguage(locale));
    return copy[key] ?? getPatchTranslateMap('en')[key] ?? key;
};
