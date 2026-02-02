import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    DefaultMessage,
    Pager,
    SelectInput,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import { createStringColumn } from '@ifrc-go/ui/utils';
import {
    isDefined,
    unique,
} from '@togglecorp/fujs';

import useCountryRaw from '#hooks/domain/useCountryRaw';
import useFilterState from '#hooks/useFilterState';

import WarehouseStocksMap from './WarehouseStocksMap';

import styles from './WarehouseStocksTable.module.css';

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

type OwnerKey = 'IFRC' | 'ICRC' | 'NS';

// Only IFRC data exists right now
function getOwner(): OwnerKey {
    return 'IFRC';
}

function WarehouseStocksTable() {
    const [filterRegion, setFilterRegion] = useState<string | undefined>();
    const [filterCountry, setFilterCountry] = useState<string | undefined>();
    const [filterItemGroup, setFilterItemGroup] = useState<string | undefined>();
    const [filterItemName, setFilterItemName] = useState<string | undefined>();

    const [owner, setOwner] = useState<OwnerKey>('IFRC');

    const { sortState } = useFilterState({ filter: {} });

    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(50);
    const [total, setTotal] = useState<number | undefined>();

    // // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const [optionsPending, setOptionsPending] = useState(false);
    const [regionsOpt, setRegionsOpt] = useState<string[]>([]);
    // // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const [countriesOpt, setCountriesOpt] = useState<string[]>([]);
    const [itemGroupsOpt, setItemGroupsOpt] = useState<string[]>([]);
    const [itemNamesOpt, setItemNamesOpt] = useState<string[]>([]);

    const [pending, setPending] = useState(false);
    const [tableData, setTableData] = useState<WarehouseStock[]>([]);
    // // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const [allDataPending, setAllDataPending] = useState(false);
    const [allData, setAllData] = useState<WarehouseStock[] | undefined>();
    const [aggregatedPending, setAggregatedPending] = useState(false);
    const [aggregatedData, setAggregatedData] = useState<Array<{
        country_iso3?: string | null;
        country?: string | null;
        region?: string | null;
        total_quantity?: string | null;
        warehouse_count?: number | null;
    }>>([]);

    // Fetch distinct options once
    useMemo(() => {
        let mounted = true;
        // setOptionsPending(true);
        fetch('/api/v1/warehouse-stocks/?distinct=1')
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                setRegionsOpt(data.regions || []);
                // setCountriesOpt(data.countries || []);
                setItemGroupsOpt(data.item_groups || []);
                setItemNamesOpt(data.item_names || []);
            })
            .catch(() => {
                // ignore
            })
            .finally(() => {
                // if (mounted) setOptionsPending(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    // Fetch table data (on-demand pagination - single page only)
    useEffect(() => {
        let mounted = true;
        setPending(true);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(pageSize));
        if (filterRegion) params.set('region', filterRegion);
        if (filterCountry) params.set('country_iso3', filterCountry);
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);
        // sort mapping: frontend sorts use column ids like 'quantity' or 'item_name'
        if (sortState.sorting) {
            params.set('sort', sortState.sorting.name);
            params.set('order', sortState.sorting.direction === 'dsc' ? 'desc' : 'asc');
        }

        const url = `/api/v1/warehouse-stocks/?${params.toString()}`;
        fetch(url)
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
            })
            .catch(() => {
                if (!mounted) return;
                setTableData([]);
                setTotal(undefined);
            })
            .finally(() => {
                if (mounted) setPending(false);
            });

        return () => {
            mounted = false;
        };
    }, [
        page,
        pageSize,
        filterRegion,
        filterCountry,
        filterItemGroup,
        filterItemName,
        sortState.sorting,
    ]);

    // Fetch aggregated per-country data for the map
    // (uses server aggregation endpoint)
    useEffect(() => {
        let mounted = true;
        setAggregatedPending(true);

        const params = new URLSearchParams();
        // aggregated endpoint expects filters;
        // we don't include country filter here so map shows all
        if (filterRegion) params.set('region', filterRegion);
        if (filterCountry) params.set('country_iso3', filterCountry);
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
    }, [filterRegion, filterCountry, filterItemGroup, filterItemName]);

    // Reset to first page when filters change
    useEffect(() => {
        setPage(1);
    }, [filterRegion, filterCountry, filterItemGroup, filterItemName]);

    // Fetch ALL matching rows in background (paged) to compute global stats
    useEffect(() => {
        let mounted = true;
        // setAllDataPending(true);
        setAllData(undefined);

        const params = new URLSearchParams();
        params.set('page', '1');
        const fetchPageSize = 1000;
        params.set('page_size', String(fetchPageSize));
        if (filterRegion) params.set('region', filterRegion);
        if (filterCountry) params.set('country_iso3', filterCountry);
        if (filterItemGroup) params.set('item_group', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);

        const baseUrl = `/api/v1/warehouse-stocks/?${params.toString()}`;

        fetch(baseUrl)
            .then((r) => r.json())
            .then(async (data) => {
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

                if (!totalCount || totalCount <= fetchPageSize) {
                    if (mounted) setAllData(results);
                    return;
                }

                const totalPages = Math.ceil(totalCount / fetchPageSize);
                const remainingPromises: Promise<Response>[] = [];
                for (let p = 2; p <= totalPages; p += 1) {
                    const u = new URL('/api/v1/warehouse-stocks/', window.location.origin);
                    u.searchParams.set('page', String(p));
                    u.searchParams.set('page_size', String(fetchPageSize));
                    if (filterRegion) u.searchParams.set('region', filterRegion);
                    if (filterCountry) u.searchParams.set('country_iso3', filterCountry);
                    if (filterItemGroup) u.searchParams.set('item_group', filterItemGroup);
                    if (filterItemName) u.searchParams.set('item_name', filterItemName);
                    remainingPromises.push(fetch(u.toString()));
                }

                try {
                    const responses = await Promise.all(remainingPromises);
                    const jsons = await Promise.all(
                        responses.map((r) => r.json().catch(() => ({}))),
                    );
                    const moreRows: WarehouseStock[] = jsons.flatMap(
                        (j) => (Array.isArray(j.results) ? j.results : []),
                    );
                    if (mounted) setAllData(results.concat(moreRows));
                } catch {
                    if (mounted) setAllData(results);
                }
            })
            .catch(() => {
                if (mounted) setAllData(undefined);
            });
        // .finally(() => {
        //     // if (mounted) // setAllDataPending(false);
        // });

        return () => {
            mounted = false;
        };
    }, [filterRegion, filterCountry, filterItemGroup, filterItemName, sortState.sorting]);

    const regionOptions = useMemo(() => {
        const fromDistinct = (regionsOpt || []).filter(isDefined);
        const fromAggregated = (aggregatedData || []).map((a) => a.region).filter(isDefined);
        const fromAll = (allData || []).map((r) => r.region).filter(isDefined);
        const combined = unique([...fromDistinct, ...fromAggregated, ...fromAll]);
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
            .map((c) => ({ key: c.iso3 as string, label: c.name as string }));
    }, [countriesRaw]);
    const itemGroupOptions = useMemo(
        () => (itemGroupsOpt || []).map((g) => ({ key: g, label: g })),
        [itemGroupsOpt],
    );

    const itemNameOptions = useMemo(
        () => (itemNamesOpt || []).map((n) => ({ key: n, label: n })),
        [itemNamesOpt],
    );

    // Convert aggregated per-country response into a synthetic WarehouseStock[] for map
    const mapData = useMemo(() => (aggregatedData || []).map((a) => ({
        id: (a.country_iso3 || a.country || '') as string,
        region: a.region ?? null,
        country: a.country ?? null,
        country_iso3: a.country_iso3 ?? null,
        warehouse_name: null,
        // include warehouse_count so map component can show accurate counts
        warehouse_count: a.warehouse_count ?? undefined,
        item_group: null,
        item_name: null,
        item_number: null,
        unit: null,
        quantity: a.total_quantity ?? null,
    } as WarehouseStock)), [aggregatedData]);

    const selectedCountryHasData = useMemo(() => {
        if (!filterCountry) return true; // no country selected => show table
        if (aggregatedPending) return true; // still loading aggregated info;
        // ^ avoid showing empty prematurely
        const found = (aggregatedData || []).find((a) => {
            const country = (a.country_iso3 || a.country || '') as string;

            return country.toUpperCase() === filterCountry.toUpperCase();
        });
        if (!found) return false;
        const count = typeof found.warehouse_count === 'number' ? found.warehouse_count : 0;
        const qty = parseQty(found.total_quantity) ?? 0;
        return count > 0 || qty > 0;
    }, [filterCountry, aggregatedData, aggregatedPending]);

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
                'warehouse_name',
                'Warehouse name',
                (item) => item.warehouse_name ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'item_group',
                'Item group',
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
                'item_number',
                'Item number',
                (item) => item.item_number ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'unit',
                'Unit',
                (item) => item.unit ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'quantity',
                'Quantity',
                (item) => formatQty(item.quantity),
                {
                    sortable: true,
                    valueComparator: (a, b) => {
                        const an = parseQty(a.quantity) ?? -Infinity;
                        const bn = parseQty(b.quantity) ?? -Infinity;
                        return an - bn;
                    },
                },
            ),
        ],
        [],
    );

    // Server handles filtering and sorting, so table uses raw data
    const displayData = tableData;

    const stringKeySelector = useCallback((option: { key: string }) => option.key, []);
    const stringLabelSelector = useCallback((option: { label: string }) => option.label, []);

    const handleClearAll = useCallback(() => {
        setFilterRegion(undefined);
        setFilterCountry(undefined);
        setFilterItemGroup(undefined);
        setFilterItemName(undefined);
        setOwner('IFRC');
    }, []);

    const hasFilters = Boolean(filterRegion || filterCountry || filterItemGroup || filterItemName);
    const keySelector = useCallback((item: WarehouseStock) => item.id, []);

    const chartData = useMemo(() => {
        // Use the full dataset when available so statistics reflect all matching rows,
        // otherwise fall back to the current page (`tableData`).
        let base = allData ?? tableData;

        if (owner) {
            base = base.filter(() => getOwner() === owner);
        }

        if (filterRegion) base = base.filter((i) => i.region === filterRegion);
        if (filterCountry) base = base.filter((i) => i.country_iso3 === filterCountry);
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
    }, [allData, tableData, filterRegion, filterCountry, filterItemName, owner]);

    // pagination removed — table shows all fetched rows on the map

    return (
        <Container className={styles.page}>
            <div className={styles.description}>
                {filterCountry
                    ? `Showing data for ${iso3ToName.get(filterCountry) ?? filterCountry}. Click the map bubble again or use filters to change selection.`
                    : 'Click on a country bubble in the map to filter, or use the filters on the left.'}
            </div>
            <div className={styles.layout}>
                {/* Filters card */}
                <div className={styles.filtersCard}>
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
                    <SelectInput
                        placeholder="All Countries"
                        label="Country"
                        name={undefined}
                        value={filterCountry}
                        onChange={setFilterCountry}
                        keySelector={stringKeySelector}
                        labelSelector={stringLabelSelector}
                        options={countryOptions}
                    />
                    <SelectInput
                        placeholder="All Item groups"
                        label="Item group"
                        name={undefined}
                        value={filterItemGroup}
                        onChange={setFilterItemGroup}
                        keySelector={stringKeySelector}
                        labelSelector={stringLabelSelector}
                        options={itemGroupOptions}
                    />
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

                    {(hasFilters || owner !== 'IFRC') && (
                        <div className={styles.clearRow}>
                            <Button
                                name={undefined}
                                onClick={handleClearAll}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    )}
                </div>

                {/* MAP */}
                <div className={styles.mapCard}>
                    <WarehouseStocksMap
                        data={mapData}
                        selectedCountryName={filterCountry}
                        onCountrySelect={setFilterCountry}
                    />
                </div>

                {/* Right panel (Owner + Bar chart) */}
                <div className={styles.rightPanel}>
                    <div className={styles.ownerCard}>
                        <div className={styles.ownerHeader}>
                            <div>Owner</div>
                        </div>

                        <div className={styles.ownerButtons}>
                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-active={owner === 'IFRC'}
                                onClick={() => setOwner('IFRC')}
                            >
                                <div className={styles.ownerLineBig}>IFRC</div>
                                <div className={styles.ownerLineSmall}>All current data</div>
                            </button>

                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-disabled="true"
                                title="No data yet"
                            >
                                <div className={styles.ownerLineBig}>ICRC</div>
                                <div className={styles.ownerLineSmall}>0</div>
                            </button>

                            <button
                                type="button"
                                className={styles.ownerBtn}
                                data-disabled="true"
                                title="No data yet"
                            >
                                <div className={styles.ownerLineBig}>NS</div>
                                <div className={styles.ownerLineSmall}>0</div>
                            </button>
                        </div>
                    </div>

                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div className={styles.chartTitle}>Item Groups by Quantity</div>
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
                                chartData.rows.map((r) => {
                                    const pct = chartData.max > 0
                                        ? (r.value / chartData.max) * 100
                                        : 0;
                                    const isActive = filterItemGroup === r.label;
                                    return (
                                        <button
                                            type="button"
                                            className={styles.chartRow}
                                            key={r.label}
                                            data-active={isActive}
                                            onClick={() => setFilterItemGroup(
                                                isActive ? undefined : r.label,
                                            )}
                                            title={r.label}
                                        >
                                            <div className={styles.chartLabel}>{r.label}</div>
                                            <div className={styles.chartBarWrap}>
                                                <div className={styles.chartBar} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className={styles.chartValue}>
                                                {Math.round(r.value).toLocaleString()}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
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
                                    –
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
                            {filterCountry && !pending && !selectedCountryHasData ? (
                                <DefaultMessage
                                    empty
                                    pending={false}
                                    filtered={false}
                                    errored={false}
                                    emptyMessage="No data found for the selected country"
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
            </div>
        </Container>
    );
}

export default WarehouseStocksTable;
