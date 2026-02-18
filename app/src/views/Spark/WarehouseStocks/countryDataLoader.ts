// Load country data from the bundled countries.json file (source of truth).
const COUNTRIES_LOCAL_URL = '/data/countries.json';

let cachedCountriesData: CountryDataFromJSON[] | undefined;
let inflightPromise: Promise<CountryDataFromJSON[]> | undefined;

interface CountryDataFromJSON {
    iso3: string | null;
    centroid?: {
        type: string;
        coordinates: [number, number];
    } | null;
}

// Build a map of ISO3 codes to centroids from provided country data
function buildISO3ToCentroidMapFromData(
    countries: CountryDataFromJSON[],
): Map<string, [number, number]> {
    const map = new Map<string, [number, number]>();

    countries.forEach((country) => {
        const iso3 = (country.iso3 ?? '').toUpperCase();

        if (!iso3) {
            return;
        }

        const coords = country.centroid?.coordinates;

        if (
            coords
            && coords.length === 2
            && Number.isFinite(coords[0])
            && Number.isFinite(coords[1])
        ) {
            map.set(iso3, coords);
        }
    });

    return map;
}

async function fetchCountries(): Promise<CountryDataFromJSON[]> {
    const response = await fetch(COUNTRIES_LOCAL_URL, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(
            `Failed to fetch countries from ${COUNTRIES_LOCAL_URL}: ${response.status}`,
        );
    }
    const data = await response.json();
    if (Array.isArray(data)) {
        return data;
    }
    const results = (data as { results?: unknown })?.results;
    return Array.isArray(results) ? results : [];
}

async function loadCountriesData(): Promise<CountryDataFromJSON[]> {
    if (cachedCountriesData) {
        return cachedCountriesData;
    }
    if (inflightPromise) {
        return inflightPromise;
    }

    inflightPromise = (async () => {
        const countries = await fetchCountries();
        cachedCountriesData = countries;
        return countries;
    })();

    try {
        return await inflightPromise;
    } finally {
        inflightPromise = undefined;
    }
}

// Convenience helper: load and build ISO3 -> centroid map
// from bundled countries.json
async function loadISO3ToCentroidMap(): Promise<Map<string, [number, number]>> {
    const countries = await loadCountriesData();
    return buildISO3ToCentroidMapFromData(countries);
}

export default loadISO3ToCentroidMap;
