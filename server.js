import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const DEFAULT_PRESETS_PATH = path.join(__dirname, 'presets.defaults.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function deepMerge(defaultValue, candidateValue) {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(candidateValue) ? candidateValue : defaultValue;
    }

    if (!defaultValue || typeof defaultValue !== 'object') {
        return candidateValue !== undefined ? candidateValue : defaultValue;
    }

    const result = {};
    const source = candidateValue && typeof candidateValue === 'object' ? candidateValue : {};

    for (const key of Object.keys(defaultValue)) {
        result[key] = deepMerge(defaultValue[key], source[key]);
    }

    return result;
}

async function readDefaults() {
    const raw = await fs.readFile(DEFAULT_PRESETS_PATH, 'utf8');
    return JSON.parse(raw);
}

async function normalizePresets(data) {
    const defaults = await readDefaults();
    if (!data || typeof data !== 'object') {
        return null;
    }

    const normalized = {};
    for (const key of Object.keys(defaults)) {
        normalized[key] = deepMerge(defaults[key], data[key]);
    }

    return normalized;
}

app.get('/api/presets', async (_req, res) => {
    try {
        const raw = await fs.readFile(PRESETS_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        const normalized = await normalizePresets(parsed);
        res.json(normalized);
    } catch (error) {
        console.error('Error reading presets.json:', error);
        res.status(500).json({ error: 'No se pudo leer presets.json' });
    }
});

app.post('/api/save-presets', async (req, res) => {
    try {
        const normalized = await normalizePresets(req.body);
        if (!normalized) {
            return res.status(400).json({ error: 'Formato de presets inválido' });
        }

        const tempPath = `${PRESETS_PATH}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(normalized, null, 2), 'utf8');
        await fs.rename(tempPath, PRESETS_PATH);

        res.json({ ok: true });
    } catch (error) {
        console.error('Error saving presets.json:', error);
        res.status(500).json({ error: 'No se pudieron guardar los presets' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});
