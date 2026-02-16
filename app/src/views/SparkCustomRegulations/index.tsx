import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    Modal,
    SelectInput,
    Table,
    TextInput,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';

import useCountryRaw from '#hooks/domain/useCountryRaw';
import useFilterState from '#hooks/useFilterState';
import { useRequest } from '#utils/restRequest';

import CustomsRegulationsMap from './CustomsMap/CustomsRegulationsMap';

// eslint-disable-next-line import/no-relative-packages
import countriesJson from '../../../prototypes/world-dashboard/public/data/countries.json';
// IMPORTANT: adjust this import path to wherever your countries.json actually lives
// Example options you might be using in your project:
// - './countries.json'
// - '/data/countries.json' (this would not work with import, only fetch)
// - '#utils/countries.json'
import styles from './styles.module.css';

interface RegulationItem {
    question: string;
    answer: string;
    notes?: string;
}

interface RegulationSection {
    section: string;
    items: RegulationItem[];
}

interface CountryRegulation {
    country: string;
    sections: RegulationSection[];
}

interface RegulationsApiResponse {
    countries: CountryRegulation[];
}

interface MatrixRow {
    id: number;
    region: string;
    country: string;
    iso3?: string;
    ifrcLegalStatus: string;
    humanitarianCargoExemptions: string;
    detailsLabel: string;
    lastUpdated: string;
    countryData?: CountryRegulation;
}

const IFRC_LEGAL_STATUS_QUESTION = 'Is there an existing status agreement for IFRC in the country?';
const HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION = 'Are there exemptions for humanitarian cargo (duty/VAT)? Legal framework?';
const COUNTRIES_CSV_URL = '/data/Countries.csv';

const REGION_ID_TO_LABEL: Record<number, string> = {
    0: 'Africa',
    1: 'Americas',
    2: 'Asia Pacific',
    3: 'Europe',
    4: 'Middle East and North Africa',
};

type Option = { key: string; label: string };

function uniqOptions(values: string[], includeAll = true): Option[] {
    const set = new Set(values.map((v) => v.trim()).filter(Boolean));
    const opts = Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ key: v, label: v }));
    return includeAll ? [{ key: '', label: 'All' }, ...opts] : opts;
}

function normalizeYesNo(value: string): 'Yes' | 'No' | 'N/A' {
    const v = (value ?? '').trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return 'N/A';
}

