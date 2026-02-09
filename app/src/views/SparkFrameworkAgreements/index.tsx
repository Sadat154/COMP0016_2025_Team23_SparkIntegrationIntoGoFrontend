/* eslint-disable max-len */

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    Legend,
    MultiSelectInput,
    SelectInput,
} from '@ifrc-go/ui';
import Papa from 'papaparse';

// GlobalMap: Provides base map with country boundaries and interaction handlers
import GlobalMap, { type AdminZeroFeatureProperties } from '#components/domain/GlobalMap';
// GoMapContainer: Wraps map with UI controls (title, download button, footer/legend)
import GoMapContainer from '#components/GoMapContainer';

import FrameworkAgreementsTable from './FrameworkAgreementsTable';

import styles from './SparkFrameworkAgreements.module.css';

// Placeholder for fields to be provided by backend
const EMPTY_SELECT_OPTIONS: { id: string; name: string }[] = [];

interface MapLegendItem {
    id: string;
    label: string;
    color: string;
}

const MAP_LEGEND_ITEMS: MapLegendItem[] = [
    { id: 'ifrc', label: 'IFRC FAs', color: '#4a4a4a' },
    { id: 'icrc', label: 'ICRC FAs', color: '#8a8a8a' },
    { id: 'ns', label: 'NS FAs', color: '#b8b8b8' },
];

// ============================================================================
// DATA STRUCTURE
// ============================================================================
// This interface defines the shape of each row in the CSV file.
// Property names are automatically cleaned from CSV headers
// (e.g., "FA Number" becomes "fa_number" for easier access in code).
interface FrameworkAgreementData {
    fa_number: string;
    supplier_name: string;
    pa_type: string;
    pa_bu_region_name: string;
    pa_bu_country_name: string;
    pa_line_item_code: string;
    pa_line_product_type: string;
    pa_line_procurement_category: string;
    pa_line_item_name: string;
    pa_effective_date_fa_start_date: string;
    pa_expiration_date_fa_end_date: string;
    supplier_country: string;
    pa_workflow_status: string;
    pa_status: string;
    pa_buyer_group_code: string;
    fa_owner_name: string;
    fa_geographical_coverage: string;
    region_countries_covered: string;
    item_type: string;
    item_category: string;
    item_service_short_description: string;
}

