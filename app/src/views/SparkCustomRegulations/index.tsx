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

import useFilterState from '#hooks/useFilterState';
import { useRequest } from '#utils/restRequest';

import CustomsRegulationsMap from './CustomsMap/CustomsRegulationsMap';
import type { Option } from './helpers';
import {
    buildNormalizedNameToIso3FromCountriesJson,
    getAnswerForQuestion,
    getCountryNameKeysForRegionMapping,
    normalizeName,
    normalizeYesNo,
    parseCsvLine,
    toTitleCase,
    uniqOptions,
} from './helpers';

import styles from './styles.module.css';

const COUNTRIES_JSON_URL = '/data/countries.json';

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
    searchableContent: string;
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

            const nameKeys = getCountryNameKeysForRegionMapping(name);
            const regionId = Number(regionRaw);
            const label = Number.isFinite(regionId)
                ? REGION_ID_TO_LABEL[regionId]
                : undefined;

            if (nameKeys.length > 0 && Number.isFinite(regionId) && label) {
                nameKeys.forEach((nameKey) => {
                    map.set(nameKey, label);
                });
            }
        }
    }

    return map;
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

    const filteredSections = useMemo(() => {
        if (!countryData) return [];
        const searchLower = modalSearch.trim().toLowerCase();

        return countryData.sections?.map((section) => {
            const filteredItems = section.items?.filter((item) => {
                if (!searchLower) {
                    return true;
                }
                return (item.question?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.answer?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.notes?.toLowerCase?.().includes(searchLower) ?? false);
            }) ?? [];
            return { ...section, items: filteredItems };
        }).filter((section) => section.items.length > 0) ?? [];
    }, [countryData, modalSearch]);

    if (!countryData) {
        return null;
    }

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
    const [countriesJsonData, setCountriesJsonData] = useState<unknown>(undefined);

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

    useEffect(() => {
        let mounted = true;
        fetch(COUNTRIES_JSON_URL, { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then((data) => {
                if (mounted) setCountriesJsonData(data);
            })
            .catch(() => {
                if (mounted) setCountriesJsonData(null);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const normalizedNameToIso3 = useMemo(() => {
        const mapFromJson = buildNormalizedNameToIso3FromCountriesJson(countriesJsonData);

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
    }, [countriesJsonData]);

    const baseRows: MatrixRow[] = useMemo(
        () => countries
            .filter((c) => c.country?.trim())
            .map((country, index) => {
                const normalizedCountryName = normalizeName(country.country);
                const countryItems = country.sections?.flatMap((s) => s.items) ?? [];
                const regionLabel = countryNameToRegionLabel.get(normalizedCountryName) ?? 'N/A';

                const legal = getAnswerForQuestion(IFRC_LEGAL_STATUS_QUESTION, countryItems);
                const cargo = getAnswerForQuestion(
                    HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION,
                    countryItems,
                );

                const iso3 = normalizedNameToIso3.get(normalizedCountryName) ?? undefined;
                const countryTitle = toTitleCase(country.country ?? '');
                const legalTitle = legal ? toTitleCase(legal) : 'N/A';
                const cargoTitle = cargo ? toTitleCase(cargo) : 'N/A';

                const searchableContent = countryItems
                    .map((item) => `${item.question ?? ''} ${item.answer ?? ''} ${item.notes ?? ''}`)
                    .join(' ')
                    .toLowerCase();

                return {
                    id: index + 1,
                    region: regionLabel,
                    country: countryTitle,
                    iso3,
                    ifrcLegalStatus: legalTitle,
                    humanitarianCargoExemptions: cargoTitle,
                    detailsLabel: 'More details',
                    lastUpdated: 'N/A',
                    searchableContent,
                    countryData: country,
                };
            }),
        [countries, countryNameToRegionLabel, normalizedNameToIso3],
    );

    const mapFilteredRows = useMemo(
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
    const rowsForMap = mapFilteredRows;

    const searchCountryLower = searchCountry.trim().toLowerCase();
    const searchAnswerLower = searchAnswer.trim().toLowerCase();

    // TABLE rows: all filters including cargo + text searches
    const rows: MatrixRow[] = useMemo(
        () => mapFilteredRows
            .filter((r) => (
                !cargoExemptionsFilter
                    ? true
                    : r.humanitarianCargoExemptions === cargoExemptionsFilter
            ))
            .filter((r) => {
                if (!searchCountryLower) return true;
                return r.country?.toLowerCase?.().includes(searchCountryLower) ?? false;
            })
            .filter((r) => {
                if (!searchAnswerLower) return true;
                return r.searchableContent.includes(searchAnswerLower);
            }),
        [
            mapFilteredRows,
            cargoExemptionsFilter,
            searchCountryLower,
            searchAnswerLower,
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