function normalizeName(value: string | null | undefined): string {
    const normalized = (value ?? '')
        .toLowerCase()
        .split(',')[0];

    if (!normalized) return '';

    return normalized
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Parses one CSV line handling quotes
function parseCsvLine(line: string): string[] {
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

async function loadCountryNameToRegionLabelFromCsv(): Promise<Map<string, string>> {
    const res = await fetch(COUNTRIES_CSV_URL, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${COUNTRIES_CSV_URL}: ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
        return new Map();
    }

    const headerLine = lines[0];
    if (!headerLine) return new Map();

    const header = parseCsvLine(headerLine);
    const idxName = header.indexOf('name');
    const idxRegion = header.indexOf('region');

    if (idxName === -1 || idxRegion === -1) {
        return new Map();
    }

    const map = new Map<string, string>();

    for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (line) {
            const cols = parseCsvLine(line);

            const name = cols[idxName] ?? '';
            const regionRaw = cols[idxRegion] ?? '';

            const nameKey = normalizeName(name);
            const regionId = Number(regionRaw);
            const label = Number.isFinite(regionId)
                ? REGION_ID_TO_LABEL[regionId]
                : undefined;

            if (nameKey && Number.isFinite(regionId) && label) {
                map.set(nameKey, label);
            }
        }
    }

    return map;
}

function normalizeQuestion(v: string) {
    return v.toLowerCase().trim();
}

function getAnswerForQuestion(question: string, allItems: RegulationItem[]): string {
    const qLower = normalizeQuestion(question);
    const item = allItems.find((it) => normalizeQuestion(it.question) === qLower);
    return item?.answer?.trim() ?? '';
}

function toTitleCase(value: string): string {
    return value
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

interface DetailModalProps {
    countryData?: CountryRegulation;
    onClose: () => void;
}

function DetailModal({ countryData, onClose }: DetailModalProps) {
    const [modalSearch, setModalSearch] = useState<string>('');

    const handleModalSearchChange = useCallback((value: string | undefined) => {
        setModalSearch(value ?? '');
    }, []);

    if (!countryData) {
        return null;
    }

    const filteredSections = countryData.sections?.map((section) => {
        const filteredItems = section.items?.filter((item) => {
            if (!modalSearch.trim()) {
                return true;
            }
            const searchLower = modalSearch.toLowerCase();
            return (item.question?.toLowerCase?.().includes(searchLower) ?? false)
                || (item.answer?.toLowerCase?.().includes(searchLower) ?? false)
                || (item.notes?.toLowerCase?.().includes(searchLower) ?? false);
        }) ?? [];
        return { ...section, items: filteredItems };
    }).filter((section) => section.items.length > 0) ?? [];

    return (
        <Modal
            heading={`Regulations: ${countryData.country}`}
            onClose={onClose}
            // @ts-expect-error depending on ui version
            size="large"
            footer={(
                <Button name={undefined} onClick={onClose}>
                    Close
                </Button>
            )}
        >
            <TextInput
                name="modalSearch"
                value={modalSearch}
                onChange={handleModalSearchChange}
                placeholder="Search questions, answers, notes..."
                className={styles.modalSearchInput}
            />
            <div className={styles.detailContent}>
                {filteredSections.map((section) => (
                    <div key={section.section} className={styles.sectionBlock}>
                        <h3 className={styles.sectionTitle}>{section.section}</h3>
                        <div className={styles.items}>
                            {section.items?.map((item) => (
                                <div key={`${section.section}-${item.question}`} className={styles.itemCard}>
                                    <div className={styles.question}>{item.question}</div>
                                    <div className={styles.answer}>
                                        {item.answer?.trim() || 'N/A'}
                                    </div>
                                    {item.notes?.trim() && (
                                        <div className={styles.notes}>
                                            <div className={styles.notesLabel}>Notes</div>
                                            <div className={styles.notesContent}>
                                                {item.notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}

/**
 * countries.json ISO3 mapping
 *
 * This is intentionally defensive about countries.json structure.
 * It supports these common shapes:
 * 1) [{ iso3: "GBR", name: "United Kingdom" }, ...]
 * 2) { countries: [{ iso3, name }, ...] }
 * 3) { data: [{ iso3, name }, ...] }
 * and it will try multiple name-like fields if present.
 */
type CountriesJsonEntry = Record<string, unknown>;
function coerceCountriesJsonArray(input: unknown): CountriesJsonEntry[] {
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

function pickIso3(entry: CountriesJsonEntry): string | undefined {
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

function pickNameCandidates(entry: CountriesJsonEntry): string[] {
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

    // Sometimes there is a nested object like { name: { en: "..." } }
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

function buildNormalizedNameToIso3FromCountriesJson(input: unknown): Map<string, string> {
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

function CustomRegulationsMatrix() {
    const { sortState } = useFilterState({ filter: {} });
    const [selectedCountry, setSelectedCountry] = useState<CountryRegulation | undefined>();

    // keep your existing text searches
    const [searchCountry, setSearchCountry] = useState<string>('');
    const [searchAnswer, setSearchAnswer] = useState<string>('');

    // dropdown filters (above map)
    const [regionFilter, setRegionFilter] = useState<string>('');
    const [countryFilter, setCountryFilter] = useState<string>('');
    const [ifrcLegalStatusFilter, setIfrcLegalStatusFilter] = useState<string>(''); // Yes | No | N/A | ''
    const [cargoExemptionsFilter, setCargoExemptionsFilter] = useState<string>('');

    const [countryNameToRegionLabel, setCountryNameToRegionLabel] = useState<
        Map<string, string>
    >(new Map());

    const handleSearchCountryChange = useCallback((value: string | undefined) => {
        setSearchCountry(value ?? '');
    }, []);

    const handleSearchAnswerChange = useCallback((value: string | undefined) => {
        setSearchAnswer(value ?? '');
    }, []);

    const { pending, response } = useRequest({
        url: '/api/v2/country-regulations/',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const apiData = response as RegulationsApiResponse | undefined;
    const countries = useMemo(
        () => apiData?.countries ?? [],
        [apiData],
    );

    useEffect(() => {
        let mounted = true;

        loadCountryNameToRegionLabelFromCsv()
            .then((map) => {
                if (!mounted) return;
                setCountryNameToRegionLabel(map);
            })
            .catch(() => {
                if (!mounted) return;
                setCountryNameToRegionLabel(new Map());
            });

        return () => {
            mounted = false;
        };
    }, []);

    /**
     * Keep your existing useCountryRaw alone, but stop relying on it for ISO3.
     * We build ISO3 mapping from countries.json instead.
     */
    useCountryRaw();

    const normalizedNameToIso3 = useMemo(() => {
        const mapFromJson = buildNormalizedNameToIso3FromCountriesJson(countriesJson);

        // Optional: add a few targeted aliases if your API uses variants
        // Only add if you actually need them.
        const aliasPairs: Array<[string, string]> = [
            // ['Congo (DRC)', 'COD'],
            // ['Congo', 'COG'],
        ];
        aliasPairs.forEach(([name, iso3]) => {
            const k = normalizeName(name);
            if (k && iso3) mapFromJson.set(k, iso3.toUpperCase().trim());
        });

        return mapFromJson;
    }, []);

    const baseRows: MatrixRow[] = useMemo(
        () => countries
            .filter((c) => c.country?.trim())
            .map((country, index) => {
                const countryItems = country.sections?.flatMap((s) => s.items) ?? [];
                const regionLabel = countryNameToRegionLabel.get(normalizeName(country.country)) ?? 'N/A';

                const legal = getAnswerForQuestion(IFRC_LEGAL_STATUS_QUESTION, countryItems);
                const cargo = getAnswerForQuestion(
                    HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION,
                    countryItems,
                );

                const iso3 = normalizedNameToIso3.get(normalizeName(country.country)) ?? undefined;

                return {
                    id: index + 1,
                    region: regionLabel,
                    country: toTitleCase(country.country ?? ''),
                    iso3,
                    ifrcLegalStatus: legal ? toTitleCase(legal) : 'N/A',
                    humanitarianCargoExemptions: cargo ? toTitleCase(cargo) : 'N/A',
                    detailsLabel: 'More details',
                    lastUpdated: 'N/A',
                    countryData: country,
                };
            }),
        [countries, countryNameToRegionLabel, normalizedNameToIso3],
    );

    // options for dropdowns
    const regionOptions = useMemo(
        () => uniqOptions(baseRows.map((r) => r.region).filter((r) => r !== 'N/A')),
        [baseRows],
    );
    const countryOptions = useMemo(
        () => uniqOptions(baseRows.map((r) => r.country)),
        [baseRows],
    );
    const legalStatusOptions = useMemo<Option[]>(
        () => [
            { key: '', label: 'All' },
            { key: 'Yes', label: 'Yes' },
            { key: 'No', label: 'No' },
            { key: 'N/A', label: 'N/A' },
        ],
        [],
    );
    const cargoOptions = useMemo(
        () => uniqOptions(baseRows.map((r) => r.humanitarianCargoExemptions)),
        [baseRows],
    );

    // MAP rows: only filters that should affect map
    const rowsForMap = useMemo(
        () => baseRows
            .filter((r) => (!regionFilter ? true : r.region === regionFilter))
            .filter((r) => (!countryFilter ? true : r.country === countryFilter))
            .filter((r) => (
                !ifrcLegalStatusFilter
                    ? true
                    : normalizeYesNo(r.ifrcLegalStatus) === ifrcLegalStatusFilter
            )),
        [baseRows, regionFilter, countryFilter, ifrcLegalStatusFilter],
    );

    // TABLE rows: all filters including cargo + text searches
    const rows: MatrixRow[] = useMemo(
        () => baseRows
            .filter((r) => (!regionFilter ? true : r.region === regionFilter))
            .filter((r) => (!countryFilter ? true : r.country === countryFilter))
            .filter((r) => (
                !ifrcLegalStatusFilter
                    ? true
                    : normalizeYesNo(r.ifrcLegalStatus) === ifrcLegalStatusFilter
            ))
            .filter((r) => (
                !cargoExemptionsFilter
                    ? true
                    : r.humanitarianCargoExemptions === cargoExemptionsFilter
            ))
            .filter((r) => {
                if (!searchCountry.trim()) return true;
                return r.country?.toLowerCase?.().includes(searchCountry.toLowerCase()) ?? false;
            })
            .filter((r) => {
                if (!searchAnswer.trim()) return true;
                const countryItems = r.countryData?.sections?.flatMap((s) => s.items) ?? [];
                const searchLower = searchAnswer.toLowerCase();

                return countryItems.some((item) => (
                    (item.question?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.answer?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.notes?.toLowerCase?.().includes(searchLower) ?? false)
                ));
            }),
        [
            baseRows,
            regionFilter,
            countryFilter,
            ifrcLegalStatusFilter,
            cargoExemptionsFilter,
            searchCountry,
            searchAnswer,
        ],
    );

    const columns = useMemo(
        () => ([
            createStringColumn<MatrixRow, number>(
                'region',
                'Region',
                (item) => item.region,
                { sortable: true },
            ),
            createStringColumn<MatrixRow, number>(
                'country',
                'Country',
                (item) => item.country,
                { sortable: true },
            ),
            createStringColumn<MatrixRow, number>(
                'ifrcLegalStatus',
                'IFRC legal status',
                (item) => item.ifrcLegalStatus,
                { sortable: true },
            ),
            createStringColumn<MatrixRow, number>(
                'humanitarianCargoExemptions',
                'Humanitarian cargo exemptions',
                (item) => item.humanitarianCargoExemptions,
                { sortable: true },
            ),
            createStringColumn<MatrixRow, number>(
                'detailsLabel',
                'Details',
                (item) => item.detailsLabel,
                { sortable: false },
            ),
            createStringColumn<MatrixRow, number>(
                'lastUpdated',
                'Last updated',
                (item) => item.lastUpdated,
                { sortable: true },
            ),
        ]),
        [],
    );

    const sortedData = useMemo(() => {
        if (!sortState.sorting) {
            return rows;
        }

        const columnToSort = columns.find((c) => c.id === sortState.sorting?.name);

        type ColumnWithComparator = {
            valueComparator?: (a: MatrixRow, b: MatrixRow) => number;
        };

        const comparator = (columnToSort as ColumnWithComparator | undefined)?.valueComparator;

        if (!comparator) {
            return rows;
        }

        const sorted = [...rows].sort(comparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [rows, sortState.sorting, columns]);

    const DETAILS_COL_INDEX = 4;

    const handleTableClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;

        const cell = target.closest('td');
        if (!cell) {
            return;
        }

        const rowEl = target.closest('tr');
        if (!rowEl || rowEl.querySelector('th')) {
            return;
        }

        const cellIndex = Array.from(rowEl.children).indexOf(cell);
        if (cellIndex !== DETAILS_COL_INDEX) {
            return;
        }

        const parent = rowEl.parentElement;
        if (!parent) {
            return;
        }

        const rowIndex = Array.from(parent.children).indexOf(rowEl);
        if (rowIndex < 0 || rowIndex >= sortedData.length) {
            return;
        }

        const clickedRow = sortedData[rowIndex];
        if (clickedRow?.countryData) {
            setSelectedCountry(clickedRow.countryData);
        }
    }, [sortedData]);

    const clearAllFilters = useCallback(() => {
        setRegionFilter('');
        setCountryFilter('');
        setIfrcLegalStatusFilter('');
        setCargoExemptionsFilter('');
        setSearchCountry('');
        setSearchAnswer('');
    }, []);

    const anyFilters = !!regionFilter
        || !!countryFilter
        || !!ifrcLegalStatusFilter
        || !!cargoExemptionsFilter
        || !!searchCountry
        || !!searchAnswer;

    return (
        <Container className={styles.container}>
            <div className={styles.content}>
                <div className={styles.mapFilters}>
                    <SelectInput
                        name="region"
                        label="Region"
                        options={regionOptions}
                        keySelector={(o: Option) => o.key}
                        labelSelector={(o: Option) => o.label}
                        value={regionFilter}
                        onChange={(value) => setRegionFilter(value ?? '')}
                    />
                    <SelectInput
                        name="countryFilter"
                        label="Country"
                        options={countryOptions}
                        keySelector={(o: Option) => o.key}
                        labelSelector={(o: Option) => o.label}
                        value={countryFilter}
                        onChange={(value) => setCountryFilter(value ?? '')}
                    />
                    <SelectInput
                        name="ifrcLegalStatusFilter"
                        label="IFRC legal status"
                        options={legalStatusOptions}
                        keySelector={(o: Option) => o.key}
                        labelSelector={(o: Option) => o.label}
                        value={ifrcLegalStatusFilter}
                        onChange={(value) => setIfrcLegalStatusFilter(value ?? '')}
                    />
                    <SelectInput
                        name="cargoExemptionsFilter"
                        label="Cargo exemptions"
                        options={cargoOptions}
                        keySelector={(o: Option) => o.key}
                        labelSelector={(o: Option) => o.label}
                        value={cargoExemptionsFilter}
                        onChange={(value) => setCargoExemptionsFilter(value ?? '')}
                    />

                    <Button
                        name={undefined}
                        onClick={clearAllFilters}
                        disabled={!anyFilters}
                        className={styles.clearFiltersBtn}
                    >
                        Clear Filters
                    </Button>
                </div>

                <CustomsRegulationsMap
                    key={`${regionFilter}|${countryFilter}|${ifrcLegalStatusFilter}|${rowsForMap.length}`}
                    rows={rowsForMap}
                />

                <div className={styles.searchSection}>
                    <div className={styles.searchContainer}>
                        <div className={styles.searchField}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label htmlFor="searchCountry" className={styles.searchLabel}>
                                Country
                            </label>
                            <TextInput
                                name="searchCountry"
                                value={searchCountry}
                                onChange={handleSearchCountryChange}
                                placeholder="Search countries..."
                            />
                        </div>
                        <div className={styles.searchField}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label htmlFor="searchAnswer" className={styles.searchLabel}>
                                Content
                            </label>
                            <TextInput
                                name="searchAnswer"
                                value={searchAnswer}
                                onChange={handleSearchAnswerChange}
                                placeholder="Search content..."
                            />
                        </div>
                    </div>

                    <div className={styles.searchActions}>
                        <Button
                            name={undefined}
                            onClick={() => {
                                setSearchCountry('');
                                setSearchAnswer('');
                            }}
                            disabled={!searchCountry && !searchAnswer}
                        >
                            Clear Filters
                        </Button>
                        <div className={styles.resultCount}>
                            {sortedData.length}
                            {' '}
                            result
                            {sortedData.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>

                <div
                    className={styles.tableSurface}
                    onClick={handleTableClick}
                    role="presentation"
                >
                    <SortContext.Provider value={sortState}>
                        <Table
                            data={sortedData}
                            keySelector={numericIdSelector}
                            columns={columns}
                            pending={pending}
                            filtered={false}
                        />
                    </SortContext.Provider>
                </div>
            </div>

            <DetailModal
                countryData={selectedCountry}
                onClose={() => setSelectedCountry(undefined)}
            />
        </Container>
    );
}

/** @knipignore */
// eslint-disable-next-line import/prefer-default-export
export function Component() {
    return <CustomRegulationsMatrix />;
}

Component.displayName = 'SparkCustomRegulations';
