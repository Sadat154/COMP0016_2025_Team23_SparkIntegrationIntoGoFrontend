import { useMemo } from 'react';
import {
    MapLayer,
    MapSource,
} from '@togglecorp/re-map';
import type {
    FillLayer,
    LineLayer,
    VectorSource,
} from 'mapbox-gl';

import GlobalMap from '#components/domain/GlobalMap';
import GoMapContainer from '#components/GoMapContainer';
import { mbtoken } from '#config';

import styles from './CustomsRegulationsMap.module.css';

type CustomsMapRow = {
    iso3?: string;
    ifrcLegalStatus: string; // "Yes" | "No" | "N/A" | others
};

function normalizeYesNo(value: string): 'Yes' | 'No' | 'N/A' {
    const v = (value ?? '').trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return 'N/A';
}

interface Props {
    rows: CustomsMapRow[]; // already filtered rows from index.tsx
    title?: string;
}

function CustomsRegulationsMap(props: Props) {
    const { rows, title = 'Customs regulations' } = props;

    const tokenRaw = (mbtoken ?? '').trim();
    const hasToken = /^pk\./.test(tokenRaw);

    const mapOptions = useMemo(() => ({
        ...(hasToken ? { accessToken: tokenRaw } : {}),
        scrollZoom: false,
        touchZoomRotate: false,
    }), [hasToken, tokenRaw]);

    const iso3Yes = useMemo(
        () => rows
            .filter((r) => (r.iso3 ?? '').trim().length > 0)
            .filter((r) => normalizeYesNo(r.ifrcLegalStatus) === 'Yes')
            .map((r) => (r.iso3 ?? '').toUpperCase()),
        [rows],
    );

    const iso3No = useMemo(
        () => rows
            .filter((r) => (r.iso3 ?? '').trim().length > 0)
            .filter((r) => normalizeYesNo(r.ifrcLegalStatus) === 'No')
            .map((r) => (r.iso3 ?? '').toUpperCase()),
        [rows],
    );

    const sourceOptions = useMemo<VectorSource>(() => ({
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
    }), []);

    // Mapbox country boundary features store ISO3 on this property:
    const ISO3_PROP = 'iso_3166_1_alpha_3';

    const fillLayer = useMemo<Omit<FillLayer, 'id'>>(() => ({
        type: 'fill',
        'source-layer': 'country_boundaries',
        paint: {
            'fill-color': [
                'case',
                ['in', ['get', ISO3_PROP], ['literal', iso3Yes]],
                '#F6B26B', // light orange for Yes
                ['in', ['get', ISO3_PROP], ['literal', iso3No]],
                '#4DD0E1', // cyan for No
                'rgba(0,0,0,0)', // no data -> transparent
            ],
            'fill-opacity': [
                'case',
                ['in', ['get', ISO3_PROP], ['literal', iso3Yes]],
                0.75,
                ['in', ['get', ISO3_PROP], ['literal', iso3No]],
                0.75,
                0, // no data -> fully transparent
            ],
        },
    }), [iso3Yes, iso3No]);

    const outlineLayer = useMemo<Omit<LineLayer, 'id'>>(() => ({
        type: 'line',
        'source-layer': 'country_boundaries',
        paint: {
            'line-color': '#9CA3AF',
            'line-width': 0.5,
            'line-opacity': 0.8,
        },
    }), []);

    return (
        <div className={styles.mapRoot}>
            <GlobalMap mapOptions={mapOptions}>
                <MapSource
                    sourceKey="country-boundaries"
                    sourceOptions={sourceOptions}
                >
                    <MapLayer
                        layerKey="customs-fill"
                        layerOptions={fillLayer}
                    />
                    <MapLayer
                        layerKey="customs-outline"
                        layerOptions={outlineLayer}
                    />

                </MapSource>

                <GoMapContainer
                    className={styles.mapContainer}
                    title={title}
                    withoutDownloadButton
                />

                <div className={styles.legend}>
                    <div className={styles.legendTitle}>IFRC Legal Status</div>
                    <div className={styles.legendItem}>
                        <div
                            className={styles.legendColor}
                            style={{ backgroundColor: '#F6B26B' }}
                        />
                        <div className={styles.legendLabel}>IFRC Legal Status</div>
                    </div>
                    <div className={styles.legendItem}>
                        <div
                            className={styles.legendColor}
                            style={{ backgroundColor: '#4DD0E1' }}
                        />
                        <div className={styles.legendLabel}>No IFRC Legal Status</div>
                    </div>
                </div>
            </GlobalMap>
        </div>
    );
}

export default CustomsRegulationsMap;
