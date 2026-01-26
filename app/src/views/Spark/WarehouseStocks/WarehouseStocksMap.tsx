import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    MapContainer,
    MapLayer,
    MapSource,
} from '@togglecorp/re-map';
import type {
    CircleLayer,
    CirclePaint,
    GeoJSONSourceRaw,
    LngLatLike,
    MapboxGeoJSONFeature,
} from 'mapbox-gl';

import GlobalMap from '#components/domain/GlobalMap';
import MapPopup from '#components/MapPopup';
import { mbtoken } from '#config';
import useCountryRaw from '#hooks/domain/useCountryRaw';

import { loadISO3ToCentroidMap } from './countryDataLoader';

import styles from './WarehouseStocksMap.module.css';

export interface GoAdminCountry {
    iso3?: string | null;
    name?: string | null;
    centroid?: {
        type?: string;
        coordinates?: [number, number];
    } | null;
}

function parseQty(v: string | null | undefined): number {
    if (!v) {
        return 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

type BubbleFeatureProps = {
    iso3: string;
    country: string;
    warehouseCount: number;
    qty: number;
};

type HoveredBubble = {
    props: BubbleFeatureProps;
    coordinates: [number, number];
};

type BubbleFC = GeoJSON.FeatureCollection<GeoJSON.Point, BubbleFeatureProps>;

interface WarehouseStock {
    id: string;
    region: string | null;
    country: string | null;
    country_iso3?: string | null;
    warehouse_name: string | null;
    item_group: string | null;
    item_name: string | null;
    item_number: string | null;
    unit: string | null;
    quantity: string | null;
}

interface Props {
    data: WarehouseStock[];
    selectedCountryName?: string | undefined;
    onCountrySelect?: (countryName: string | undefined) => void;
}

function WarehouseStocksMap(props: Props) {
    const { data, selectedCountryName, onCountrySelect } = props;

    const tokenRaw = (mbtoken ?? '').trim();
    const hasToken = /^pk\./.test(tokenRaw);

    const [hovered, setHovered] = useState<HoveredBubble | undefined>();
    const [iso3ToCentroid, setIso3ToCentroid] = useState<Map<string, [number, number]>>(new Map());

    const mapOptions = useMemo(() => ({
        ...(hasToken ? { accessToken: tokenRaw } : {}),
        scrollZoom: false,
        touchZoomRotate: false,
    }), [hasToken, tokenRaw]);

    // Load country centroids from bundled countries.json via fetch
    useEffect(() => {
        let mounted = true;
        loadISO3ToCentroidMap()
            .then((map) => {
                if (!mounted) {
                    return;
                }
                setIso3ToCentroid(map);
            })
            .catch((err) => {
                if (!mounted) {
                    return;
                }
                console.error('Failed to load iso3ToCentroid map', err);
            });

        return () => {
            mounted = false;
        };
    }, []);

    // Keep country names from the API
    const countriesRaw = useCountryRaw();

    const iso3ToName = useMemo(() => {
        const map = new Map<string, string>();
        const results = countriesRaw ?? [];
        results.forEach((c) => {
            const iso3 = (c.iso3 ?? '').toUpperCase();
            const name = c.name ?? '';
            if (iso3 && name) {
                map.set(iso3, name);
            }
        });
        return map;
    }, [countriesRaw]);

    const bubbleGeoJson: BubbleFC = useMemo(() => {
        const perIso3 = new Map<string, { country: string; warehouses: Set<string>; qty: number }>();

        data.forEach((row) => {
            const iso3 = (row.country_iso3 ?? '').toUpperCase().trim();
            if (!iso3) {
                return;
            }

            const countryName = row.country ?? iso3ToName.get(iso3) ?? iso3;
            const warehouseName = row.warehouse_name ?? '';
            const qty = parseQty(row.quantity);

            const current = perIso3.get(iso3);
            if (!current) {
                perIso3.set(iso3, {
                    country: countryName,
                    warehouses: new Set(warehouseName ? [warehouseName] : []),
                    qty,
                });
            } else {
                if (warehouseName) {
                    current.warehouses.add(warehouseName);
                }
                current.qty += qty;
            }
        });

        const features: GeoJSON.Feature<GeoJSON.Point, BubbleFeatureProps>[] = [];

        perIso3.forEach((v, iso3) => {
            const centroid = iso3ToCentroid.get(iso3);
            if (!centroid) {
                return;
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: centroid,
                },
                properties: {
                    iso3,
                    country: v.country,
                    warehouseCount: v.warehouses.size,
                    qty: v.qty,
                },
            });
        });

        const result = {
            type: 'FeatureCollection',
            features,
        };

        return result;
    }, [data, iso3ToCentroid, iso3ToName]);

    const handleBubbleEnter = useCallback((feature: MapboxGeoJSONFeature) => {
        const props2 = feature.properties as BubbleFeatureProps | undefined;
        const coords = (feature.geometry as any)?.coordinates as [number, number] | undefined;
        if (props2 && coords) {
            setHovered({ props: props2, coordinates: coords });
        } else {
            setHovered(undefined);
        }
    }, []);

    const handleBubbleLeave = useCallback(() => {
        setHovered(undefined);
    }, []);

    const handleBubbleClick = useCallback((
        feature: MapboxGeoJSONFeature,
        _lngLat: LngLatLike,
    ) => {
        const props2 = feature.properties as BubbleFeatureProps | undefined;
        if (!props2 || !onCountrySelect) {
            return true;
        }

        if (selectedCountryName && props2.country === selectedCountryName) {
            onCountrySelect(undefined);
        } else {
            onCountrySelect(props2.country);
        }

        return true;
    }, [onCountrySelect, selectedCountryName]);

    const sourceOptions = useMemo<GeoJSONSourceRaw>(() => ({
        type: 'geojson',
        data: bubbleGeoJson as any,
    }), [bubbleGeoJson]);

    const bubblePaint = useMemo<CirclePaint>(() => ({
        'circle-color': '#F5333F',
        'circle-opacity': [
            'case',
            ['==', ['get', 'country'], selectedCountryName ?? ''],
            0.85, // Higher opacity for selected
            0.55, // Normal opacity
        ],
        'circle-stroke-color': '#F5333F',
        'circle-stroke-width': [
            'case',
            ['==', ['get', 'country'], selectedCountryName ?? ''],
            3, // Thicker stroke for selected
            0.5,
        ],
        'circle-radius': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'qty'], 0],
            0, 3,
            100, 5,
            1000, 8,
            10000, 12,
            100000, 18,
        ],
    }), [selectedCountryName]);

    const bubbleLayer = useMemo<Omit<CircleLayer, 'id'>>(() => ({
        type: 'circle',
        paint: bubblePaint,
    }), [bubblePaint]);

    return (
        <div className={styles.mapRoot}>
            <GlobalMap
                mapOptions={mapOptions}
            >
                <MapSource
                    sourceKey="warehouse-bubbles"
                    sourceOptions={sourceOptions}
                    geoJson={bubbleGeoJson}
                >
                    <MapLayer
                        layerKey="warehouse-bubble-layer"
                        layerOptions={bubbleLayer}
                        onMouseEnter={handleBubbleEnter}
                        onMouseLeave={handleBubbleLeave}
                        onClick={handleBubbleClick}
                    />
                </MapSource>

                {hovered && (
                    <MapPopup
                        popupClassName={styles.smallPopup}
                        coordinates={hovered.coordinates}
                        onCloseButtonClick={handleBubbleLeave}
                        heading={hovered.props.country}
                    >
                        <div className={styles.tooltipRow}>
                            Warehouses:
                            {' '}
                            {hovered.props.warehouseCount}
                        </div>
                        <div className={styles.tooltipRow}>
                            Total quantity:
                            {' '}
                            {Math.round(hovered.props.qty).toLocaleString()}
                        </div>
                    </MapPopup>
                )}

                <MapContainer className={styles.mapContainer} />
            </GlobalMap>
        </div>
    );
}

export default WarehouseStocksMap;
