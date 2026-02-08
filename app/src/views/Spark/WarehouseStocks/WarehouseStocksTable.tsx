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

import useCountryRaw from '#hooks/domain/useCountryRaw';
import useFilterState from '#hooks/useFilterState';

import WarehouseStocksMap from './WarehouseStocksMap';

import styles from './WarehouseStocksTable.module.css';

type SelectOption = {
    key: string;
    label: string;
};

interface WarehouseStock {
    id: string;
    region: string | null;
    country: string | null;
    country_iso3?: string | null;
    warehouse_name: string | null;
    item_group: string | null;
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
    const [filterRegion, setFilterRegion] = useState<string | undefined>();
    const [filterCountries, setFilterCountries] = useState<string[] | undefined>();
    const [filterItemGroup, setFilterItemGroup] = useState<string | undefined>();
    const [filterItemName, setFilterItemName] = useState<string | undefined>();

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

    useMemo(() => {
        let mounted = true;
        fetch('/api/v1/warehouse-stocks/?distinct=1')
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

    // Fetch table data (on-demand pagination - single page only)
    useEffect(() => {
        let mounted = true;
        setPending(true);
        // Detect filter/sort key and clear prefetch cache/controllers if they changed
        const filtersKey = [filterRegion, (filterCountries || []).join(','), filterItemGroup, filterItemName, sortState.sorting?.name, sortState.sorting?.direction, String(pageSize)].join('|');
        const hasFiltersChanged = prevFiltersKeyRef.current !== filtersKey;
        if (hasFiltersChanged) {
            // abort outstanding prefetches and clear cache
            prefetchControllersRef.current.forEach((c) => {
                try { c.abort(); } catch (_) { /* ignore */ }
            });
            prefetchControllersRef.current.clear();
            prefetchCacheRef.current.clear();
            prevFiltersKeyRef.current = filtersKey;
        }

        // Serve prefetched page if available
        const pref = prefetchCacheRef.current.get(page);
        if (pref) {
            setTableData(pref.rows);
            setTotal(pref.total);
            setPending(false);
            return () => { mounted = false; };
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(pageSize));
        if (filterRegion) params.set('region', filterRegion);
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

        const url = `/api/v1/warehouse-stocks/?${params.toString()}`;
        fetch(url, { signal })
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                const results: WarehouseStock[] = (data && data.results) || [];
                // Coerce total to a number when possible. Some backends return total as string.
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

                // Prefetch relevant pages: neighbours, first and last (within bounds)
                if (totalCount && totalCount > 0) {
                    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
                    const toPrefetchSet = new Set<number>();
                    // neighbours: -2..+2
                    for (let d = -2; d <= 2; d += 1) {
                        const p = page + d;
                        if (p >= 1 && p <= totalPages && p !== page) toPrefetchSet.add(p);
                    }
                    // include first and last
                    toPrefetchSet.add(1);
                    toPrefetchSet.add(totalPages);

                    const schedulePrefetch = (pnum: number) => {
                        if (pnum === page) return;
                        if (prefetchCacheRef.current.has(pnum)) return;
                        if (prefetchControllersRef.current.has(pnum)) return;

                        const pParams = new URLSearchParams(params.toString());
                        pParams.set('page', String(pnum));
                        const prefetchUrl = `/api/v1/warehouse-stocks/?${pParams.toString()}`;
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
        filterRegion,
        filterCountries,
        filterItemGroup,
        filterItemName,
        sortState.sorting,
    ]);

    // On component unmount, abort any outstanding prefetch controllers
    useEffect(() => () => {
        prefetchControllersRef.current.forEach((c) => {
            try { c.abort(); } catch (_) { /* ignore */ }
        });
        prefetchControllersRef.current.clear();
        prefetchCacheRef.current.clear();
    }, []);

    useEffect(() => {
        let mounted = true;
        setAggregatedPending(true);

        const params = new URLSearchParams();
        if (filterRegion) params.set('region', filterRegion);
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);

        const url = `/api/v1/warehouse-stocks/aggregated/?${params.toString()}`;
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

        return () => {
            mounted = false;
        };
    }, [filterRegion, filterItemGroup, filterItemName]);

    // Reset to first page when filters change
    useEffect(() => {
        setPage(1);
    }, [
        filterRegion,
        filterCountries,
        filterItemGroup,
        filterItemName,
    ]);

    // Fetch lightweight summary for charts and counts instead of fetching all rows
    useEffect(() => {
        let mounted = true;
        setSummaryData(undefined);

        const params = new URLSearchParams();
        if (filterRegion) params.set('region', filterRegion);
        if (filterCountries && filterCountries.length > 0) {
            params.set('country_iso3', filterCountries.join(','));
        }
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);
        // allow frontend to specify low stock threshold if needed
        params.set('low_stock_threshold', '5');

        const url = `/api/v1/warehouse-stocks/summary/?${params.toString()}`;
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setSummaryData(data || undefined);
                // clear heavy datasets to avoid memory usage
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
    }, [filterRegion, filterCountries, filterItemGroup, filterItemName]);

    const regionOptions = useMemo(() => {
        const fromDistinct = (regionsOpt || []).filter(isDefined);
        const fromAggregated = (aggregatedData || []).map((a) => a.region).filter(isDefined);
        const fromAll = (allData || []).map((r) => r.region).filter(isDefined);
        const combined = unique([
            ...fromDistinct,
            ...fromAggregated,
            ...fromAll,
        ]);
        return combined.map((r) => ({ key: r as string, label: r as string }));
    }, [regionsOpt, aggregatedData, allData]);
    const countriesRaw = useCountryRaw();

    const iso3ToName = useMemo(() => {
        const m = new Map<string, string>();
        (countriesRaw ?? []).forEach((c) => {
            if (c.iso3 && c.name) {
                m.set(c.iso3, c.name);
            }
        });
        return m;
    }, [countriesRaw]);

    const countryOptions = useMemo(() => {
        const results = countriesRaw ?? [];
        return results
            .filter((c) => c.iso3 && c.name)
            .map((c) => ({
                key: c.iso3 as string,
                label: c.name as string,
            }));
    }, [countriesRaw]);
    const itemGroupOptions = useMemo(
        () => (itemGroupsOpt || []).map((g) => ({ key: g, label: g })),
        [itemGroupsOpt],
    );
    const itemNameOptions = useMemo(
        () => (itemNamesOpt || []).map((n) => ({ key: n, label: n })),
        [itemNamesOpt],
    );

    const mapData = useMemo(
        () => (aggregatedData || []).map((a) => ({
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
        [aggregatedData],
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

    const handleClearAll = useCallback(() => {
        setFilterRegion(undefined);
        setFilterCountries(undefined);
        setFilterItemGroup(undefined);
        setFilterItemName(undefined);
        setOwner('IFRC');
    }, []);

    const keySelector = useCallback((item: WarehouseStock) => item.id, []);

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

        if (filterRegion) base = base.filter((i) => i.region === filterRegion);
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
        filterRegion,
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

        if (filterRegion) base = base.filter((i) => i.region === filterRegion);
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
        filterRegion,
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
                        <SelectInput
                            placeholder="All Regions"
                            label="Region"
                            name={undefined}
                            value={filterRegion}
                            onChange={setFilterRegion}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={regionOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <MultiSelectInput
                            placeholder="All Countries"
                            label="Country"
                            name={undefined}
                            value={filterCountries}
                            onChange={setFilterCountries}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={countryOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Item categories"
                            label="Item category"
                            name={undefined}
                            value={filterItemGroup}
                            onChange={setFilterItemGroup}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={itemGroupOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Item names"
                            label="Item name"
                            name={undefined}
                            value={filterItemName}
                            onChange={setFilterItemName}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={itemNameOptions}
                        />
                    </div>
                    <div className={styles.filterItem}>
                        <SelectInput
                            placeholder="All Organisations"
                            label="Organisation"
                            name={undefined}
                            value={undefined}
                            onChange={() => undefined}
                            keySelector={stringKeySelector}
                            labelSelector={stringLabelSelector}
                            options={emptyOptions}
                        />
                    </div>

                    <div className={styles.clearRow}>
                        <Button
                            name={undefined}
                            onClick={handleClearAll}
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
                        onCountrySelect={setFilterCountries}
                    />
                </div>

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
                                    pending={pending}
                                    filtered={false}
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
                                    name={undefined}
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
            </div>
        </Container>
    );
}

export default WarehouseStocksTable;
