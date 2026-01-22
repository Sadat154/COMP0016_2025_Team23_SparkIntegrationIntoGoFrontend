import {
    useMemo,
    useState,
    useEffect,
} from 'react';
import {
    Table,
    Container,
    Button,
    TextInput,
} from '@ifrc-go/ui';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';

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
    item_service_short_description: string;
}

interface Props {
    data: FrameworkAgreement[];
    pending?: boolean;
}

function FrameworkAgreementsTable({ data, pending = false }: Props) {
    // Filter state
    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedItemCategory, setSelectedItemCategory] = useState<string>('');
    const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [countrySearch, setCountrySearch] = useState<string>('');
    const [itemNameSearch, setItemNameSearch] = useState<string>('');
    const [showFilters, setShowFilters] = useState(true);
    const [expandedCountryFilter, setExpandedCountryFilter] = useState(false);
    const [expandedItemNameFilter, setExpandedItemNameFilter] = useState(false);
    
    // Slider state - temporary values while dragging
    const [tempStartDate, setTempStartDate] = useState<string>('');
    const [tempEndDate, setTempEndDate] = useState<string>('');

    // Close filters when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const filterSection = document.querySelector(`.${styles.filterSection}`);
            if (filterSection && !filterSection.contains(event.target as Node)) {
                setExpandedCountryFilter(false);
                setExpandedItemNameFilter(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extract unique values for filters
    const regions = useMemo(() => {
        const uniqueRegions = new Set(data.map(d => d.pa_bu_region_name).filter(Boolean));
        return Array.from(uniqueRegions).sort();
    }, [data]);

    const countriesByRegion = useMemo(() => {
        const map = new Map<string, Set<string>>();
        data.forEach(item => {
            if (!item.pa_bu_region_name || !item.pa_bu_country_name) return;
            if (!map.has(item.pa_bu_region_name)) {
                map.set(item.pa_bu_region_name, new Set());
            }
            map.get(item.pa_bu_region_name)?.add(item.pa_bu_country_name);
        });
        
        const result = new Map<string, string[]>();
        map.forEach((countries, region) => {
            result.set(region, Array.from(countries).sort());
        });
        return result;
    }, [data]);

    const availableCountries = useMemo(() => {
        if (!selectedRegion) {
            const allCountries = new Set(data.map(d => d.pa_bu_country_name).filter(Boolean));
            return Array.from(allCountries).sort();
        }
        return countriesByRegion.get(selectedRegion) || [];
    }, [selectedRegion, data, countriesByRegion]);

    const filteredCountriesBySearch = useMemo(() => {
        return availableCountries.filter(country =>
            country && country.toLowerCase().includes(countrySearch.toLowerCase())
        );
    }, [availableCountries, countrySearch]);

    const itemCategories = useMemo(() => {
        const uniqueCategories = new Set(data.map(d => d.pa_line_procurement_category).filter(Boolean));
        return Array.from(uniqueCategories).sort();
    }, [data]);

    const itemNamesByCategory = useMemo(() => {
        const filteredByCategory = selectedItemCategory
            ? data.filter(d => d.pa_line_procurement_category === selectedItemCategory)
            : data;
        
        const uniqueNames = new Set(filteredByCategory.map(d => d.pa_line_item_name).filter(Boolean));
        return Array.from(uniqueNames).sort();
    }, [selectedItemCategory, data]);

    const filteredItemNamesBySearch = useMemo(() => {
        return itemNamesByCategory.filter(name =>
            name && name.toLowerCase().includes(itemNameSearch.toLowerCase())
        );
    }, [itemNamesByCategory, itemNameSearch]);

    // Calculate min and max dates from data
    const { minDate, maxDate } = useMemo(() => {
        let min = '9999-12-31';
        let max = '0000-01-01';
        
        data.forEach(item => {
            if (item.pa_effective_date_fa_start_date && item.pa_effective_date_fa_start_date < min) {
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
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesRegion = !selectedRegion || item.pa_bu_region_name === selectedRegion;
            const matchesCountry = selectedCountries.length === 0 || selectedCountries.includes(item.pa_bu_country_name);
            const matchesCategory = !selectedItemCategory || item.pa_line_procurement_category === selectedItemCategory;
            const matchesItemName = selectedItemNames.length === 0 || selectedItemNames.includes(item.pa_line_item_name);
            
            const itemStartDate = new Date(item.pa_effective_date_fa_start_date);
            const itemEndDate = new Date(item.pa_expiration_date_fa_end_date);
            const filterStartDate = startDate ? new Date(startDate) : null;
            const filterEndDate = endDate ? new Date(endDate) : null;
            
            const matchesStartDate = !filterStartDate || itemEndDate >= filterStartDate;
            const matchesEndDate = !filterEndDate || itemStartDate <= filterEndDate;

            return matchesRegion && matchesCountry && matchesCategory && matchesItemName && matchesStartDate && matchesEndDate;
        });
    }, [data, selectedRegion, selectedCountries, selectedItemCategory, selectedItemNames, startDate, endDate]);

    // When region changes, reset countries
    useEffect(() => {
        setSelectedCountries([]);
    }, [selectedRegion]);

    // When category changes, reset item names
    useEffect(() => {
        setSelectedItemNames([]);
    }, [selectedItemCategory]);

    // Pagination
    const rowsPerPage = 100;
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    
    const [currentPage, setCurrentPage] = useState(0);
    
    const paginatedData = filteredData.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(0);
    }, [filteredData]);

    const columns = useMemo(
        () => [
            createStringColumn(
                'fa_number',
                'FA Number',
                (item: FrameworkAgreement) => item.fa_number,
            ),
            createStringColumn(
                'supplier_name',
                'Supplier Name',
                (item: FrameworkAgreement) => item.supplier_name,
            ),
            createStringColumn(
                'pa_type',
                'PA Type',
                (item: FrameworkAgreement) => item.pa_type,
            ),
            createStringColumn(
                'pa_bu_region_name',
                'PA BU Region Name',
                (item: FrameworkAgreement) => item.pa_bu_region_name,
            ),
            createStringColumn(
                'pa_bu_country_name',
                'PA BU Country Name',
                (item: FrameworkAgreement) => item.pa_bu_country_name,
            ),
            createStringColumn(
                'pa_line_product_type',
                'PA Line Product Type',
                (item: FrameworkAgreement) => item.pa_line_product_type,
            ),
            createStringColumn(
                'pa_line_procurement_category',
                'PA Line Procurement Category',
                (item: FrameworkAgreement) => item.pa_line_procurement_category,
            ),
            createStringColumn(
                'pa_effective_date_fa_start_date',
                'PA Effective Date',
                (item: FrameworkAgreement) => item.pa_effective_date_fa_start_date,
            ),
            createStringColumn(
                'pa_expiration_date_fa_end_date',
                'PA Expiration Date',
                (item: FrameworkAgreement) => item.pa_expiration_date_fa_end_date,
            ),
            createStringColumn(
                'supplier_country',
                'Supplier Country',
                (item: FrameworkAgreement) => item.supplier_country,
            ),
            createStringColumn(
                'pa_status',
                'PA Status',
                (item: FrameworkAgreement) => item.pa_status,
            ),
            createStringColumn(
                'item_service_short_description',
                'Item / Service Short Description',
                (item: FrameworkAgreement) => item.item_service_short_description,
            ),
        ],
        [],
    );

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
                            <label>FA Coverage Region</label>
                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                disabled={pending}
                                className={styles.selectInput}
                            >
                                <option value="">-- Select Region --</option>
                                {regions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <button
                                onClick={() => setExpandedCountryFilter(!expandedCountryFilter)}
                                className={styles.expandableButton}
                                disabled={pending}
                            >
                                <span className={styles.chevron + (expandedCountryFilter ? ' ' + styles.chevronOpen : '')}>▶</span>
                                Country (Code) {selectedCountries.length > 0 && `(${selectedCountries.length} selected)`}
                            </button>
                            {expandedCountryFilter && (
                                <div className={styles.expandedContent}>
                                    <TextInput
                                        name="countrySearch"
                                        placeholder="Search countries..."
                                        value={countrySearch}
                                        onChange={(value) => setCountrySearch(value ?? '')}
                                        disabled={pending}
                                    />
                                    <div className={styles.checkboxGroup}>
                                        {filteredCountriesBySearch.map(country => (
                                            <label key={country} className={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCountries.includes(country)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedCountries([...selectedCountries, country]);
                                                        } else {
                                                            setSelectedCountries(selectedCountries.filter(c => c !== country));
                                                        }
                                                    }}
                                                    disabled={pending}
                                                />
                                                {country}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.filterGroup}>
                            <label>Item Category</label>
                            <select
                                value={selectedItemCategory}
                                onChange={(e) => setSelectedItemCategory(e.target.value)}
                                disabled={pending}
                                className={styles.selectInput}
                            >
                                <option value="">-- Select Category --</option>
                                {itemCategories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <button
                                onClick={() => setExpandedItemNameFilter(!expandedItemNameFilter)}
                                className={styles.expandableButton}
                                disabled={pending}
                            >
                                <span className={styles.chevron + (expandedItemNameFilter ? ' ' + styles.chevronOpen : '')}>▶</span>
                                Item Name {selectedItemNames.length > 0 && `(${selectedItemNames.length} selected)`}
                            </button>
                            {expandedItemNameFilter && (
                                <div className={styles.expandedContent}>
                                    <TextInput
                                        name="itemNameSearch"
                                        placeholder="Search item names..."
                                        value={itemNameSearch}
                                        onChange={(value) => setItemNameSearch(value ?? '')}
                                        disabled={pending}
                                    />
                                    <div className={styles.checkboxGroup}>
                                        {filteredItemNamesBySearch.map(name => (
                                            <label key={name} className={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItemNames.includes(name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedItemNames([...selectedItemNames, name]);
                                                        } else {
                                                            setSelectedItemNames(selectedItemNames.filter(n => n !== name));
                                                        }
                                                    }}
                                                    disabled={pending}
                                                />
                                                {name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.filterGroup}>
                            <label>Effective Date Range</label>
                            <div className={styles.dateRangeDisplay}>
                                {tempStartDate ? new Date(tempStartDate).toLocaleDateString() : 'Start'} — {tempEndDate ? new Date(tempEndDate).toLocaleDateString() : 'End'}
                            </div>
                            <div className={styles.rangeSliderContainer}>
                                <div className={styles.rangeTrackBase} />
                                <div 
                                    className={styles.rangeTrackFill}
                                    style={{
                                        left: `${tempStartDate && tempEndDate ? ((new Date(tempStartDate).getTime() - new Date(minDate).getTime()) / (new Date(maxDate).getTime() - new Date(minDate).getTime())) * 100 : 0}%`,
                                        width: `${tempStartDate && tempEndDate ? ((new Date(tempEndDate).getTime() - new Date(tempStartDate).getTime()) / (new Date(maxDate).getTime() - new Date(minDate).getTime())) * 100 : 100}%`
                                    }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={((new Date(tempStartDate || minDate).getTime() - new Date(minDate).getTime()) / (new Date(maxDate).getTime() - new Date(minDate).getTime())) * 100}
                                    onChange={(e) => {
                                        const percent = parseFloat(e.target.value);
                                        const totalMs = new Date(maxDate).getTime() - new Date(minDate).getTime();
                                        const newStartMs = new Date(minDate).getTime() + (totalMs * percent / 100);
                                        const newStart = new Date(newStartMs).toISOString().split('T')[0];
                                        if (newStart <= tempEndDate) {
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
                                    value={((new Date(tempEndDate || maxDate).getTime() - new Date(minDate).getTime()) / (new Date(maxDate).getTime() - new Date(minDate).getTime())) * 100}
                                    onChange={(e) => {
                                        const percent = parseFloat(e.target.value);
                                        const totalMs = new Date(maxDate).getTime() - new Date(minDate).getTime();
                                        const newEndMs = new Date(minDate).getTime() + (totalMs * percent / 100);
                                        const newEnd = new Date(newEndMs).toISOString().split('T')[0];
                                        if (newEnd >= tempStartDate) {
                                            setTempEndDate(newEnd);
                                        }
                                    }}
                                    disabled={pending}
                                    className={styles.rangeSliderEnd}
                                />
                            </div>
                            <Button
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
                    Showing {paginatedData.length} of {filteredData.length} results
                </p>
            </div>

            <div className={styles.tableContainer}>
                <Table
                    data={paginatedData}
                    keySelector={(_row, index) => index}
                    columns={columns}
                    pending={pending}
                    filtered={false}
                />
            </div>
            <div className={styles.paginationContainer}>
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={currentPage === i ? styles.pageButtonActive : styles.pageButton}
                        disabled={pending}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </Container>
    );
}

export default FrameworkAgreementsTable;
