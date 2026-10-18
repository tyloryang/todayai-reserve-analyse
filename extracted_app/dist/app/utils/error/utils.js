import { ERROR_PRESENTATIONS } from './consts.js';
export const resolveErrorPresentation = (error) => {
    let current = error;
    for (let depth = 0; depth < 8; depth += 1) {
        if (current === null || typeof current !== 'object') {
            return undefined;
        }
        try {
            const type = Object.getOwnPropertyDescriptor(current, 'type')?.value;
            if (typeof type === 'string' && Object.hasOwn(ERROR_PRESENTATIONS, type)) {
                return ERROR_PRESENTATIONS[type];
            }
            current = Object.getOwnPropertyDescriptor(current, 'cause')?.value;
        }
        catch {
            return undefined;
        }
    }
    return undefined;
};
