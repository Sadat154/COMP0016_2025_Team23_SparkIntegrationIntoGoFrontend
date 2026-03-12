/**
 * Pure helper functions for SparkCustomRegulations view.
 * Extracted for unit testing and reuse.
 */

export type Option = { key: string; label: string };

interface RegulationItemForHelper {
    question: string;
    answer: string;
}

export function uniqOptions(values: string[], includeAll = true): Option[] {
    const set = new Set(values.map((v) => v.trim()).filter(Boolean));
    const opts = Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ key: v, label: v }));
    return includeAll ? [{ key: '', label: 'All' }, ...opts] : opts;
}

export function normalizeYesNo(value: string): 'Yes' | 'No' | 'N/A' {
    const v = (value ?? '').trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return 'N/A';
}

export function normalizeName(value: string | null | undefined): string {
    const normalized = (value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(',')[0];

    if (!normalized) return '';

    return normalized
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function getCountryNameKeysForRegionMapping(value: string): string[] {
    const base = normalizeName(value);
    if (!base) {
        return [];
    }

    const keys = new Set<string>([base]);

    if (base === 'cote d ivoire') {
        keys.add('ivory coast');
        keys.add('cote ivoire');
        keys.add('cote divoire');
    }

    if (base === 'central african republic') {
        keys.add('centrafrique');
        keys.add('centrafique');
        keys.add('central african rep');
    }

    return Array.from(keys);
}

/** Parses one CSV line handling quoted fields and escaped quotes. */
export function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];

        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }

    out.push(cur);
    return out.map((s) => s.trim());
}

function normalizeQuestion(v: string): string {
    return v.toLowerCase().trim();
}

export function getAnswerForQuestion(
    question: string,
    allItems: RegulationItemForHelper[],
): string {
    const qLower = normalizeQuestion(question);
    const item = allItems.find((it) => normalizeQuestion(it.question) === qLower);
    return item?.answer?.trim() ?? '';
}

export function toTitleCase(value: string): string {
    return value
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ---------------------------------------------------------------------------
// countries.json ISO3 mapping (for buildNormalizedNameToIso3FromCountriesJson)
// ---------------------------------------------------------------------------

type CountriesJsonEntry = Record<string, unknown>;

export function coerceCountriesJsonArray(input: unknown): CountriesJsonEntry[] {
    if (Array.isArray(input)) return input as CountriesJsonEntry[];
    if (input && typeof input === 'object') {
        const obj = input as Record<string, unknown>;
        const maybe = (obj.countries as unknown)
            ?? (obj.data as unknown)
            ?? (obj.items as unknown)
            ?? (obj.results as unknown);
        if (Array.isArray(maybe)) return maybe as CountriesJsonEntry[];
    }
    return [];
}

function pickFirstString(v: unknown): string | undefined {
    if (typeof v === 'string') return v;
    return undefined;
}

export function pickIso3(entry: CountriesJsonEntry): string | undefined {
    const candidates = [
        entry.iso3,
        entry.iso3_code,
        entry.iso_3,
        entry.ISO3,
        entry.ISO_3,
        entry['alpha-3'],
        entry.alpha3,
    ];
    const raw = candidates.map(pickFirstString).find(Boolean);
    const iso3 = (raw ?? '').toUpperCase().trim();
    return iso3.length === 3 ? iso3 : undefined;
}

export function pickNameCandidates(entry: CountriesJsonEntry): string[] {
    const candidates: unknown[] = [
        entry.name,
        entry.country,
        entry.label,
        entry.title,
        entry.common_name,
        entry.official_name,
        entry.short_name,
        entry.display_name,
        entry.society_name,
        entry.iso3_name,
    ];

    const nameObj = entry.name;
    if (nameObj && typeof nameObj === 'object') {
        const n = nameObj as Record<string, unknown>;
        candidates.push(n.en, n.english, n.fr, n.es, n.ar);
    }

    return candidates
        .map(pickFirstString)
        .filter((s): s is string => !!s && !!s.trim())
        .map((s) => s.trim());
}

export function buildNormalizedNameToIso3FromCountriesJson(input: unknown): Map<string, string> {
    const arr = coerceCountriesJsonArray(input);
    const map = new Map<string, string>();

    arr.forEach((entry) => {
        const iso3 = pickIso3(entry);
        if (!iso3) return;

        const names = pickNameCandidates(entry);
        names.forEach((n) => {
            const key = normalizeName(n);
            if (key) map.set(key, iso3);
        });
    });

    return map;
}
