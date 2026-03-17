const LOCAL_STORAGE_KEY = 'visor-quality-presets';
const DEFAULT_PRESETS_URL = './presets.defaults.json';
const USER_PRESETS_URL = './presets.json';

let cachedDefaults = null;
let cachedPersistenceMode = null;

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} at ${url}`);
    }

    return await response.json();
}

function mergePreset(defaultPreset, incomingPreset) {
    if (Array.isArray(defaultPreset)) {
        return Array.isArray(incomingPreset) ? deepClone(incomingPreset) : deepClone(defaultPreset);
    }

    if (!defaultPreset || typeof defaultPreset !== 'object') {
        return incomingPreset !== undefined ? incomingPreset : defaultPreset;
    }

    const result = {};
    const source = incomingPreset && typeof incomingPreset === 'object' ? incomingPreset : {};

    for (const key of Object.keys(defaultPreset)) {
        result[key] = mergePreset(defaultPreset[key], source[key]);
    }

    return result;
}

function mergePresets(defaults, incoming) {
    const merged = {};

    for (const presetName of Object.keys(defaults)) {
        merged[presetName] = mergePreset(defaults[presetName], incoming?.[presetName]);
    }

    return merged;
}

export async function getDefaultQualityPresets() {
    if (cachedDefaults) {
        return deepClone(cachedDefaults);
    }

    cachedDefaults = await fetchJson(DEFAULT_PRESETS_URL);
    return deepClone(cachedDefaults);
}

async function detectPersistenceMode() {
    if (cachedPersistenceMode) {
        return cachedPersistenceMode;
    }

    if (location.protocol === 'file:') {
        cachedPersistenceMode = 'localStorage';
        return cachedPersistenceMode;
    }

    if (location.port === '5500') {
        cachedPersistenceMode = 'localStorage';
        return cachedPersistenceMode;
    }

    try {
        const response = await fetch('/api/presets', {
            method: 'GET',
            cache: 'no-store'
        });

        cachedPersistenceMode = response.ok ? 'server' : 'localStorage';
    } catch {
        cachedPersistenceMode = 'localStorage';
    }

    return cachedPersistenceMode;
}

export async function loadQualityPresets() {
    const defaults = await getDefaultQualityPresets();
    const persistenceMode = await detectPersistenceMode();

    if (persistenceMode === 'server') {
        try {
            const presets = await fetchJson('/api/presets');
            return mergePresets(defaults, presets);
        } catch (error) {
            console.warn('No se pudieron cargar presets desde API. Se usan defaults.', error);
            return defaults;
        }
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            return mergePresets(defaults, JSON.parse(local));
        }

        const bundledPresets = await fetchJson(USER_PRESETS_URL);
        return mergePresets(defaults, bundledPresets);
    } catch (error) {
        console.warn('No se pudieron cargar presets locales. Se usan defaults.', error);
        return defaults;
    }
}

export async function saveQualityPresets(presets) {
    const defaults = await getDefaultQualityPresets();
    const normalized = mergePresets(defaults, presets);
    const persistenceMode = await detectPersistenceMode();

    if (persistenceMode === 'server') {
        const response = await fetch('/api/save-presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalized)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'No se pudieron guardar los presets');
        }

        return await response.json();
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true, mode: 'localStorage' };
}

export async function resetQualityPreset(presets, presetName) {
    const defaults = await getDefaultQualityPresets();

    if (!defaults[presetName]) {
        return presets;
    }

    return {
        ...presets,
        [presetName]: deepClone(defaults[presetName])
    };
}
