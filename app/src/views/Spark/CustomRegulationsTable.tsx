import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    Container,
    SelectInput,
    TextInput,
    Button,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';
import {
    isDefined,
    unique,
} from '@togglecorp/fujs';

import useFilterState from '#hooks/useFilterState';
import { useRequest } from '#utils/restRequest';
import styles from './CustomRegulationsTable.module.css';

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
    metadata?: Record<string, unknown>;
    countries: CountryRegulation[];
}

interface Row {
    id: number;
    country: string;
    section: string;
    question: string;
    answer: string;
    notes?: string;
}

function CustomRegulationsTable() {
    const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
    const [filterSection, setFilterSection] = useState<string | undefined>();
    const [searchText, setSearchText] = useState<string | undefined>();

    const { sortState } = useFilterState({ filter: {} });

    const { pending, response } = useRequest({
        url: '/api/v2/country-regulations/',
    } as any);

    const data = response as RegulationsApiResponse | undefined;
    const countries = data?.countries ?? [];

    const countryOptions = useMemo(() => {
        const names = countries.map((c) => c.country).filter(isDefined);
        const uniqueNames = unique(names, (n) => n).sort();
        return uniqueNames.map((name) => ({ key: name, label: name }));
    }, [countries]);

    // Optional: auto-select first country when data loads
    useMemo(() => {
        if (!selectedCountry && countryOptions.length > 0) {
            setSelectedCountry(countryOptions[0].key);
        }
        return undefined;
    }, [countryOptions, selectedCountry]);

    const selectedCountryData = useMemo(
        () => countries.find((c) => c.country === selectedCountry),
        [countries, selectedCountry],
    );

    const sectionOptions = useMemo(() => {
        const sections = selectedCountryData?.sections?.map((s) => s.section).filter(isDefined) ?? [];
        const uniqueSections = unique(sections, (s) => s).sort();
        return uniqueSections.map((s) => ({ key: s, label: s }));
    }, [selectedCountryData]);

    // Reset section filter when switching country
    useMemo(() => {
        setFilterSection(undefined);
        return undefined;
    }, [selectedCountry]);

    const tableData: Row[] = useMemo(() => {
        const rows: Row[] = [];
        let id = 1;

        if (!selectedCountryData) {
            return rows;
        }

        selectedCountryData.sections?.forEach((section) => {
            section.items?.forEach((item) => {
                rows.push({
                    id,
                    country: selectedCountryData.country,
                    section: section.section,
                    question: item.question,
                    answer: item.answer,
                    notes: item.notes,
                });
                id += 1;
            });
        });

        return rows;
    }, [selectedCountryData]);

    const filteredData = useMemo(() => {
        let filtered = tableData;

        if (filterSection) {
            filtered = filtered.filter((row) => row.section === filterSection);
        }

        if (searchText) {
            const q = searchText.toLowerCase();
            filtered = filtered.filter((row) => (
                row.section?.toLowerCase().includes(q)
                || row.question?.toLowerCase().includes(q)
                || row.answer?.toLowerCase().includes(q)
                || row.notes?.toLowerCase().includes(q)
            ));
        }

        return filtered;
    }, [tableData, filterSection, searchText]);

    const columns = useMemo(() => ([
        createStringColumn<Row, number>(
            'section',
            'Section',
            (item) => item.section,
            { sortable: true },
        ),
        createStringColumn<Row, number>(
            'question',
            'Question',
            (item) => item.question,
            { sortable: true },
        ),
        createStringColumn<Row, number>(
            'answer',
            'Answer',
            (item) => item.answer,
        ),
        createStringColumn<Row, number>(
            'notes',
            'Notes',
            (item) => item.notes ?? '',
        ),
    ]), []);

    const sortedData = useMemo(() => {
        if (!sortState.sorting) {
            return filteredData;
        }

        const columnToSort = columns.find((c) => c.id === sortState.sorting?.name);
        if (!columnToSort?.valueComparator) {
            return filteredData;
        }

        const sorted = [...filteredData].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [filteredData, sortState.sorting, columns]);

    const stringKeySelector = useCallback((option: { key: string }) => option.key, []);
    const stringLabelSelector = useCallback((option: { label: string }) => option.label, []);

    const handleClear = useCallback(() => {
        setSearchText(undefined);
        setFilterSection(undefined);
    }, []);

    return (
        <Container>
            <div className={styles.filters}>
                <SelectInput
                    label="Country"
                    placeholder="Select a country"
                    name={undefined}
                    value={selectedCountry}
                    onChange={setSelectedCountry}
                    options={countryOptions}
                    keySelector={stringKeySelector}
                    labelSelector={stringLabelSelector}
                />
                <SelectInput
                    label="Section"
                    placeholder="All sections"
                    name={undefined}
                    value={filterSection}
                    onChange={setFilterSection}
                    options={sectionOptions}
                    keySelector={stringKeySelector}
                    labelSelector={stringLabelSelector}
                    disabled={!selectedCountry}
                />
                <TextInput
                    label="Search"
                    placeholder="Search in section/question/answer/notes"
                    name={undefined}
                    value={searchText}
                    onChange={setSearchText}
                />
                {(searchText || filterSection) && (
                    <Button name={undefined} onClick={handleClear}>
                        Clear
                    </Button>
                )}
            </div>

            <div className={styles.tableContainer}>
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
        </Container>
    );
}

export default CustomRegulationsTable;
