/* eslint-disable max-len */

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    MapLayer,
    MapSource,
} from '@togglecorp/re-map';
import type {
    CircleLayer,
    CirclePaint,
    GeoJSONSourceRaw,
    MapboxGeoJSONFeature,
} from 'mapbox-gl';

import GlobalMap from '#components/domain/GlobalMap';
import GoMapContainer from '#components/GoMapContainer';
import MapPopup from '#components/MapPopup';
import { mbtoken } from '#config';
import useCountryRaw from '#hooks/domain/useCountryRaw';

import loadISO3ToCentroidMap from './countryDataLoader';

import styles from './WarehouseStocksMap.module.css';

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
    region?: string | null;
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
    warehouse_count?: number | null;
}

interface WarehouseSuggestion {
    warehouse_id: string;
    warehouse_name: string;
    country: string;
    country_iso3: string;
    distance_km: number | null;
    distance_score: number;
    export_penalty: number;
    export_summary: string;
    stock_quantity: number;
    stock_score: number;
    total_score: number;
    is_domestic: boolean;
}

interface Props {
    data: WarehouseStock[];
    selectedCountryNames?: string[] | undefined;
    selectedRegions?: string[] | undefined;
    onCountrySelect?: (countryNames: string[] | undefined) => void;
    suggestedCountryIso3s?: string[] | undefined;
    suggestions?: WarehouseSuggestion[];
    onSuggestionClick?: (suggestion: WarehouseSuggestion) => void;
    receivingCountryIso3?: string | undefined;
}

