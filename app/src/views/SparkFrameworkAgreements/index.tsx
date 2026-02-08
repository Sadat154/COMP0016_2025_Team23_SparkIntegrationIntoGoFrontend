/* eslint-disable max-len */

import {
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Container } from '@ifrc-go/ui';
import Papa from 'papaparse';

// GlobalMap: Provides base map with country boundaries and interaction handlers
import GlobalMap, { type AdminZeroFeatureProperties } from '#components/domain/GlobalMap';
// GoMapContainer: Wraps map with UI controls (title, download button, footer/legend)
import GoMapContainer from '#components/GoMapContainer';

import FrameworkAgreementsTable from './FrameworkAgreementsTable';

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
    // Display the map with framework agreement data
    // agreementData is now available and can be used to add features to the map
    return (
        <>
            {/* container is a wrapper which enforces layout structure like max-width, responsive spacing
        put things outside of it if i want it to span the very edges of the page  */}
            <Container>
                <h2>Framework Agreements</h2>
                <GlobalMap
                    adminZeroFillPaint={adminZeroFillPaint}
                    onAdminZeroFillClick={handleCountryClick}
                >
                    <GoMapContainer
                        title="Framework Agreements Map"
                    />
                </GlobalMap>
                <FrameworkAgreementsTable
                    data={agreementData}
                    pending={isLoading}
                    selectedCountry={selectedCountry}
                />
            </Container>

        </>
    );
}

Component.displayName = 'SparkFrameworkAgreements';

export default Component;
