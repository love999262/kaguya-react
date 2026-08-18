export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeChangeDetail {
    mode: ThemeMode;
    resolved: ResolvedTheme;
}

const THEME_STORAGE_KEY = 'kaguya:theme-mode';

const mediaQuery: MediaQueryList | null = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let currentMode: ThemeMode = 'system';

function readStoredMode(): ThemeMode {
    try {
        const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
            return raw;
        }
    } catch {
        // ignore storage issues
    }
    return 'system';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
    if (mode === 'system') {
        return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
    }
    return mode;
}

function emitChange(): void {
    const detail: ThemeChangeDetail = {
        mode: currentMode,
        resolved: resolveTheme(currentMode),
    };
    document.documentElement.dataset.theme = detail.resolved;
    window.dispatchEvent(new CustomEvent<ThemeChangeDetail>('kaguya:theme-change', { detail }));
}

export function initTheme(): void {
    currentMode = readStoredMode();
    document.documentElement.dataset.theme = resolveTheme(currentMode);
    if (mediaQuery) {
        const handleSystemChange = (): void => {
            if (currentMode === 'system') {
                emitChange();
            }
        };
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleSystemChange);
        } else {
            mediaQuery.addListener(handleSystemChange);
        }
    }
}

export function getThemeMode(): ThemeMode {
    return currentMode;
}

export function getResolvedTheme(): ResolvedTheme {
    return resolveTheme(currentMode);
}

export function setThemeMode(mode: ThemeMode): void {
    currentMode = mode;
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
        // ignore storage issues
    }
    emitChange();
}

export function onThemeChange(callback: (detail: ThemeChangeDetail) => void): () => void {
    const handler = (event: Event): void => {
        callback((event as CustomEvent<ThemeChangeDetail>).detail);
    };
    window.addEventListener('kaguya:theme-change', handler);
    return () => {
        window.removeEventListener('kaguya:theme-change', handler);
    };
}
