import { useMemo } from 'react';
import type { FillPaint } from 'mapbox-gl';

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

    // Build a match expression mapping iso3 -> color
    // Uses 'iso3' property from the composite source (same as FrameworkAgreements)
    const adminZeroFillPaint = useMemo<FillPaint>(() => {
        const colorMatches: unknown[] = [];

        rows.forEach((r) => {
            const iso3 = (r.iso3 ?? '').trim().toUpperCase();
            if (iso3.length === 0) return;

            const status = normalizeYesNo(r.ifrcLegalStatus);
            if (status === 'Yes') {
                colorMatches.push(iso3, '#F6B26B');
            } else if (status === 'No') {
                colorMatches.push(iso3, '#4DD0E1');
            }
        });

        const colorExpression = colorMatches.length > 0
            ? ['match', ['get', 'iso3'], ...colorMatches, 'rgba(0,0,0,0)'] as mapboxgl.Expression
            : 'rgba(0,0,0,0)' as unknown as mapboxgl.Expression;

        return {
            'fill-color': colorExpression,
            'fill-opacity': 0.75,
        };
    }, [rows]);

    return (
        <div className={styles.mapRoot}>
            <GlobalMap
                mapOptions={mapOptions}
                adminZeroFillPaint={adminZeroFillPaint}
            >
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
