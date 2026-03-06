/* eslint-disable max-len */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Button,
    Container,
    DefaultMessage,
    MultiSelectInput,
    Pager,
    SelectInput,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createElementColumn,
    createStringColumn,
} from '@ifrc-go/ui/utils';
import {
    isDefined,
    unique,
} from '@togglecorp/fujs';

import { api } from '#config';
import useCountryRaw from '#hooks/domain/useCountryRaw';
import useFilterState from '#hooks/useFilterState';

import CustomsDataCard from './CustomsDataCard';
import WarehouseStocksMap from './WarehouseStocksMap';

import styles from './WarehouseStocksTable.module.css';

type SelectOption = {
    key: string;
    label: string;
};

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

interface WarehouseStock {
    id: string;
    region: string | null;
    country: string | null;
    country_iso3?: string | null;
    warehouse_name: string | null;
    warehouse_id?: string | null;
    item_group: string | null;
    product_id?: string | null;
    item_name: string | null;
    item_number: string | null;
    item_url?: string | null;
    item_status_name?: string | null;
    unit: string | null;
    quantity: string | null;
}

interface DetailsCellProps {
    url?: string | null;
}

function DetailsCell(props: DetailsCellProps) {
    const { url } = props;

    if (!url) {
        return (
            <span>-</span>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
        >
            Catalogue link
        </a>
    );
}

function parseQty(v: string | null | undefined): number | undefined {
    if (!v) {
        return undefined;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function formatQty(v: string | null | undefined): string {
    const n = parseQty(v);
    if (n === undefined) {
        return '';
    }

    const isIntLike = Math.abs(n - Math.round(n)) < 1e-9;
    if (isIntLike) {
        return Math.round(n).toLocaleString();
    }

    return n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
    });
}

function getPercent(value: number, max: number): number {
    if (max <= 0) {
        return 0;
    }
    return (value / max) * 100;
}

type OwnerKey = 'IFRC' | 'ICRC' | 'NS';

// Only IFRC data exists right now
function getOwner(): OwnerKey {
    return 'IFRC';
}

function WarehouseStocksTable() {
    const [filterRegions, setFilterRegions] = useState<string[] | undefined>();
    const [filterCountries, setFilterCountries] = useState<string[] | undefined>();
    const [filterItemGroup, setFilterItemGroup] = useState<string | undefined>();
    const [filterItemName, setFilterItemName] = useState<string | undefined>();
    const [receivingCountry, setReceivingCountry] = useState<string | undefined>();
    const [suggestions, setSuggestions] = useState<WarehouseSuggestion[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<WarehouseSuggestion | null>(null);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    // receivingCountry is already the ISO3 code from the country selector
    const receivingCountryIso3 = receivingCountry;

    // Derived state from suggestions
    const suggestedWarehouseIds = useMemo(
        () => suggestions.map((s) => s.warehouse_id),
        [suggestions],
    );
    const suggestedCountryIso3s = useMemo(
        () => [...new Set<string>(suggestions.map((s) => s.country_iso3).filter(Boolean))],
        [suggestions],
    );

    const [owner, setOwner] = useState<OwnerKey>('IFRC');

    const { sortState } = useFilterState({ filter: {} });

    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(50);
    const [total, setTotal] = useState<number | undefined>();

    const [regionsOpt, setRegionsOpt] = useState<string[]>([]);
    const [itemGroupsOpt, setItemGroupsOpt] = useState<string[]>([]);
    const [itemNamesOpt, setItemNamesOpt] = useState<string[]>([]);

    const [pending, setPending] = useState(false);
    const [tableData, setTableData] = useState<WarehouseStock[]>([]);
    const [allData, setAllData] = useState<WarehouseStock[] | undefined>();
    const [gapsData, setGapsData] = useState<WarehouseStock[] | undefined>();
    const [aggregatedPending, setAggregatedPending] = useState(false);
    const [aggregatedData, setAggregatedData] = useState<Array<{
        country_iso3?: string | null;
        country?: string | null;
        region?: string | null;
        total_quantity?: string | null;
        warehouse_count?: number | null;
    }>>([]);
    // aggregatedData is fetched with current filters (may include region)
    // mapAggregatedData is fetched without region filter so the map shows all bubbles
    const [mapAggregatedData, setMapAggregatedData] = useState<Array<{
        country_iso3?: string | null;
        country?: string | null;
        region?: string | null;
        total_quantity?: string | null;
        warehouse_count?: number | null;
    }>>([]);
    const [summaryData, setSummaryData] = useState<{
        total?: number;
        by_item_group?: Array<{
            item_group?: string | null;
            total_quantity?: string | null;
            product_count?: number | null;
        }>;
        low_stock?: { threshold?: number; count?: number };
    } | undefined>();
    const prefetchCacheRef = useRef<Map<number, { rows: WarehouseStock[]; total?: number }>>(new Map());
    const prefetchControllersRef = useRef<Map<number, AbortController>>(new Map());
    const prevFiltersKeyRef = useRef<string>('');

    useEffect(() => {
        let mounted = true;
        fetch(`${api}/api/v1/warehouse-stocks/?distinct=1`)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setRegionsOpt(data.regions || []);
                setItemGroupsOpt(data.item_groups || []);
                setItemNamesOpt(data.item_names || []);
            })
            .catch(() => {
                // ignore
            })
            .finally(() => {
                // ignore
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        setPending(true);
        const filtersKey = [(filterRegions || []).join(','), (filterCountries || []).join(','), filterItemGroup, filterItemName, sortState.sorting?.name, sortState.sorting?.direction, String(pageSize)].join('|');
        const hasFiltersChanged = prevFiltersKeyRef.current !== filtersKey;
        if (hasFiltersChanged) {
            prefetchControllersRef.current.forEach((c) => {
                try { c.abort(); } catch { /* ignore */ }
            });
            prefetchControllersRef.current.clear();
            prefetchCacheRef.current.clear();
            prevFiltersKeyRef.current = filtersKey;
        }

        const pref = prefetchCacheRef.current.get(page);
        if (pref) {
            setTableData(pref.rows);
            setTotal(pref.total);
            setPending(false);
            return () => { mounted = false; };
        }

        const controller = new AbortController();
        const { signal } = controller;

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(pageSize));
        if (filterRegions && filterRegions.length > 0) params.set('region', filterRegions.join(','));
        if (filterCountries && filterCountries.length > 0) {
            params.set('country_iso3', filterCountries.join(','));
        }
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);
        // sort mapping: frontend sorts use column ids like 'quantity' or 'item_name'
        if (sortState.sorting) {
            params.set('sort', sortState.sorting.name);
            params.set('order', sortState.sorting.direction === 'dsc' ? 'desc' : 'asc');
        }

        const url = `${api}/api/v1/warehouse-stocks/?${params.toString()}`;
        fetch(url, { signal })
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                const results: WarehouseStock[] = (data && data.results) || [];
                let totalCount: number | undefined;
                if (data && data.total != null) {
                    const parsed = Number(data.total);
                    if (Number.isFinite(parsed)) {
                        totalCount = parsed;
                    } else {
                        totalCount = results.length;
                    }
                } else {
                    totalCount = results.length;
                }
                setTableData(results);
                setTotal(totalCount);

                if (totalCount && totalCount > 0) {
                    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
                    const toPrefetchSet = new Set<number>();
                    for (let d = -2; d <= 2; d += 1) {
                        const p = page + d;
                        if (p >= 1 && p <= totalPages && p !== page) toPrefetchSet.add(p);
                    }
                    toPrefetchSet.add(1);
                    toPrefetchSet.add(totalPages);

                    const schedulePrefetch = (pnum: number) => {
                        if (pnum === page) return;
                        if (prefetchCacheRef.current.has(pnum)) return;
                        if (prefetchControllersRef.current.has(pnum)) return;

                        const pParams = new URLSearchParams(params.toString());
                        pParams.set('page', String(pnum));
                        const prefetchUrl = `${api}/api/v1/warehouse-stocks/?${pParams.toString()}`;
                        const prefetchController = new AbortController();
                        prefetchControllersRef.current.set(pnum, prefetchController);
                        fetch(prefetchUrl, { signal: prefetchController.signal })
                            .then((r) => r.json())
                            .then((prefData) => {
                                const prefResults: WarehouseStock[] = (prefData && prefData.results) || [];
                                prefetchCacheRef.current.set(pnum, { rows: prefResults, total: totalCount });
                            })
                            .catch(() => {
                                // ignore prefetch errors
                            })
                            .finally(() => {
                                prefetchControllersRef.current.delete(pnum);
                            });
                    };

                    toPrefetchSet.forEach((pnum) => {
                        schedulePrefetch(pnum);
                    });
                }
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                if (!mounted) return;
                setTableData([]);
                setTotal(undefined);
            })
            .finally(() => {
                if (mounted) setPending(false);
            });

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [
        page,
        pageSize,
        filterRegions,
        filterCountries,
        filterItemGroup,
        filterItemName,
        sortState.sorting,
    ]);

    useEffect(() => () => {
        prefetchControllersRef.current.forEach((c) => {
            try { c.abort(); } catch { /* ignore */ }
        });
        prefetchControllersRef.current.clear();
        prefetchCacheRef.current.clear();
    }, []);

    useEffect(() => {
        let mounted = true;
        setAggregatedPending(true);
        const params = new URLSearchParams();
        if (filterRegions && filterRegions.length > 0) params.set('region', filterRegions.join(','));
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);

        const url = `${api}/api/v1/warehouse-stocks/aggregated/?${params.toString()}`;
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setAggregatedData(Array.isArray(data?.results) ? data.results : []);
            })
            .catch(() => {
                if (!mounted) return;
                setAggregatedData([]);
            })
            .finally(() => {
                if (mounted) setAggregatedPending(false);
            });

        // fetch unfiltered aggregated data for map (do not include region filter)
        const mapParams = new URLSearchParams();
        if (filterItemGroup) mapParams.set('item_group', filterItemGroup);
        if (filterItemName) mapParams.set('item_name', filterItemName);
        const mapUrl = `${api}/api/v1/warehouse-stocks/aggregated/?${mapParams.toString()}`;
        fetch(mapUrl)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setMapAggregatedData(Array.isArray(data?.results) ? data.results : []);
            })
            .catch(() => {
                if (!mounted) return;
                setMapAggregatedData([]);
            });

        return () => {
            mounted = false;
        };
    }, [filterRegions, filterItemGroup, filterItemName]);

    useEffect(() => {
        setPage(1);
    }, [
        filterRegions,
        filterCountries,
        filterItemGroup,
        filterItemName,
    ]);

    useEffect(() => {
        let mounted = true;
        setSummaryData(undefined);

        const params = new URLSearchParams();
        if (filterRegions && filterRegions.length > 0) params.set('region', filterRegions.join(','));
        if (filterCountries && filterCountries.length > 0) {
            params.set('country_iso3', filterCountries.join(','));
        }
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);
        params.set('low_stock_threshold', '5');

        const url = `${api}/api/v1/warehouse-stocks/summary/?${params.toString()}`;
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setSummaryData(data || undefined);
                setAllData(undefined);
                setGapsData(undefined);
            })
            .catch(() => {
                if (!mounted) return;
                setSummaryData(undefined);
            });

        return () => {
            mounted = false;
        };
    }, [filterRegions, filterCountries, filterItemGroup, filterItemName]);

    // Fetch warehouse suggestions when receiving country AND item name are both selected
    useEffect(() => {
        // Clear suggestions if either is missing
        if (!receivingCountry || !filterItemName) {
            setSuggestions([]);
            setSelectedSuggestion(null);
            return undefined;
        }

        let mounted = true;
        setSuggestionsLoading(true);
        setSelectedSuggestion(null);

        const params = new URLSearchParams();
        params.set('receiving_country', receivingCountry);
        params.set('item_name', filterItemName);

        fetch(`${api}/api/v1/warehouse-suggestions/?${params.toString()}`)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                const suggestionsList: WarehouseSuggestion[] = (data.suggestions || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (s: any) => ({
                        warehouse_id: s.warehouse_id ?? '',
                        warehouse_name: s.warehouse_name ?? '',
                        country: s.country ?? '',
                        country_iso3: s.country_iso3 ?? '',
                        distance_km: s.distance_km ?? null,
                        distance_score: s.distance_score ?? 0,
                        export_penalty: s.export_penalty ?? 0,
                        export_summary: s.export_summary ?? '',
                        stock_quantity: s.stock_quantity ?? 0,
                        stock_score: s.stock_score ?? 0,
                        total_score: s.total_score ?? 0,
                        is_domestic: s.is_domestic ?? false,
                    }),
                );
                setSuggestions(suggestionsList);
            })
            .catch(() => {
                if (mounted) {
                    setSuggestions([]);
                }
            })
            .finally(() => {
                if (mounted) setSuggestionsLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [receivingCountry, filterItemName]);

    const regionOptions = useMemo(() => {
        const fromDistinct = (regionsOpt || []).filter((v) => isDefined(v) && String(v).trim() !== '');
        const fromAggregated = (aggregatedData || []).map((a) => a.region).filter((v) => isDefined(v) && String(v).trim() !== '');
        const fromAll = (allData || []).map((r) => r.region).filter((v) => isDefined(v) && String(v).trim() !== '');
        const FALLBACK_REGIONS = [
            'Americas',
            'Asia-Pacific',
            'MENA',
            'Europe',
            'Africa',
        ];

        const combined = unique([
            ...fromDistinct,
            ...fromAggregated,
            ...fromAll,
            ...FALLBACK_REGIONS,
        ]).sort((a, b) => String(a).localeCompare(String(b)));

        return combined.map((r) => ({ key: String(r), label: String(r) }));
    }, [regionsOpt, aggregatedData, allData]);
    const countriesRaw = useCountryRaw() as Array<{ iso3?: string | null; name?: string | null }> | undefined;

    const countryOptions = useMemo(() => {
        const results = countriesRaw ?? [];

        const isoSet = new Set<string>();

        (aggregatedData || []).forEach((a) => {
            const iso = (a.country_iso3 || '').toString().trim();
            if (!iso) return;
            const wc = typeof a.warehouse_count === 'number' ? a.warehouse_count : 0;
            const qty = parseQty(a.total_quantity) ?? 0;
            if (wc > 0 || qty > 0) {
                isoSet.add(iso.toUpperCase());
            }
        });

        const baseRows = allData ?? tableData;
        (baseRows || []).forEach((r) => {
            const iso = (r.country_iso3 || '').toString().trim();
            if (!iso) return;
            if (r.warehouse_name) {
                isoSet.add(iso.toUpperCase());
            }
        });

        return results
            .filter((c) => c.iso3 && c.name && isoSet.has((c.iso3 || '').toString().toUpperCase()))
            .map((c) => ({
                key: c.iso3 as string,
                label: c.name as string,
            }));
    }, [countriesRaw, aggregatedData, allData, tableData]);

    // All countries for receiving country selector (not filtered by warehouse data)
    const allCountryOptions = useMemo(() => {
        const results = countriesRaw ?? [];
        return results
            .filter((c) => c.iso3 && c.name)
            .map((c) => ({
                key: c.iso3 as string,
                label: c.name as string,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [countriesRaw]);

    const itemGroupOptions = useMemo(() => {
        const fromDistinct = (itemGroupsOpt || []).filter(isDefined);
        const fromSummary = (summaryData?.by_item_group || []).map((g) => g.item_group).filter(isDefined);
        const fromAll = ((allData ?? tableData) || []).map((r) => r.item_group).filter(isDefined);
        const combined = unique([
            ...fromDistinct,
            ...fromSummary,
            ...fromAll,
        ], (v) => String(v).toLowerCase()).sort((a, b) => String(a).localeCompare(String(b)));
        return combined.map((g) => ({ key: String(g), label: String(g) }));
    }, [itemGroupsOpt, summaryData, allData, tableData]);

    const itemNameOptions = useMemo(() => {
        const fromDistinct = (itemNamesOpt || []).filter(isDefined);
        const fromAll = ((allData ?? tableData) || []).map((r) => r.item_name).filter(isDefined);
        const combined = unique([
            ...fromDistinct,
            ...fromAll,
        ], (v) => String(v).toLowerCase()).sort((a, b) => String(a).localeCompare(String(b)));
        return combined.map((n) => ({ key: String(n), label: String(n) }));
    }, [itemNamesOpt, allData, tableData]);

    const mapData = useMemo(
        () => (mapAggregatedData || []).map((a) => ({
            id: (a.country_iso3 || a.country || '') as string,
            region: a.region ?? null,
            country: a.country ?? null,
            country_iso3: a.country_iso3 ?? null,
            warehouse_name: null,
            warehouse_count: a.warehouse_count ?? undefined,
            item_group: null,
            item_name: null,
            item_number: null,
            item_status_name: null,
            unit: null,
            quantity: a.total_quantity ?? null,
        } as WarehouseStock)),
        [mapAggregatedData],
    );

    const selectedCountryHasData = useMemo(() => {
        if (!filterCountries || filterCountries.length === 0) return true;
        if (aggregatedPending) return true;
        const found = (aggregatedData || []).filter(
            (a) => filterCountries.some(
                (c) => ((a.country_iso3 || a.country || '') as string)
                    .toUpperCase() === c.toUpperCase(),
            ),
        );
        if (!found || found.length === 0) return false;
        return found.some((f) => {
            const count = typeof f.warehouse_count === 'number' ? f.warehouse_count : 0;
            const qty = parseQty(f.total_quantity) ?? 0;
            return count > 0 || qty > 0;
        });
    }, [filterCountries, aggregatedData, aggregatedPending]);

    const columns = useMemo(
        () => [
            createStringColumn<WarehouseStock, string>(
                'region',
                'Region',
                (item) => item.region ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'country',
                'Country',
                (item) => item.country ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'warehouse_id',
                'Warehouse ID',
                (item) => item.warehouse_id ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'warehouse_managed_by',
                'Warehouse managed by',
                () => 'IFRC',
                { sortable: false },
            ),
            createStringColumn<WarehouseStock, string>(
                'item_group',
                'Item categories',
                (item) => item.item_group ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'product_id',
                'Product ID',
                (item) => item.product_id ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'item_name',
                'Item name',
                (item) => item.item_name ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'quantity',
                'Quantity',
                (item) => formatQty(item.quantity),
                { sortable: true },
            ),
            createElementColumn<WarehouseStock, string, DetailsCellProps>(
                'details',
                'Details',
                DetailsCell,
                (_, item) => ({
                    url: item.item_url,
                }),
            ),
            createStringColumn<WarehouseStock, string>(
                'contact',
                'Contact',
                () => 'ifrcwarehouse@ifrc.org',
                { sortable: false },
            ),
            createStringColumn<WarehouseStock, string>(
                'status',
                'Status',
                (item) => item.item_status_name ?? '',
                { sortable: false },
            ),
        ],
        [],
    );

    const displayData = tableData;

    const stringKeySelector = useCallback((option: SelectOption) => option.key, []);
    const stringLabelSelector = useCallback((option: SelectOption) => option.label, []);
    const emptyOptions = useMemo<SelectOption[]>(() => [], []);

    const handleRegionChange = useCallback((newValue: (string | number)[] | undefined) => {
        setFilterRegions(newValue as string[] | undefined);
    }, []);

    const handleCountriesChange = useCallback((newValue: (string | number)[] | undefined) => {
        setFilterCountries(newValue as string[] | undefined);
    }, []);

    const handleItemGroupChange = useCallback((newValue: string | undefined) => {
        setFilterItemGroup(newValue);
    }, []);

    const handleItemNameChange = useCallback((newValue: string | undefined) => {
        setFilterItemName(newValue);
    }, []);

    const handleReceivingCountryChange = useCallback((newValue: string | undefined) => {
        setReceivingCountry(newValue);
    }, []);

    const handleClearAll = useCallback(() => {
        setFilterRegions(undefined);
        setFilterCountries(undefined);
        setFilterItemGroup(undefined);
        setFilterItemName(undefined);
        setReceivingCountry(undefined);
        setSuggestions([]);
        setSelectedSuggestion(null);
        setOwner('IFRC');
    }, []);

    const handleSuggestionClick = useCallback((suggestion: WarehouseSuggestion) => {
        setSelectedSuggestion(suggestion);
    }, []);

    const handleDismissSuggestion = useCallback(() => {
        setSelectedSuggestion(null);
    }, []);

    const keySelector = useCallback((item: WarehouseStock) => item.id, []);

    // Row className for green highlighting of suggested warehouses
    const getRowClassName = useCallback((key: string) => {
        // Extract warehouse_id from the key (format: "warehouse_id__product_id")
        const warehouseId = key.split('__')[0] ?? '';
        if (warehouseId && suggestedWarehouseIds.includes(warehouseId)) {
            return styles.suggestedRow;
        }
        return undefined;
    }, [suggestedWarehouseIds]);

    const chartData = useMemo(() => {
        if (summaryData && Array.isArray(summaryData.by_item_group)) {
            const rows = summaryData.by_item_group
                .map((g) => ({ label: g.item_group ?? 'Unknown', value: Number(g.total_quantity ?? 0) }))
                .sort((a, b) => b.value - a.value);
            const max = rows[0]?.value ?? 0;
            return { rows, max };
        }

        let base = allData ?? tableData;

        if (owner) {
            base = base.filter(() => getOwner() === owner);
        }

        if (filterRegions && filterRegions.length > 0) base = base.filter((i) => filterRegions.includes(i.region ?? ''));
        if (filterCountries && filterCountries.length > 0) {
            base = base.filter((i) => filterCountries.includes(i.country_iso3 ?? ''));
        }
        if (filterItemName) base = base.filter((i) => i.item_name === filterItemName);

        const totals = new Map<string, number>();
        base.forEach((row) => {
            const group = row.item_group ?? 'Unknown';
            const q = parseQty(row.quantity) ?? 0;
            totals.set(group, (totals.get(group) ?? 0) + q);
        });

        const rows = Array.from(totals.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);

        const max = rows[0]?.value ?? 0;
        return { rows, max };
    }, [
        summaryData,
        allData,
        tableData,
        filterRegions,
        filterCountries,
        filterItemName,
        owner,
    ]);

    const lowStockData = useMemo(() => {
        if (summaryData && Array.isArray(summaryData.by_item_group)) {
            const rows = summaryData.by_item_group
                .map((g) => ({ label: g.item_group ?? 'Unknown', value: Number(g.total_quantity ?? 0) }))
                .sort((a, b) => a.value - b.value)
                .slice(0, 6);
            const max = rows[rows.length - 1]?.value ?? 0;
            return { rows, max };
        }

        let base = gapsData ?? allData ?? tableData;

        if (owner) {
            base = base.filter(() => getOwner() === owner);
        }

        if (filterRegions && filterRegions.length > 0) base = base.filter((i) => filterRegions.includes(i.region ?? ''));
        if (filterCountries && filterCountries.length > 0) {
            base = base.filter((i) => filterCountries.includes(i.country_iso3 ?? ''));
        }
        if (filterItemName) base = base.filter((i) => i.item_name === filterItemName);

        const totals = new Map<string, number>();
        base.forEach((row) => {
            const group = row.item_group ?? 'Unknown';
            const q = parseQty(row.quantity) ?? 0;
            totals.set(group, (totals.get(group) ?? 0) + q);
        });

        const rows = Array.from(totals.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => a.value - b.value)
            .slice(0, 6);

        const max = rows[rows.length - 1]?.value ?? 0;
        return { rows, max };
    }, [
        summaryData,
        gapsData,
        allData,
        tableData,
        owner,
        filterRegions,
        filterCountries,
        filterItemName,
    ]);

    const ownerStats = useMemo(() => {
        if (summaryData && Array.isArray(summaryData.by_item_group)) {
            return {
                ifrcWarehouses: 0,
                ifrcItemGroups: summaryData.by_item_group.length,
            };
        }

        let base = allData ?? tableData;
        if (owner) {
            base = base.filter(() => getOwner() === owner);
        }

        const warehouses = new Set<string>();
        const itemGroups = new Set<string>();

        base.forEach((row) => {
            if (row.warehouse_name) {
                warehouses.add(row.warehouse_name);
            }
            if (row.item_group) {
                itemGroups.add(row.item_group);
            }
        });

        return {
            ifrcWarehouses: warehouses.size,
            ifrcItemGroups: itemGroups.size,
        };
    }, [summaryData, allData, tableData, owner]);

    const showNoCountryData = Boolean(
        filterCountries
        && filterCountries.length > 0
        && !pending
        && !selectedCountryHasData,
    );

    // pagination removed — table shows all fetched rows on the map

    return (
        <Container
            className={styles.page}
            headingLevel={2}
        >
            <div className={styles.layout}>
                {/* Owner filters (top row) */}
                <div className={styles.ownerRow}>
                    <div className={styles.ownerCard}>
                        <div className={styles.ownerButtons}>
                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-active={owner === 'IFRC'}
                                onClick={() => setOwner('IFRC')}
                            >
                                <div className={styles.ownerLineBig}>IFRC</div>
                                <div className={styles.ownerLineSmall}>
                                    {ownerStats.ifrcWarehouses}
                                    {' '}
                                    warehouses
                                    {' '}
                                    |
                                    {' '}
                                    {ownerStats.ifrcItemGroups}
                                    {' '}
                                    item categories
                                </div>
                            </button>

                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-disabled="true"
                                title="No data yet"
                            >
                                <div className={styles.ownerLineBig}>ICRC</div>
                                <div className={styles.ownerLineSmall}>
                                    0
                                    {' '}
                                    warehouses
                                    {' '}
                                    |
                                    {' '}
                                    0
                                    {' '}
                                    item categories
                                </div>
                            </button>

                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-disabled="true"
                                title="No data yet"
                            >
                                <div className={styles.ownerLineBig}>NS</div>
                                <div className={styles.ownerLineSmall}>
                                    0
                                    {' '}
                                    warehouses
                                    {' '}
                                    |
                                    {' '}
                                    0
                                    {' '}
                                    item categories
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stock filters (second row) */}
                <div className={styles.filtersCard}>
                    <div className={styles.filterItem}>
                        <MultiSelectInput
                            placeholder="All Regions"
                            label="Region"
                            name="region"
                            value={filterRegions}
                            onChange={handleRegionChange}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={regionOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <MultiSelectInput
                            placeholder="All Countries"
                            label="Country"
                            name="countries"
                            value={filterCountries}
                            onChange={handleCountriesChange}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={countryOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="Select receiving country"
                            label="Receiving Country"
                            name="receiving_country"
                            value={receivingCountry}
                            onChange={handleReceivingCountryChange}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={allCountryOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Item categories"
                            label="Item category"
                            name="item_group"
                            value={filterItemGroup}
                            onChange={handleItemGroupChange}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={itemGroupOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Item names"
                            label="Item name"
                            name="item_name"
                            value={filterItemName}
                            onChange={handleItemNameChange}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={itemNameOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Organisations"
                            label="Organisation"
                            name="organisation"
                            value={undefined}
                            onChange={() => undefined}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={emptyOptions}
                        />
                    </div>

                    <div className={styles.clearRow}>
                        <Button
                            name="clear_filters"
                            onClick={() => handleClearAll()}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </div>

                {/* MAP */}
                <div className={styles.mapCard}>
                    <WarehouseStocksMap
                        data={mapData}
                        selectedCountryNames={filterCountries}
                        selectedRegions={filterRegions}
                        onCountrySelect={setFilterCountries}
                        suggestedCountryIso3s={suggestedCountryIso3s}
                        suggestions={suggestions}
                        onSuggestionClick={handleSuggestionClick}
                        receivingCountryIso3={receivingCountryIso3}
                    />
                </div>

                {/* Suggestion Summary Panel */}
                {selectedSuggestion && (
                    <div className={styles.suggestionSummary}>
                        <div className={styles.suggestionHeader}>
                            <span className={styles.suggestionTitle}>
                                📍 Why
                                {' '}
                                {selectedSuggestion.warehouse_name || selectedSuggestion.warehouse_id}
                                {' '}
                                was suggested
                                {selectedSuggestion.is_domestic ? ' (Domestic)' : ''}
                            </span>
                            <button
                                type="button"
                                className={styles.dismissButton}
                                onClick={handleDismissSuggestion}
                                aria-label="Dismiss"
                            >
                                ✕
                            </button>
                        </div>
                        <div className={styles.suggestionDetails}>
                            <div className={styles.scoreRow}>
                                <span className={styles.scoreLabel}>
                                    Distance:
                                    {' '}
                                    {selectedSuggestion.is_domestic
                                        ? 'Same country'
                                        : `${selectedSuggestion.distance_km?.toLocaleString() ?? 'N/A'} km`}
                                </span>
                                <span className={styles.scoreValue}>
                                    {selectedSuggestion.distance_score}
                                    /100 pts
                                </span>
                            </div>
                            <div className={styles.scoreRow}>
                                <span className={styles.scoreLabel}>
                                    Export Status:
                                    {' '}
                                    {(() => {
                                        if (selectedSuggestion.is_domestic) {
                                            return 'No export needed';
                                        }
                                        if (selectedSuggestion.export_penalty === 0) {
                                            return 'No restrictions';
                                        }
                                        if (selectedSuggestion.export_penalty >= -10) {
                                            return 'Minor bureaucracy';
                                        }
                                        return 'Restrictions apply';
                                    })()}
                                </span>
                                <span className={styles.scoreValue}>
                                    {selectedSuggestion.export_penalty}
                                    {' pts'}
                                </span>
                            </div>
                            {selectedSuggestion.export_summary && (
                                <div className={styles.exportSummaryRow}>
                                    <span className={styles.exportSummaryText}>
                                        {selectedSuggestion.export_summary}
                                    </span>
                                </div>
                            )}
                            <div className={styles.scoreRow}>
                                <span className={styles.scoreLabel}>
                                    Stock Available:
                                    {' '}
                                    {Math.round(selectedSuggestion.stock_quantity).toLocaleString()}
                                    {' '}
                                    units
                                </span>
                                <span className={styles.scoreValue}>
                                    {selectedSuggestion.stock_score}
                                    /50 pts
                                </span>
                            </div>
                            <div className={styles.scoreDivider} />
                            <div className={styles.scoreRow}>
                                <span className={styles.scoreLabelTotal}>Total Score:</span>
                                <span className={styles.scoreValueTotal}>
                                    {selectedSuggestion.total_score}
                                    /150
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className={styles.tableCard}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableInfo}>
                            {total !== undefined && (
                                <span>
                                    Showing
                                    {' '}
                                    {((page - 1) * pageSize) + 1}
                                    {' '}
                                    –
                                    {' '}
                                    {Math.min(page * pageSize, total)}
                                    {' '}
                                    of
                                    {' '}
                                    {total.toLocaleString()}
                                    {' '}
                                    items
                                </span>
                            )}
                        </div>
                        <div className={styles.tablePagination}>
                            <Pager
                                activePage={page}
                                itemsCount={total ?? 0}
                                maxItemsPerPage={pageSize}
                                onActivePageChange={setPage}
                            />
                        </div>
                    </div>
                    <div className={styles.tableScroll}>
                        <SortContext.Provider value={sortState}>
                            {showNoCountryData ? (
                                <DefaultMessage
                                    empty
                                    emptyMessage="No data found for the selected country"
                                    pending={false}
                                    filtered={false}
                                    errored={false}
                                />
                            ) : (
                                <Table
                                    data={displayData}
                                    keySelector={keySelector}
                                    columns={columns}
                                    pending={pending || suggestionsLoading}
                                    filtered={false}
                                    rowClassName={getRowClassName}
                                />
                            )}
                        </SortContext.Provider>
                    </div>
                </div>

                {/* Charts (below table) */}
                <div className={styles.chartsRow}>
                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div className={styles.chartTitle}>
                                Most Requested Item Categories
                            </div>
                            {filterItemGroup && (
                                <Button
                                    name="clear_item_group"
                                    onClick={() => setFilterItemGroup(undefined)}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>

                        <div className={styles.chartBody}>
                            {chartData.rows.length === 0 ? (
                                <div className={styles.chartEmpty}>No items</div>
                            ) : (
                                chartData.rows.map((r) => (
                                    <button
                                        type="button"
                                        className={styles.chartRow}
                                        key={r.label}
                                        data-active={filterItemGroup === r.label}
                                        onClick={() => setFilterItemGroup(
                                            filterItemGroup === r.label ? undefined : r.label,
                                        )}
                                        title={r.label}
                                    >
                                        <div className={styles.chartLabel}>{r.label}</div>
                                        <div className={styles.chartBarWrap}>
                                            <div
                                                className={styles.chartBar}
                                                style={{
                                                    width: `${getPercent(r.value, chartData.max)}%`,
                                                }}
                                            />
                                        </div>
                                        <div className={styles.chartValue}>
                                            {Math.round(r.value).toLocaleString()}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div className={styles.chartTitle}>
                                Key Items Low or Out of Stock
                            </div>
                        </div>

                        <div className={styles.verticalChart}>
                            {lowStockData.rows.length === 0 ? (
                                <div className={styles.chartEmpty}>No items</div>
                            ) : (
                                lowStockData.rows.map((r) => (
                                    <div
                                        className={styles.verticalBarItem}
                                        key={r.label}
                                        title={r.label}
                                    >
                                        <div className={styles.verticalBar}>
                                            <div
                                                className={styles.verticalBarFill}
                                                style={{
                                                    height: `${getPercent(r.value, lowStockData.max)}%`,
                                                }}
                                            />
                                        </div>
                                        <div className={styles.verticalBarLabel}>{r.label}</div>
                                        <div className={styles.verticalBarValue}>
                                            {Math.round(r.value).toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Customs Data Card - shown when a receiving country is selected */}
                {receivingCountryIso3 && (
                    <CustomsDataCard countryIso3={receivingCountryIso3} />
                )}
            </div>
        </Container>
    );
}

export default WarehouseStocksTable;