function WarehouseStocksMap(props: Props) {
    const {
        data,
        selectedCountryNames,
        selectedRegions,
        onCountrySelect,
        suggestedCountryIso3s,
        suggestions,
        onSuggestionClick,
        receivingCountryIso3,
    } = props;

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
            .catch(() => {
                if (mounted) {
                    // ignore
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    // Keep country names from the API
    const countriesRaw = useCountryRaw() as Array<{ iso3?: string | null; name?: string | null }> | undefined;

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
        const perIso3 = new Map<string, {
            country: string;
            warehouses?: Set<string>;
            warehousesCount?: number;
            qty: number;
        }>();

        data.forEach((row) => {
            const iso3 = (row.country_iso3 ?? '').toUpperCase().trim();
            if (!iso3) {
                return;
            }
            const countryName = row.country ?? iso3ToName.get(iso3) ?? iso3;
            const warehouseName = row.warehouse_name ?? '';
            const qty = parseQty(row.quantity);
            const explicitCount = row.warehouse_count;

            const current = perIso3.get(iso3);
            if (!current) {
                const entry: {
                    country: string;
                    region?: string | null;
                    warehouses?: Set<string>;
                    warehousesCount?: number;
                    qty: number;
                } = {
                    country: countryName,
                    region: row.region ?? null,
                    qty,
                };
                if (typeof explicitCount === 'number') {
                    entry.warehousesCount = explicitCount;
                } else {
                    entry.warehouses = new Set(warehouseName ? [warehouseName] : []);
                }
                perIso3.set(iso3, entry);
            } else {
                if (typeof explicitCount === 'number') {
                    current.warehousesCount = (current.warehousesCount ?? 0) + explicitCount;
                } else if (warehouseName) {
                    if (!current.warehouses) {
                        current.warehouses = new Set();
                    }
                    current.warehouses.add(warehouseName);
                }
                // preserve existing region if present, otherwise set from row
                if (!current.region) {
                    current.region = row.region ?? null;
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

            let warehouseCount = 0;
            if (typeof v.warehousesCount === 'number') {
                warehouseCount = v.warehousesCount;
            } else if (v.warehouses) {
                warehouseCount = v.warehouses.size;
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
                    region: v.region ?? null,
                    region_lc: (v.region ?? '') ? String(v.region).toLowerCase() : '',
                    warehouseCount,
                    qty: v.qty,
                },
            });
        });

        const result: BubbleFC = {
            type: 'FeatureCollection',
            features,
        };

        return result;
    }, [data, iso3ToCentroid, iso3ToName]);

    const handleBubbleEnter = useCallback((feature: MapboxGeoJSONFeature) => {
        const props2 = feature.properties as BubbleFeatureProps | undefined;
        const coords = (feature.geometry as GeoJSON.Point | undefined)?.coordinates as
            [number, number] | undefined;
        if (props2 && coords) {
            setHovered({ props: props2, coordinates: coords });
        } else {
            setHovered(undefined);
        }
    }, []);

    const handleBubbleLeave = useCallback(() => {
        setHovered(undefined);
    }, []);

    const handleBubbleClick = useCallback((feature: MapboxGeoJSONFeature) => {
        const props2 = feature.properties as BubbleFeatureProps | undefined;
        if (!props2) {
            return true;
        }

        const clickedIso3 = props2.iso3?.toUpperCase();
        const suggestedIso3List = (suggestedCountryIso3s ?? []).map((c) => c.toUpperCase());
        const current = selectedCountryNames ?? [];
        const isAlreadySelected = current.includes(props2.iso3);

        // If this is a suggested country and we're SELECTING it (not unselecting), show the summary panel
        if (clickedIso3 && suggestedIso3List.includes(clickedIso3) && onSuggestionClick && suggestions && !isAlreadySelected) {
            const matchingSuggestion = suggestions.find(
                (s) => s.country_iso3?.toUpperCase() === clickedIso3,
            );
            if (matchingSuggestion) {
                onSuggestionClick(matchingSuggestion);
            }
        }

        // Always toggle country selection (for both green and red bubbles)
        if (onCountrySelect) {
            if (isAlreadySelected) {
                const next = current.filter((c) => c !== props2.iso3);
                onCountrySelect(next.length > 0 ? next : undefined);
            } else {
                onCountrySelect([...current, props2.iso3]);
            }
        }

        return true;
    }, [onCountrySelect, selectedCountryNames, suggestedCountryIso3s, suggestions, onSuggestionClick]);

    const sourceOptions = useMemo<GeoJSONSourceRaw>(() => ({
        type: 'geojson',
        data: bubbleGeoJson,
    }), [bubbleGeoJson]);

    const bubblePaint = useMemo<CirclePaint>(() => {
        const selectedCountries = (selectedCountryNames ?? []).map((c) => String(c ?? '').toUpperCase());
        const selectedRegs = (selectedRegions ?? []).map((r) => String(r ?? '').toLowerCase());
        const suggestedIso3s = (suggestedCountryIso3s ?? []).map((c) => String(c ?? '').toUpperCase());
        const receivingIso3 = receivingCountryIso3?.toUpperCase() ?? '';

        return ({
            // Color: orange for receiving country, green for suggested, red for others
            'circle-color': [
                'case',
                ['==', ['get', 'iso3'], receivingIso3],
                '#FF9800', // Orange for receiving country
                ['in', ['get', 'iso3'], ['literal', suggestedIso3s]],
                '#4CAF50', // Green for suggested
                '#F5333F', // Red for others
            ],
            // selected bubbles are bolder (higher opacity and thicker stroke)
            // non-selected bubbles remain visible with normal styling
            'circle-opacity': [
                'case',
                ['any',
                    ['==', ['get', 'iso3'], receivingIso3],
                    ['in', ['get', 'iso3'], ['literal', suggestedIso3s]],
                    ['in', ['get', 'iso3'], ['literal', selectedCountries]],
                    ['in', ['get', 'region_lc'], ['literal', selectedRegs]],
                ],
                0.95, // Higher opacity for selected/suggested/receiving
                0.55, // Normal opacity for others
            ],
            'circle-stroke-color': [
                'case',
                ['==', ['get', 'iso3'], receivingIso3],
                '#FF9800', // Orange stroke for receiving country
                ['in', ['get', 'iso3'], ['literal', suggestedIso3s]],
                '#4CAF50', // Green stroke for suggested
                '#F5333F', // Red stroke for others
            ],
            'circle-stroke-width': [
                'case',
                ['any',
                    ['==', ['get', 'iso3'], receivingIso3],
                    ['in', ['get', 'iso3'], ['literal', suggestedIso3s]],
                    ['in', ['get', 'iso3'], ['literal', selectedCountries]],
                    ['in', ['get', 'region_lc'], ['literal', selectedRegs]],
                ],
                3, // Thicker stroke for selected/suggested/receiving
                0.5, // Normal stroke for others
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
        } as CirclePaint);
    }, [selectedCountryNames, selectedRegions, suggestedCountryIso3s, receivingCountryIso3]);

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

                <GoMapContainer
                    className={styles.mapContainer}
                    title="Warehouse stocks"
                    withoutDownloadButton
                />
            </GlobalMap>
        </div>
    );
}

export default WarehouseStocksMap;
