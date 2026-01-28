import {
    useCallback,
    useMemo,
    useState,
} from 'react';
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

const QUESTION_COLUMNS = [
    'Who is the competent authority for customs clearance of humanitarian goods?',
    'Is pre-authorization required for importation of key health items?',
    'Are there specific government agencies involved beyond customs?',
    'Are import permits required for health items? List authority and time to obtain.',
    'List health items requiring special importation steps (PPE, vaccines, etc.):',
    'What are the main customs entry points (airports/seaports/land borders)?',
    'Can IFRC or NS act as consignee/importer of record?',
    'Are there import restrictions on any medical/health items?',
    'Are there exemptions for humanitarian cargo (duty/VAT)? Legal framework?',
    'What documents are required for customs clearance?',
    'Typical clearance timeframe (in days):',
    'Are there fast-track or humanitarian clearance procedures? Describe.',
    'Are vaccines subject to special import licenses?',
    'Is WHO prequalification accepted for imported vaccines?',
    'Are there national cold chain handling standards?',
    'Customs/health clearance procedures for temperature-sensitive goods:',
    'Are customs facilities with cold storage available at entry points?',
    'Are Ebola-related items subject to restrictions?',
    'Is there a fast-track mechanism for outbreak response items?',
    'Any prior IFRC Ebola-related imports? Challenges/lessons?',
] as const;

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
    country: string;
    countryData?: CountryRegulation;
    [key: string]: string | number | undefined | CountryRegulation;
}

function getAnswerForQuestion(question: string, allItems: RegulationItem[]): string {
    const qLower = question.toLowerCase().trim();
    const item = allItems.find((it) => it.question.toLowerCase().trim() === qLower);
    return item?.answer?.trim() ?? '';
}

interface DetailModalProps {
    countryData?: CountryRegulation;
    onClose: () => void;
}

function DetailModal({ countryData, onClose }: DetailModalProps) {
    const [modalSearch, setModalSearch] = useState<string>('');

    if (!countryData) {
        return null;
    }

    // Filter sections and items based on search
    const filteredSections = countryData.sections?.map((section) => {
        const filteredItems = section.items?.filter((item) => {
            if (!modalSearch?.trim()) {
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
            heading={`Regulations — ${countryData.country}`}
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
                onChange={setModalSearch}
                placeholder="Search questions and answers..."
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
                                        {item.answer?.trim() || '—'}
                                    </div>
                                    {item.notes?.trim() && (
                                        <div className={styles.notes}>
                                            <div className={styles.notesLabel}>Notes:</div>
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
                if (!searchCountry) return true;
                return c.country?.toLowerCase?.().includes(searchCountry.toLowerCase()) ?? false;
            })
            .filter((c) => {
                if (!searchAnswer?.trim()) {
                    return true;
                }
                const countryItems = c.sections?.flatMap((s) => s.items) ?? [];
                return countryItems.some((item) => item.answer?.toLowerCase?.().includes(searchAnswer.toLowerCase()) ?? false);
            })
            .map((country, index) => {
                const row: MatrixRow = {
                    id: index + 1,
                    country: country.country,
                    countryData: country,
                };

                const countryItems = country.sections?.flatMap((s) => s.items) ?? [];

                QUESTION_COLUMNS.forEach((question) => {
                    const answer = getAnswerForQuestion(question, countryItems);
                    const key = `q_${question
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_+|_+$/g, '')}`;
                    row[key] = answer;
                });

                return row;
            }),
        [countries, searchCountry, searchAnswer],
    );

    const columns = useMemo(
        () => {
            const countryCol = createStringColumn<MatrixRow, number>(
                'country',
                'Country',
                (item) => item.country,
                { sortable: true },
            );

            const questionCols = QUESTION_COLUMNS.map((question) => {
                const key = `q_${question
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '')}`;
                return createStringColumn<MatrixRow, number>(
                    key,
                    question,
                    (item) => (item[key] as string) ?? '',
                    { sortable: true },
                );
            });

            return [countryCol, ...questionCols];
        },
        [],
    );

    const sortedData = useMemo(() => {
        if (!sortState.sorting) {
            return rows;
        }

        const columnToSort = columns.find((c) => c.id === sortState.sorting?.name);
        if (!columnToSort?.valueComparator) {
            return rows;
        }

        const sorted = [...rows].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [rows, sortState.sorting, columns]);

    const handleTableClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const tableRow = target.closest('tr');

        if (!tableRow) {
            return;
        }

        // Skip header rows (those containing th elements)
        if (tableRow.querySelector('th') !== null) {
            return;
        }

        const rowIndex = Array.from(tableRow.parentElement?.children ?? []).indexOf(tableRow);
        if (rowIndex >= 0 && rowIndex < sortedData.length) {
            const clickedRow = sortedData[rowIndex];
            if (clickedRow.countryData) {
                setSelectedCountry(clickedRow.countryData);
            }
        }
    }, [sortedData]);

    return (
        <Container className={styles.container}>
            <div className={styles.searchSection}>
                <div className={styles.searchContainer}>
                    <div className={styles.searchField}>
                        <label htmlFor="searchCountry" className={styles.searchLabel}>
                            Country
                        </label>
                        <TextInput
                            name="searchCountry"
                            value={searchCountry}
                            onChange={setSearchCountry}
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
                            onChange={setSearchAnswer}
                            placeholder="Search answers..."
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
                className={styles.tableContainer}
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
