/* eslint-disable max-len */

import {
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Button,
    Container,
    MultiSelectInput,
    SelectInput,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import { createStringColumn } from '@ifrc-go/ui/utils';

import useFilterState from '#hooks/useFilterState';

import styles from './FrameworkAgreementsTable.module.css';

interface FrameworkAgreement {
    fa_number: string;
    supplier_name: string;
    pa_type: string;
    pa_bu_region_name: string;
    pa_bu_country_name: string;
    pa_line_product_type: string;
    pa_line_procurement_category: string;
    pa_line_item_name: string;
    pa_effective_date_fa_start_date: string;
    pa_expiration_date_fa_end_date: string;
    supplier_country: string;
    pa_workflow_status: string;
    pa_status: string;
    fa_geographical_coverage: string;
    item_service_short_description: string;
}

// Data transformation types for pre-built components
interface SelectOption {
    id: string;
    name: string;
}

interface MultiSelectOption {
    id: string;
    name: string;
}

interface Props {
    data: FrameworkAgreement[];
    pending?: boolean;
    selectedCountry?: string;
}

function FrameworkAgreementsTable({ data, pending = false, selectedCountry }: Props) {
    const { sortState } = useFilterState({ filter: {} });
    const triStateSort = useMemo(() => ({
        sorting: sortState.sorting,
        setSorting: (value: SetStateAction<{ name: string; direction: 'asc' | 'dsc' } | undefined>) => {
            const proposed = typeof value === 'function' ? value(sortState.sorting) : value;
            let finalValue = proposed;
            if (proposed && sortState.sorting && proposed.name === sortState.sorting.name) {
                // Cycle: asc -> dsc -> undefined
                if (sortState.sorting.direction === 'dsc' && proposed.direction === 'asc') {
                    finalValue = undefined;
                }
            }
            sortState.setSorting(finalValue);
        },
    }), [sortState.sorting, sortState.setSorting]);

    // Track the previous selectedCountry to only set sort when it changes
    const prevSelectedCountryRef = useRef<string | undefined>(selectedCountry);

    // When a country is selected (and only when it changes), automatically sort by
    // FA Geographical Coverage (descending) so Local agreements appear first
    useEffect(() => {
        if (selectedCountry && prevSelectedCountryRef.current !== selectedCountry) {
            sortState.setSorting({ name: 'fa_geographical_coverage', direction: 'dsc' });
        }
        prevSelectedCountryRef.current = selectedCountry;
    }, [selectedCountry, sortState]);

    // Filter state
    const [selectedRegion, setSelectedRegion] = useState<string | undefined>(undefined);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedItemCategory, setSelectedItemCategory] = useState<string | undefined>(undefined);
    const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [showFilters, setShowFilters] = useState(true);

    // Slider state - temporary values while dragging
    const [tempStartDate, setTempStartDate] = useState<string>('');
    const [tempEndDate, setTempEndDate] = useState<string>('');

    // Keyselectors and labelselectors for pre-built components
    const selectOptionKeySelector = useCallback(
        (option: SelectOption) => option.id,
        [],
    );
    const selectOptionLabelSelector = useCallback(
        (option: SelectOption) => option.name,
        [],
    );
    const multiSelectOptionKeySelector = useCallback(
        (option: MultiSelectOption) => option.id,
        [],
    );
    const multiSelectOptionLabelSelector = useCallback(
        (option: MultiSelectOption) => option.name,
        [],
    );

    // Extract unique values for filters and transform to component format
    const regions = useMemo(() => {
        const uniqueRegions = new Set(data.map((d) => d.pa_bu_region_name).filter(Boolean));
        return Array.from(uniqueRegions)
            .sort()
            .map((name) => ({ id: name, name }));
    }, [data]);

    const countriesByRegion = useMemo(() => {
        const map = new Map<string, Set<string>>();
        data.forEach((item) => {
            if (!item.pa_bu_region_name || !item.pa_bu_country_name) return;
            if (!map.has(item.pa_bu_region_name)) {
                map.set(item.pa_bu_region_name, new Set());
            }
            map.get(item.pa_bu_region_name)?.add(item.pa_bu_country_name);
        });

        const result = new Map<string, SelectOption[]>();
        map.forEach((countries, region) => {
            result.set(region, Array.from(countries)
                .sort()
                .map((name) => ({ id: name, name })));
        });
        return result;
    }, [data]);

    const availableCountries = useMemo(() => {
        if (!selectedRegion) {
            const allCountries = new Set(
                data.map((d) => d.pa_bu_country_name).filter(Boolean),
            );
            return Array.from(allCountries)
                .sort()
                .map((name) => ({ id: name, name }));
        }
        return countriesByRegion.get(selectedRegion) || [];
    }, [selectedRegion, data, countriesByRegion]);

    const itemCategories = useMemo(() => {
        const uniqueCategories = new Set(
            data.map((d) => d.pa_line_procurement_category).filter(Boolean),
        );
        return Array.from(uniqueCategories)
            .sort()
            .map((name) => ({ id: name, name }));
    }, [data]);

    const itemNamesByCategory = useMemo(() => {
        const filteredByCategory = selectedItemCategory
            ? data.filter((d) => d.pa_line_procurement_category === selectedItemCategory)
            : data;

        const uniqueNames = new Set(
            filteredByCategory.map((d) => d.pa_line_item_name).filter(Boolean),
        );
        return Array.from(uniqueNames)
            .sort()
            .map((name) => ({ id: name, name }));
    }, [selectedItemCategory, data]);

    // Calculate min and max dates from data
    const { minDate, maxDate } = useMemo(() => {
        let min = '9999-12-31';
        let max = '0000-01-01';

        data.forEach((item) => {
            if (item.pa_effective_date_fa_start_date
                && item.pa_effective_date_fa_start_date < min) {
                min = item.pa_effective_date_fa_start_date;
            }
            if (item.pa_expiration_date_fa_end_date && item.pa_expiration_date_fa_end_date > max) {
                max = item.pa_expiration_date_fa_end_date;
            }
        });

        return { minDate: min, maxDate: max };
    }, [data]);

    // Initialize temp dates from applied dates or use full range
    useEffect(() => {
        if (!tempStartDate && !tempEndDate) {
            setTempStartDate(startDate || minDate);
            setTempEndDate(endDate || maxDate);
        }
    }, [minDate, maxDate, startDate, endDate, tempStartDate, tempEndDate]);

    // Apply all filters with AND logic
    const filteredData = useMemo(() => data.filter((item) => {
        // Map filter: if a country is selected on the map
        if (selectedCountry) {
            const isGlobal = item.fa_geographical_coverage?.toLowerCase() === 'global';
            const isLocal = item.fa_geographical_coverage?.toLowerCase() === 'local';
            const matchesCountry = item.pa_bu_country_name?.toLowerCase() === selectedCountry.toLowerCase();

            // Show Global agreements always, or Local agreements for the selected country
            const matchesMapSelection = isGlobal || (isLocal && matchesCountry);
            if (!matchesMapSelection) {
                return false;
            }
        }

        const matchesRegion = !selectedRegion
            || item.pa_bu_region_name === selectedRegion;
        const matchesCountry = selectedCountries.length === 0
            || selectedCountries.includes(item.pa_bu_country_name);
        const matchesCategory = !selectedItemCategory
            || item.pa_line_procurement_category === selectedItemCategory;
        const matchesItemName = selectedItemNames.length === 0
            || selectedItemNames.includes(item.pa_line_item_name);

        const itemStartDate = new Date(item.pa_effective_date_fa_start_date);
        const itemEndDate = new Date(item.pa_expiration_date_fa_end_date);
        const filterStartDate = startDate ? new Date(startDate) : null;
        const filterEndDate = endDate ? new Date(endDate) : null;

        const matchesStartDate = !filterStartDate || itemEndDate >= filterStartDate;
        const matchesEndDate = !filterEndDate || itemStartDate <= filterEndDate;

        return matchesRegion && matchesCountry && matchesCategory && matchesItemName
            && matchesStartDate && matchesEndDate;
    }), [data, selectedCountry, selectedRegion, selectedCountries, selectedItemCategory,
        selectedItemNames, startDate, endDate]);

    // When region changes, reset countries
    useEffect(() => {
        setSelectedCountries([]);
    }, [selectedRegion]);

    // When category changes, reset item names
    useEffect(() => {
        setSelectedItemNames([]);
    }, [selectedItemCategory]);

    // Pagination
    const rowsPerPage = 1000;
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const [currentPage, setCurrentPage] = useState(0);

    const displayedPages = useMemo(() => {
        if (totalPages <= 1) {
            return totalPages === 1 ? [0] : [];
        }

        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_val, index) => index);
        }

        const windowSize = 5;
        const half = Math.floor(windowSize / 2);

        let start = Math.max(1, currentPage - half);
        let end = Math.min(totalPages - 2, currentPage + half);

        const visibleCount = end - start + 1;
        if (visibleCount < windowSize) {
            const missing = windowSize - visibleCount;
            if (start === 1) {
                end = Math.min(totalPages - 2, end + missing);
            } else if (end === totalPages - 2) {
                start = Math.max(1, start - missing);
            }
        }

        const pages = new Set<number>([0, totalPages - 1]);
        for (let page = start; page <= end; page += 1) {
            pages.add(page);
        }

        return Array.from(pages).sort((a, b) => a - b);
    }, [currentPage, totalPages]);

    const columns = useMemo(
        () => [
            createStringColumn(
                'fa_number',
                'FA Number',
                (item: FrameworkAgreement) => item.fa_number,
                { sortable: true },
            ),
            createStringColumn(
                'supplier_name',
                'Supplier Name',
                (item: FrameworkAgreement) => item.supplier_name,
                { sortable: true },
            ),
            createStringColumn(
                'pa_type',
                'PA Type',
                (item: FrameworkAgreement) => item.pa_type,
                { sortable: true },
            ),
            createStringColumn(
                'pa_bu_region_name',
                'PA BU Region Name',
                (item: FrameworkAgreement) => item.pa_bu_region_name,
                { sortable: true },
            ),
            createStringColumn(
                'pa_line_product_type',
                'PA Line Product Type',
                (item: FrameworkAgreement) => item.pa_line_product_type,
                { sortable: true },
            ),
            createStringColumn(
                'pa_line_procurement_category',
                'PA Line Procurement Category',
                (item: FrameworkAgreement) => item.pa_line_procurement_category,
                { sortable: true },
            ),
            createStringColumn(
                'pa_effective_date_fa_start_date',
                'PA Effective Date',
                (item: FrameworkAgreement) => item.pa_effective_date_fa_start_date,
                { sortable: true },
            ),
            createStringColumn(
                'pa_expiration_date_fa_end_date',
                'PA Expiration Date',
                (item: FrameworkAgreement) => item.pa_expiration_date_fa_end_date,
                { sortable: true },
            ),
            createStringColumn(
                'supplier_country',
                'Supplier Country',
                (item: FrameworkAgreement) => item.supplier_country,
                { sortable: true },
            ),
            createStringColumn(
                'pa_status',
                'PA Status',
                (item: FrameworkAgreement) => item.pa_status,
                { sortable: true },
            ),
            createStringColumn(
                'item_service_short_description',
                'Item / Service Short Description',
                (item: FrameworkAgreement) => item.item_service_short_description,
                { sortable: true },
            ),
            createStringColumn(
                'pa_bu_country_name',
                'PA BU Country Name',
                (item: FrameworkAgreement) => item.pa_bu_country_name,
                { sortable: true },
            ),
            createStringColumn(
                'fa_geographical_coverage',
                'FA Geographical Coverage',
                (item: FrameworkAgreement) => item.fa_geographical_coverage,
                { sortable: true },
            ),
        ],
        [],
    );

    const sortedData = useMemo(() => {
        if (!sortState.sorting) {
            return filteredData;
        }

        const columnToSort = columns.find((column) => column.id === sortState.sorting?.name);
        if (!columnToSort?.valueComparator) {
            return filteredData;
        }

        const sorted = [...filteredData].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [filteredData, sortState.sorting, columns]);

    const paginatedData = sortedData.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage,
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(0);
    }, [filteredData]);

    return (
        <Container>
            <div className={styles.filterSection}>
                <div className={styles.filterHeader}>
                    <h3>Filter Framework Agreements</h3>
                    <Button
                        name="toggleFilters"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </Button>
                </div>

                {showFilters && (
                    <div className={styles.filtersContainer}>
                        <div className={styles.filterGroup}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label>FA Coverage Region</label>
                            <SelectInput
                                className={styles.selectInputWrapper}
                                name="region"
                                value={selectedRegion}
                                options={regions}
                                keySelector={selectOptionKeySelector}
                                labelSelector={selectOptionLabelSelector}
                                onChange={(value) => setSelectedRegion(value)}
                                disabled={pending}
                                placeholder="Select region..."
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label>Country</label>
                            <MultiSelectInput
                                className={styles.multiSelectInputWrapper}
                                name="countries"
                                value={selectedCountries}
                                options={availableCountries}
                                keySelector={multiSelectOptionKeySelector}
                                labelSelector={multiSelectOptionLabelSelector}
                                onChange={(values) => setSelectedCountries(values)}
                                disabled={pending}
                                placeholder="Select countries..."
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label>Item Category</label>
                            <SelectInput
                                className={styles.selectInputWrapper}
                                name="category"
                                value={selectedItemCategory}
                                options={itemCategories}
                                keySelector={selectOptionKeySelector}
                                labelSelector={selectOptionLabelSelector}
                                onChange={(value) => setSelectedItemCategory(value)}
                                disabled={pending}
                                placeholder="Select item category..."
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label>Item Name</label>
                            <MultiSelectInput
                                className={styles.multiSelectInputWrapper}
                                name="itemNames"
                                value={selectedItemNames}
                                options={itemNamesByCategory}
                                keySelector={multiSelectOptionKeySelector}
                                labelSelector={multiSelectOptionLabelSelector}
                                onChange={(values) => setSelectedItemNames(values)}
                                disabled={pending}
                                placeholder="Select item names..."
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label>Effective Date Range</label>
                            <div className={styles.dateRangeDisplay}>
                                {tempStartDate ? new Date(tempStartDate).toLocaleDateString() : 'Start'}
                                {' '}
                                —
                                {tempEndDate ? new Date(tempEndDate).toLocaleDateString() : 'End'}
                            </div>
                            <div className={styles.rangeSliderContainer}>
                                <div className={styles.rangeTrackBase} />
                                <div
                                    className={styles.rangeTrackFill}
                                    style={{
                                        left: `${tempStartDate && tempEndDate
                                            ? ((new Date(tempStartDate).getTime()
                                                - new Date(minDate).getTime())
                                                / (new Date(maxDate).getTime()
                                                    - new Date(minDate).getTime())) * 100
                                            : 0}%`,
                                        width: `${tempStartDate && tempEndDate ? ((new Date(tempEndDate).getTime() - new Date(tempStartDate).getTime()) / (new Date(maxDate).getTime() - new Date(minDate).getTime())) * 100 : 100}%`,
                                    }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={(((new Date(tempStartDate || minDate).getTime()
                                        - new Date(minDate).getTime())
                                        / (new Date(maxDate).getTime()
                                            - new Date(minDate).getTime())) * 100)}
                                    onChange={(e) => {
                                        const percent = parseFloat(e.target.value);
                                        const totalMs = new Date(maxDate).getTime()
                                            - new Date(minDate).getTime();
                                        const newStartMs = new Date(minDate).getTime()
                                            + ((totalMs * percent) / 100);
                                        const newStart = new Date(newStartMs)
                                            .toISOString().split('T')[0];
                                        if (newStart && newStart <= tempEndDate) {
                                            setTempStartDate(newStart);
                                        }
                                    }}
                                    disabled={pending}
                                    className={styles.rangeSliderStart}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={(((new Date(tempEndDate || maxDate).getTime()
                                        - new Date(minDate).getTime())
                                        / (new Date(maxDate).getTime()
                                            - new Date(minDate).getTime())) * 100)}
                                    onChange={(e) => {
                                        const percent = parseFloat(e.target.value);
                                        const totalMs = new Date(maxDate).getTime()
                                            - new Date(minDate).getTime();
                                        const newEndMs = new Date(minDate).getTime()
                                            + ((totalMs * percent) / 100);
                                        const newEnd = new Date(newEndMs)
                                            .toISOString().split('T')[0];
                                        if (newEnd && newEnd >= tempStartDate) {
                                            setTempEndDate(newEnd);
                                        }
                                    }}
                                    disabled={pending}
                                    className={styles.rangeSliderEnd}
                                />
                            </div>
                            <Button
                                type="button"
                                name="applyDateFilter"
                                onClick={() => {
                                    setStartDate(tempStartDate);
                                    setEndDate(tempEndDate);
                                }}
                                disabled={pending}
                            >
                                Apply Date Range
                            </Button>
                        </div>
                    </div>
                )}

                <p className={styles.resultCount}>
                    Showing
                    {' '}
                    {paginatedData.length}
                    {' '}
                    of
                    {' '}
                    {filteredData.length}
                    {' '}
                    results
                </p>
            </div>

            <div className={styles.tableContainer}>
                <SortContext.Provider value={triStateSort}>
                    <Table
                        data={paginatedData}
                        keySelector={(_row, index) => index}
                        columns={columns}
                        pending={pending}
                        filtered={false}
                    />
                </SortContext.Provider>
            </div>
            {totalPages > 0 && (
                <div className={styles.paginationContainer}>
                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                        disabled={pending || currentPage === 0}
                        aria-label="Previous page"
                    >
                        &lt;
                    </button>

                    {displayedPages.map((page, index) => {
                        const previousPage = displayedPages[index - 1];
                        const showEllipsis = index > 0 && previousPage !== undefined && page - previousPage > 1;

                        return (
                            <span key={page} className={styles.pageWrapper}>
                                {showEllipsis && (
                                    <span className={styles.pageEllipsis} aria-hidden>
                                        …
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(page)}
                                    className={page === currentPage
                                        ? styles.pageButtonActive
                                        : styles.pageButton}
                                    disabled={pending}
                                    aria-label={`Page ${page + 1}`}
                                    aria-current={page === currentPage ? 'page' : undefined}
                                >
                                    {page + 1}
                                </button>
                            </span>
                        );
                    })}

                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                        disabled={pending || currentPage >= totalPages - 1}
                        aria-label="Next page"
                    >
                        &gt;
                    </button>
                </div>
            )}
        </Container>
    );
}

export default FrameworkAgreementsTable;
