/* eslint-disable max-len */

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Container,
    Legend,
} from '@ifrc-go/ui';

import { useRequest } from '#utils/restRequest';

// GlobalMap: Provides base map with country boundaries and interaction handlers
import GlobalMap, { type AdminZeroFeatureProperties } from '#components/domain/GlobalMap';
// GoMapContainer: Wraps map with UI controls (title, download button, footer/legend)
import GoMapContainer from '#components/GoMapContainer';
import useCountry from '#hooks/domain/useCountry';

import FrameworkAgreementsTable from './FrameworkAgreementsTable';

import styles from './SparkFrameworkAgreements.module.css';

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

const PAGE_SIZE = 100;

// ============================================================================
// DATA STRUCTURE
// ============================================================================
// This interface defines the shape of each row in the CSV file.
// Property names are automatically cleaned from CSV headers
// (e.g., "FA Number" becomes "fa_number" for easier access in code).
interface FrameworkAgreementData {
    agreementId: string;
    classification?: string | null;
    defaultAgreementLineEffectiveDate?: string | null;
    defaultAgreementLineExpirationDate?: string | null;
    workflowStatus?: string | null;
    status?: string | null;
    pricePerUnit?: string | null;
    paLineProcurementCategory?: string | null;
    vendorName?: string | null;
    vendorValidFrom?: string | null;
    vendorValidTo?: string | null;
    vendorCountry?: string | null;
    regionCountriesCovered?: string | null;
    itemType?: string | null;
    itemCategory?: string | null;
    itemServiceShortDescription?: string | null;
    owner: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

interface CleanedFrameworkAgreementResponse {
    count: number;
    next?: string | null;
    previous?: string | null;
    results: FrameworkAgreementData[];
}
// 
interface FrameworkAgreementSummaryResponse {
    ifrcFrameworkAgreements: number;
    suppliers: number;
    otherFrameworkAgreements: number;
    otherSuppliers: number;
    countriesCovered: number;
    itemCategoriesCovered: number;
}

interface TableFilters {
    coverageCountryId?: number;
    coverageCountryName?: string;
    vendorCountryId?: number;
    vendorCountryIso3?: string;
    itemCategory?: string;
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
    const [totalCount, setTotalCount] = useState(0);
    const [tablePage, setTablePage] = useState(0);
    const [filters, setFilters] = useState<TableFilters>({});
    // error: Stores any error message if loading fails
    const [error, setError] = useState<string | undefined>();
    const selectedCountry = filters.coverageCountryName;

    const countries = useCountry();
    const countryByName = useMemo(() => {
        const map = new Map<string, (typeof countries)[number]>();
        countries?.forEach((country) => {
            map.set(country.name.toLowerCase(), country);
        });
        return map;
    }, [countries]);

    const handleFiltersChange = useCallback((next: Partial<TableFilters>) => {
        setFilters((prev) => ({
            ...prev,
            ...next,
        }));
    }, []);

    const handleClearFilters = useCallback(() => {
        setFilters({});
    }, []);

    useEffect(() => {
        setTablePage(0);
    }, [filters.coverageCountryName, filters.vendorCountryIso3, filters.itemCategory]);

    const { pending } = useRequest({
        skip: Boolean(error),
        url: '/api/v2/fabric/cleaned-framework-agreements/' as never,
        query: {
            page: tablePage + 1,
            pageSize: PAGE_SIZE,
            regionCountriesCovered: filters.coverageCountryName,
            itemCategory: filters.itemCategory,
            vendorCountry: filters.vendorCountryIso3,
        } as never,
        onSuccess: (response) => {
            const data = response as CleanedFrameworkAgreementResponse;
            const results = data.results ?? [];
            setAgreementData(results);
            setTotalCount(data.count ?? 0);
        },
        onFailure: () => {
            setError('Failed to load framework agreements.');
        },
    });

    const isLoading = pending && agreementData.length === 0;

    // Calculate which countries have framework agreements (Local agreements)
    // Since Global agreements apply to all countries, all countries will be highlighted
    const countriesWithAgreements = useMemo(() => {
        const hasGlobal = agreementData.some((row) => (
            row.classification?.toLowerCase() === 'global'
            || row.regionCountriesCovered?.toLowerCase() === 'global'
        ));

        if (hasGlobal) {
            // If there are Global agreements, all countries should be highlighted
            return 'all';
        }

        // Otherwise, only highlight countries with Local agreements
        const countrySet = new Set<string>();
        agreementData.forEach((row) => {
            if (!row.regionCountriesCovered) {
                return;
            }
            row.regionCountriesCovered.split(/[,;]/).forEach((country) => {
                const trimmed = country.trim();
                if (trimmed) {
                    countrySet.add(trimmed.toLowerCase());
                }
            });
        });
        return countrySet;
    }, [agreementData]);

    const { response: summaryResponse } = useRequest({
        url: '/api/v2/fabric/cleaned-framework-agreements/summary/' as never,
    });

    const summaryStats = useMemo(() => ({
        ifrcFrameworkAgreements: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.ifrcFrameworkAgreements ?? 0,
        suppliers: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.suppliers ?? 0,
        otherFrameworkAgreements: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.otherFrameworkAgreements ?? 0,
        otherSuppliers: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.otherSuppliers ?? 0,
        countriesCovered: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.countriesCovered ?? 0,
        itemCategoriesCovered: (summaryResponse as FrameworkAgreementSummaryResponse | undefined)?.itemCategoriesCovered ?? 0,
    }), [summaryResponse]);

    const handleExport = useCallback(() => {
        // Placeholder: backend will implement export
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
        const normalizedName = countryName?.toLowerCase();
        const matchedCountry = normalizedName ? countryByName.get(normalizedName) : undefined;

        // Toggle selection: if clicking the same country, deselect it
        if (selectedCountry?.toLowerCase() === normalizedName) {
            handleFiltersChange({
                coverageCountryId: undefined,
                coverageCountryName: undefined,
            });
        } else {
            handleFiltersChange({
                coverageCountryId: matchedCountry?.id,
                coverageCountryName: countryName,
            });
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

                <div className={styles.clearAndExportRow}>
                    <button
                        type="button"
                        className={styles.exportLink}
                        onClick={handleExport}
                    >
                        Export
                    </button>
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
                        data={agreementData}
                        pending={pending}
                        page={tablePage}
                        pageSize={PAGE_SIZE}
                        totalCount={totalCount}
                        filters={filters}
                        onFiltersChange={handleFiltersChange}
                        onClearFilters={handleClearFilters}
                        onPageChange={setTablePage}
                    />
                </div>
            </div>
        </Container>
    );
}

Component.displayName = 'SparkFrameworkAgreements';

export default Component;
