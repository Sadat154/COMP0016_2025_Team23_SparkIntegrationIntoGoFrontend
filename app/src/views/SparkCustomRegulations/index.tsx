import React, { useMemo, useState, useCallback } from 'react';
import {
    Button,
    Container,
    Modal,
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
    ifrcLegalStatus: string;
    humanitarianCargoExemptions: string;
    detailsLabel: string;
    lastUpdated: string;
    countryData?: CountryRegulation;
}

const IFRC_LEGAL_STATUS_QUESTION = 'Is there an existing status agreement for IFRC in the country?';
const HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION = 'Are there exemptions for humanitarian cargo (duty/VAT)? Legal framework?';

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

function CustomRegulationsMatrix() {
    const { sortState } = useFilterState({ filter: {} });
    const [selectedCountry, setSelectedCountry] = useState<CountryRegulation | undefined>();
    const [searchCountry, setSearchCountry] = useState<string>('');
    const [searchAnswer, setSearchAnswer] = useState<string>('');

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

    const rows: MatrixRow[] = useMemo(
        () => countries
            .filter((c) => c.country?.trim())
            .filter((c) => {
                if (!searchCountry.trim()) return true;
                return c.country?.toLowerCase?.().includes(searchCountry.toLowerCase()) ?? false;
            })
            .filter((c) => {
                if (!searchAnswer.trim()) return true;
                const countryItems = c.sections?.flatMap((s) => s.items) ?? [];
                const searchLower = searchAnswer.toLowerCase();

                return countryItems.some((item) => (
                    (item.question?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.answer?.toLowerCase?.().includes(searchLower) ?? false)
                    || (item.notes?.toLowerCase?.().includes(searchLower) ?? false)
                ));
            })
            .map((country, index) => {
                const countryItems = country.sections?.flatMap((s) => s.items) ?? [];

                return {
                    id: index + 1,
                    region: 'N/A',
                    country: toTitleCase(country.country ?? ''),
                    ifrcLegalStatus: (
                        getAnswerForQuestion(IFRC_LEGAL_STATUS_QUESTION, countryItems)
                            ? toTitleCase(getAnswerForQuestion(IFRC_LEGAL_STATUS_QUESTION, countryItems))
                            : 'N/A'
                    ),
                    humanitarianCargoExemptions: (
                        getAnswerForQuestion(HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION, countryItems)
                            ? toTitleCase(getAnswerForQuestion(HUMANITARIAN_CARGO_EXEMPTIONS_QUESTION, countryItems))
                            : 'N/A'
                    ),
                    detailsLabel: 'More details',
                    lastUpdated: 'N/A',
                    countryData: country,
                };
            }),
        [countries, searchCountry, searchAnswer],
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comparator = (columnToSort as any)?.valueComparator as ((a: MatrixRow, b: MatrixRow) => number) | undefined;

        if (!comparator) {
            return rows;
        }

        const sorted = [...rows].sort(comparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [rows, sortState.sorting, columns]);

    // Row click logic, but ONLY allow opening modal when clicking "More details"
    const DETAILS_COL_INDEX = 4; // Region 0, Country 1, IFRC 2, Humanitarian 3, Details 4, Last updated 5

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
        if (clickedRow.countryData) {
            setSelectedCountry(clickedRow.countryData);
        }
    }, [sortedData]);


    return (
        <Container className={styles.container}>
            <div className={styles.content}>
                <div className={styles.searchSection}>
                    <div className={styles.searchContainer}>
                        <div className={styles.searchField}>
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
export function Component() {
    return <CustomRegulationsMatrix />;
}

Component.displayName = 'SparkCustomRegulations';
