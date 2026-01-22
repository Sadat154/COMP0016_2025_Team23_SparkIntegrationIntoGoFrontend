import {
    useEffect,
    useState,
} from 'react';
import { Container } from '@ifrc-go/ui';
import Papa from 'papaparse';
// MapSource: Add data sources (GeoJSON) to the map
// MapLayer: Define how data is rendered (circles, lines, polygons, symbols)
// MapPopup: Display interactive popups on the map when clicking features
import {
    MapLayer,
    MapPopup,
    MapSource,
} from '@togglecorp/re-map';
// TypeScript types for defining layer styling options
// CircleLayer: Style point data as circles (size, color, opacity)
// FillLayer: Style polygon data as filled shapes (color, opacity, patterns)
// LineLayer: Style line data (width, color, dashes)
import {
    type CircleLayer,
    type FillLayer,
    type LineLayer,
} from 'mapbox-gl';

// GlobalMap: Provides base map with country boundaries and interaction handlers
import GlobalMap from '#components/domain/GlobalMap';
// GoMapContainer: Wraps map with UI controls (title, download button, footer/legend)
import GoMapContainer from '#components/GoMapContainer';

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

    // --------------------------------------------------------------------
    // CSV DATA LOADING
    // --------------------------------------------------------------------
    // This effect runs once when the component mounts to load the CSV file.
    // PapaParse reads the CSV from the public folder and converts it to JavaScript objects.
    useEffect(() => {
        const csvFilePath = '/SPARK_framework_agreements_cleaned.csv';

        Papa.parse<FrameworkAgreementData>(csvFilePath, {
            download: true,
            header: true, // Treat first row as column headers
            dynamicTyping: true, // Automatically convert numbers
            skipEmptyLines: true,
            transformHeader: (header) => {
                // Convert "PA BU Region Name" → "pa_bu_region_name"
                return header
                    .toLowerCase()
                    .replace(/\s+/g, '_')  // Replace spaces with underscores
                    .replace(/[^\w_]/g, '');  // Remove special characters like parentheses
            },
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.error('CSV parsing errors:', results.errors);
                    setError('Failed to parse CSV file');
                } else {
                    setAgreementData(results.data);
                    console.log('Loaded agreement data:', results.data);
                }
                setIsLoading(false);
            },
            error: (err) => {
                console.error('CSV loading error:', err);
                setError('Failed to load CSV file');
                setIsLoading(false);
            },
        });
    }, []);

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
                <p>Error: {error}</p>
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
            <GlobalMap>
                <GoMapContainer
                    title="Framework Agreements Map"
                    // map data to be implemented once we get a mapbox api token
                />
            </GlobalMap>
        </Container>

        </>
    );
}

Component.displayName = 'SparkFrameworkAgreements';
