import {
    useEffect,
    useRef,
    useState,
} from 'react';

import * as d3 from 'd3';

type WorldGeoJSON = any;

type CountryMeta = {
    iso3: string;
    name?: string;
    society_name?: string;
    url_ifrc?: string;
};

interface WorldMapProps {
    highlightedIso3?: Set<string>;
    width?: number;
    height?: number;
    onCountryClick?: (iso3: string) => void;
}

export default function WorldMap({
    highlightedIso3 = new Set(),
    width = 1000,
    height = 600,
    onCountryClick,
}: WorldMapProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const worldRef = useRef<WorldGeoJSON | null>(null);
    const [countriesMeta, setCountriesMeta] = useState<Record<string, CountryMeta>>({});
    const nameToIsoRef = useRef<Record<string, string>>({});
    const [hover, setHover] = useState<{
        iso3: string;
        name: string;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        let mounted = true;

        Promise.all([
            fetch('/data/world.geojson').then((r) => r.json()),
            fetch('/data/countries.json').then((r) => r.json()),
        ])
            .then(([world, countriesData]) => {
                if (!mounted) return;
                worldRef.current = world;

                const results = countriesData?.results ?? countriesData ?? [];
                const map: Record<string, CountryMeta> = {};
                const nameToIso: Record<string, string> = {};
                for (const c of results) {
                    if (c.iso3) {
                        map[c.iso3] = {
                            iso3: c.iso3,
                            name: c.name,
                            society_name: c.society_name,
                            url_ifrc: c.url_ifrc,
                        };
                    }
                    if (c.name && c.iso3) {
                        nameToIso[String(c.name).trim().toLowerCase()] = c.iso3;
                    }
                }
                nameToIsoRef.current = nameToIso;
                setCountriesMeta(map);

                draw(world, map);
            })
            .catch((err) => console.error('Error loading map data:', err));

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (worldRef.current) {
            draw(worldRef.current, countriesMeta);
        }
    }, [highlightedIso3, width, height, countriesMeta]);

    function draw(world: WorldGeoJSON, meta: Record<string, CountryMeta>) {
        if (!svgRef.current || !world) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const projection = d3
            .geoNaturalEarth1()
            .fitSize([width, height], world as any);
        const path = d3.geoPath(projection as any);

        svg
            .append('g')
            .selectAll('path')
            .data(world.features as any)
            .join('path')
            .attr('d', path as any)
            .attr('fill', (d: any) => {
                let iso3 = String(d.properties?.['ISO3166-1-Alpha-3'] ?? '');
                if (!iso3 || iso3 === '-99') {
                    const pname = String(
                        d.properties?.name ?? '',
                    )
                        .trim()
                        .toLowerCase();
                    const looked = nameToIsoRef.current[pname];
                    if (looked) iso3 = looked;
                }
                return highlightedIso3.has(iso3) ? '#e4002b' : '#e5e7eb';
            })
            .attr('stroke', '#111')
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .on('mouseenter', function () {
                d3.select(this as any).attr('stroke-width', 1.2);
            })
            .on('mouseleave', function () {
                d3.select(this as any).attr('stroke-width', 0.5);
                setHover(null);
            })
            .on('mousemove', (event: any, d: any) => {
                let iso3 = String(d.properties?.['ISO3166-1-Alpha-3'] ?? '');
                if (!iso3 || iso3 === '-99') {
                    const pname = String(
                        d.properties?.name ?? '',
                    )
                        .trim()
                        .toLowerCase();
                    const looked = nameToIsoRef.current[pname];
                    if (looked) iso3 = looked;
                }
                const name = meta[iso3]?.name
                    ?? String(d.properties?.name ?? iso3);
                const [x, y] = d3.pointer(event, svgRef.current);
                setHover({
                    iso3,
                    name,
                    x: x + 12,
                    y: y + 12,
                });
            })
            .on('click', (_event: any, d: any) => {
                let iso3 = String(d.properties?.['ISO3166-1-Alpha-3'] ?? '');
                if (!iso3 || iso3 === '-99') {
                    const pname = String(
                        d.properties?.name ?? '',
                    )
                        .trim()
                        .toLowerCase();
                    const looked = nameToIsoRef.current[pname];
                    if (looked) iso3 = looked;
                }
                if (iso3 && onCountryClick) onCountryClick(iso3);
            });
    }

    const hoverMeta = hover ? countriesMeta[hover.iso3] : undefined;

    return (
        <div style={{ position: 'relative', width, height }}>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                style={{ display: 'block' }}
            />

            {hover && (
                <div
                    style={{
                        position: 'absolute',
                        left: hover.x,
                        top: hover.y,
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 12,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                        pointerEvents: 'none',
                        maxWidth: 260,
                        zIndex: 1000,
                    }}
                >
                    <div style={{ fontWeight: 700 }}>
                        {hover.name}
                        {' '}
                        (
                        {hover.iso3}
                        )
                    </div>
                    {hoverMeta?.society_name ? (
                        <div style={{ marginTop: 4 }}>
                            {hoverMeta.society_name}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