// MAIN COMPONENT
/** @knipignore */
export function Component() {
    // --------------------------------------------------------------------
    // STATE MANAGEMENT
    // --------------------------------------------------------------------
    // agreementData: Stores all framework agreement records from the CSV
    // agreementData is an array of objects. each object represents one row of the csv file
    const [agreementData, setAgreementData] = useState<FrameworkAgreementData[]>([]);
    // isLoading: Tracks whether the CSV is still being loaded
    const [isLoading, setIsLoading] = useState(true);
    // error: Stores any error message if CSV loading fails
    const [error, setError] = useState<string | undefined>();
    // selectedCountry: Tracks the country clicked on the map (undefined = show all)
    const [selectedCountry, setSelectedCountry] = useState<string | undefined>();

    // Calculate which countries have framework agreements (Local agreements)
    // Since Global agreements apply to all countries, all countries will be highlighted
    const countriesWithAgreements = useMemo(() => {
        const hasGlobal = agreementData.some(
            (row) => row.fa_geographical_coverage?.toLowerCase() === 'global',
        );

        if (hasGlobal) {
            // If there are Global agreements, all countries should be highlighted
            return 'all';
        }

        // Otherwise, only highlight countries with Local agreements
        const countrySet = new Set<string>();
        agreementData.forEach((row) => {
            if (row.fa_geographical_coverage?.toLowerCase() === 'local'
                && row.pa_bu_country_name) {
                countrySet.add(row.pa_bu_country_name.toLowerCase());
            }
        });
        return countrySet;
    }, [agreementData]);

    // Summary stats (derived from data; placeholders for "other" FAs until backend)
    const summaryStats = useMemo(() => {
        const uniqueSuppliers = new Set(agreementData.map((d) => d.supplier_name).filter(Boolean));
        const uniqueCountries = new Set<string>();
        agreementData.forEach((d) => {
            if (d.pa_bu_country_name) uniqueCountries.add(d.pa_bu_country_name);
            if (d.region_countries_covered) {
                d.region_countries_covered.split(/[,;]/).forEach((c) => {
                    const t = c.trim();
                    if (t) uniqueCountries.add(t);
                });
            }
        });
        const uniqueItemCategories = new Set(
            agreementData.map((d) => d.item_category || d.pa_line_procurement_category).filter(Boolean),
        );
        const uniqueFaNumbers = new Set(agreementData.map((d) => d.fa_number).filter(Boolean));
        return {
            ifrcFrameworkAgreements: uniqueFaNumbers.size,
            suppliers: uniqueSuppliers.size,
            otherFrameworkAgreements: 0, // Placeholder until backend
            otherSuppliers: 0, // Placeholder until backend
            countriesCovered: uniqueCountries.size,
            itemCategoriesCovered: uniqueItemCategories.size,
        };
    }, [agreementData]);

    // Filter state (parent owns filters so table receives pre-filtered data)
    const [filterRegion, setFilterRegion] = useState<string | undefined>();
    const [filterCountry, setFilterCountry] = useState<string[] | undefined>();
    const [filterItemCategory, setFilterItemCategory] = useState<string | undefined>();
    const [filterItemSubcategory, setFilterItemSubcategory] = useState<string | undefined>();
    const [filterOrganisation, setFilterOrganisation] = useState<string | undefined>();
    const [filterIncoterms, setFilterIncoterms] = useState<string | undefined>();

    const selectKeySelector = useCallback((opt: { id: string; name: string }) => opt.id, []);
    const selectLabelSelector = useCallback((opt: { id: string; name: string }) => opt.name, []);

    const regionOptions = useMemo(() => {
        const set = new Set(agreementData.map((d) => d.pa_bu_region_name).filter(Boolean));
        return Array.from(set).sort().map((name) => ({ id: name, name }));
    }, [agreementData]);

    const countryOptions = useMemo(() => {
        if (!filterRegion) {
            const set = new Set(agreementData.map((d) => d.pa_bu_country_name).filter(Boolean));
            return Array.from(set).sort().map((name) => ({ id: name, name }));
        }
        const set = new Set(
            agreementData
                .filter((d) => d.pa_bu_region_name === filterRegion)
                .map((d) => d.pa_bu_country_name)
                .filter(Boolean),
        );
        return Array.from(set).sort().map((name) => ({ id: name, name }));
    }, [agreementData, filterRegion]);

    const itemCategoryOptions = useMemo(() => {
        const set = new Set(
            agreementData
                .map((d) => d.item_category || d.pa_line_procurement_category)
                .filter(Boolean),
        );
        return Array.from(set).sort().map((name) => ({ id: name, name }));
    }, [agreementData]);

    const itemSubcategoryOptions = useMemo(() => {
        const set = new Set(
            agreementData.map((d) => d.pa_line_product_type).filter(Boolean),
        );
        return Array.from(set).sort().map((name) => ({ id: name, name }));
    }, [agreementData]);

    const filteredData = useMemo(() => agreementData.filter((row) => {
        if (selectedCountry) {
            const isGlobal = row.fa_geographical_coverage?.toLowerCase() === 'global';
            const isLocal = row.fa_geographical_coverage?.toLowerCase() === 'local';
            const matchesCountry = row.pa_bu_country_name?.toLowerCase() === selectedCountry.toLowerCase();
            if (!isGlobal && !(isLocal && matchesCountry)) return false;
        }
        if (filterRegion && row.pa_bu_region_name !== filterRegion) return false;
        if (filterCountry?.length && !filterCountry.includes(row.pa_bu_country_name)) return false;
        const cat = row.item_category || row.pa_line_procurement_category;
        if (filterItemCategory && cat !== filterItemCategory) return false;
        if (filterItemSubcategory && row.pa_line_product_type !== filterItemSubcategory) return false;
        if (filterOrganisation) return false; // No field yet; placeholder
        if (filterIncoterms) return false; // No field yet; placeholder
        return true;
    }), [
        agreementData,
        selectedCountry,
        filterRegion,
        filterCountry,
        filterItemCategory,
        filterItemSubcategory,
        filterOrganisation,
        filterIncoterms,
    ]);

    const handleClearFilters = useCallback(() => {
        setFilterRegion(undefined);
        setFilterCountry(undefined);
        setFilterItemCategory(undefined);
        setFilterItemSubcategory(undefined);
        setFilterOrganisation(undefined);
        setFilterIncoterms(undefined);
        setSelectedCountry(undefined);
    }, []);

    const handleExport = useCallback(() => {
        // Placeholder: backend will implement export
    }, []);

    // --------------------------------------------------------------------
    // CSV DATA LOADING
    // --------------------------------------------------------------------
    // This effect runs once when the component mounts to load the CSV file.
    // PapaParse reads the CSV from the public folder and converts it to JavaScript objects.
    useEffect(() => {
        const csvFilePath = '/SPARK_framework_agreements_cleaned.csv';

        function transformHeaderFn(header: string) {
            // Convert "PA BU Region Name" → "pa_bu_region_name"
            return header
                .toLowerCase()
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .replace(/[^\w_]/g, ''); // Remove special characters like parentheses
        }

        Papa.parse<FrameworkAgreementData>(csvFilePath, {
            download: true,
            header: true,
            dynamicTyping: true, // Automatically convert numbers
            skipEmptyLines: true,
            transformHeader: transformHeaderFn,
            complete: (results) => {
                if (results.errors.length > 0) {
                    setError('Failed to parse CSV file');
                } else {
                    setAgreementData(results.data);
                }
                setIsLoading(false);
            },
            error: () => {
                setError('Failed to load CSV file');
                setIsLoading(false);
            },
        });
    }, []);

    // --------------------------------------------------------------------
    // MAP STYLING & INTERACTION
    // --------------------------------------------------------------------
    // Paint style for country polygons: transparent red by default, opaque red when selected
    const adminZeroFillPaint = useMemo<mapboxgl.FillPaint>(() => {
        // Build the match expression for countries with Local agreements
        const localCountryMatchExpression = countriesWithAgreements !== 'all'
            ? Array.from(countriesWithAgreements).flatMap((country) => [country, true])
            : [];

        return {
            'fill-color': [
                'case',
                // If a country is selected
                ['boolean', selectedCountry !== undefined, false],
                [
                    'case',
                    // Highlight selected country in stronger red
                    ['==', ['downcase', ['get', 'name']], selectedCountry?.toLowerCase() ?? ''],
                    'rgba(220, 53, 69, 0.6)', // Stronger red
                    // Unhighlight all other countries
                    'rgba(0, 0, 0, 0)', // Transparent
                ],
                // No country selected - show countries with agreements
                [
                    'case',
                    // If there are Global agreements, highlight all countries
                    countriesWithAgreements === 'all',
                    'rgba(220, 53, 69, 0.3)', // Transparent red for all
                    // Otherwise, check if country has Local agreement
                    localCountryMatchExpression.length > 0
                        ? ['match', ['downcase', ['get', 'name']], ...localCountryMatchExpression, false]
                        : false,
                    'rgba(220, 53, 69, 0.3)', // Transparent red for countries with Local agreements
                    'rgba(0, 0, 0, 0)', // Transparent for countries without agreements
                ],
            ],
            'fill-opacity': 1,
        };
    }, [selectedCountry, countriesWithAgreements]);

    // Handle country click on map
    const handleCountryClick = (feature: AdminZeroFeatureProperties) => {
        const countryName = feature.name;

        // Toggle selection: if clicking the same country, deselect it
        if (selectedCountry?.toLowerCase() === countryName.toLowerCase()) {
            setSelectedCountry(undefined);
        } else {
            setSelectedCountry(countryName);
        }
    };

    // --------------------------------------------------------------------
    // LOADING STATE
    // --------------------------------------------------------------------
    // Show a loading message while CSV is being fetched and parsed
    // --------------------------------------------------------------------
    // LOADING STATE
    // --------------------------------------------------------------------
    // Show a loading message while CSV is being fetched and parsed
    if (isLoading) {
        return (
            <Container>
                <h2>Framework Agreements</h2>
                <p>Loading data...</p>
            </Container>
        );
    }

    // --------------------------------------------------------------------
    // ERROR STATE
    // --------------------------------------------------------------------
    // If CSV loading failed, show an error message
    if (error) {
        return (
            <Container>
                <h2>Framework Agreements</h2>
                <p>
                    Error:
                    {error}
                </p>
            </Container>
        );
    }

    // --------------------------------------------------------------------
    // MAIN RENDER
    // --------------------------------------------------------------------
    return (
        <Container
            className={styles.page}
            headingLevel={2}
        >
            <div className={styles.layout}>
                {/* Summary: 3 separate cards, each with a line between agreements and suppliers */}
                <div className={styles.summaryCards}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.ifrcFrameworkAgreements}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                IFRC Framework Agreements
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.suppliers}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Suppliers
                            </div>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.otherFrameworkAgreements}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Other Framework Agreements
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.otherSuppliers}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Suppliers
                            </div>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.countriesCovered}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Countries Covered
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {summaryStats.itemCategoriesCovered}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Item Categories Covered
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter row */}
                <div className={styles.filtersCard}>
                    <div className={styles.filterItem}>
                        <SelectInput
                            label="Region"
                            name="region"
                            value={filterRegion}
                            options={regionOptions}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={setFilterRegion}
                            placeholder="All Regions"
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <MultiSelectInput
                            label="Country"
                            name="country"
                            value={filterCountry ?? []}
                            options={countryOptions}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={(v) => setFilterCountry(v?.length ? v : undefined)}
                            placeholder="All Countries"
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            label="Item Category"
                            name="item_category"
                            value={filterItemCategory}
                            options={itemCategoryOptions}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={setFilterItemCategory}
                            placeholder="All Item categories"
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            label="Item Subcategory"
                            name="item_subcategory"
                            value={filterItemSubcategory}
                            options={itemSubcategoryOptions}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={setFilterItemSubcategory}
                            placeholder="All Item subcategories"
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            label="Organisation"
                            name="organisation"
                            value={filterOrganisation}
                            options={EMPTY_SELECT_OPTIONS}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={setFilterOrganisation}
                            placeholder="All Organisations"
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            label="Incoterms"
                            name="incoterms"
                            value={filterIncoterms}
                            options={EMPTY_SELECT_OPTIONS}
                            keySelector={selectKeySelector}
                            labelSelector={selectLabelSelector}
                            onChange={setFilterIncoterms}
                            placeholder="All Incoterms"
                        />
                    </div>
                    <div className={styles.clearAndExportRow}>
                        <Button
                            name="clear_filters"
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </Button>
                        <button
                            type="button"
                            className={styles.exportLink}
                            onClick={handleExport}
                        >
                            Export
                        </button>
                    </div>
                </div>

                {/* Map */}
                <div className={styles.mapCard}>
                    <GlobalMap
                        adminZeroFillPaint={adminZeroFillPaint}
                        onAdminZeroFillClick={handleCountryClick}
                    >
                        <GoMapContainer
                            title="Framework Agreements Map"
                            withPresentationMode
                            footer={(
                                <div className={styles.mapFooterLegend}>
                                    <Legend<MapLegendItem>
                                        items={MAP_LEGEND_ITEMS}
                                        keySelector={(item) => item.id}
                                        colorSelector={(item) => item.color}
                                        labelSelector={(item) => item.label}
                                        colorElementClassName={styles.mapLegendCircle}
                                    />
                                </div>
                            )}
                        />
                    </GlobalMap>
                </div>

                {/* Table */}
                <div className={styles.tableCard}>
                    <FrameworkAgreementsTable
                        data={filteredData}
                        pending={isLoading}
                        selectedCountry={selectedCountry}
                        showFiltersSection={false}
                    />
                </div>
            </div>
        </Container>
    );
}

Component.displayName = 'SparkFrameworkAgreements';

export default Component;
