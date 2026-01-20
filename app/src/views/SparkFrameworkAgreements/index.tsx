import { Container } from '@ifrc-go/ui';
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

/** @knipignore */
export function Component() {
    return (
        <Container>
            <h2>Framework Agreements</h2>
            <GlobalMap>
                <GoMapContainer
                    title="Framework Agreements Map"
                />
            </GlobalMap>
        </Container>
    );
}

Component.displayName = 'SparkFrameworkAgreements';
