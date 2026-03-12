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

import useCountryRaw from '#hooks/domain/useCountryRaw';
import useFilterState from '#hooks/useFilterState';

import CustomsDataCard from './CustomsDataCard';
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
    warehouse_id: string | null;
    warehouse: string | null;
    warehouse_country: string | null;
    warehouse_count?: number | null;
    product_category: string | null;
    item_name: string | null;
    unit_measurement: string | null;
    catalogue_link?: string | null;
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

const MAP_WAREHOUSE_IDS = [
    'AE1DUB002',
    'AR1BUE002',
    'AU1BRI003',
    'ES1LAS001',
    'GT1GUA001',
    'HN1COM002',
    'MY1SEL001',
    'PA1ARR001',
    'TR1ISTA02',
];

function WarehouseStocksTable() {
    const [filterRegions, setFilterRegions] = useState<string[] | undefined>();
    const [filterCountries, setFilterCountries] = useState<string[] | undefined>();
    const [filterItemGroup, setFilterItemGroup] = useState<string | undefined>();
    const [filterItemName, setFilterItemName] = useState<string | undefined>();
    const [receivingCountry, setReceivingCountry] = useState<string | undefined>();
    const { sortState } = useFilterState({ filter: {} });

    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(50);
    const [total, setTotal] = useState<number | undefined>();

    const [pending, setPending] = useState(false);
    const [tableData, setTableData] = useState<WarehouseStock[]>([]);
    const [aggregatedPending, setAggregatedPending] = useState(false);
    const [aggregatedData, setAggregatedData] = useState<Array<{
        country_iso3?: string | null;
        country?: string | null;
        region?: string | null;
        total_quantity?: string | null;
        warehouse_count?: number | null;
    }>>([]);
    const [mapAggregatedData, setMapAggregatedData] = useState<Array<{
        country_iso3?: string | null;
        country?: string | null;
        region?: string | null;
        total_quantity?: string | null;
        warehouse_count?: number | null;
    }>>([]);
    const [distinctItemNames, setDistinctItemNames] = useState<string[] | undefined>();
    const [distinctItemGroups, setDistinctItemGroups] = useState<string[] | undefined>();
    const prefetchCacheRef = useRef<Map<number, { rows: WarehouseStock[]; total?: number }>>(new Map());
    const prefetchControllersRef = useRef<Map<number, AbortController>>(new Map());
    const prevFiltersKeyRef = useRef<string>('');

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
        params.set('warehouse_ids', MAP_WAREHOUSE_IDS.join(','));
        if (filterRegions && filterRegions.length > 0) params.set('region', filterRegions.join(','));
        if (filterCountries && filterCountries.length > 0) {
            params.set('country_iso3', filterCountries.join(','));
        }
        if (filterItemGroup) params.set('product_category', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);
        if (sortState.sorting) {
            params.set('sort', sortState.sorting.name);
            params.set('order', sortState.sorting.direction === 'dsc' ? 'desc' : 'asc');
        }

        const url = `/api/v1/stock-inventory/?${params.toString()}`;
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
                        const prefetchUrl = `/api/v1/stock-inventory/?${pParams.toString()}`;
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
        if (filterItemGroup) params.set('product_category', filterItemGroup);
        if (filterItemName) params.set('item_name', filterItemName);

        params.set('warehouse_ids', MAP_WAREHOUSE_IDS.join(','));

        const url = `/api/v1/stock-inventory/aggregated/?${params.toString()}`;
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

        const mapParams = new URLSearchParams();
        if (filterItemGroup) mapParams.set('product_category', filterItemGroup);
        if (filterItemName) mapParams.set('item_name', filterItemName);
        const mapUrl = `/api/v1/stock-inventory/aggregated/?${mapParams.toString()}`;
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

    const regionOptions = useMemo(() => {
        const fromAggregated = (aggregatedData || []).map((a) => a.region).filter((v) => isDefined(v) && String(v).trim() !== '');
        const FALLBACK_REGIONS = [
            'Americas',
            'Asia-Pacific',
            'MENA',
            'Europe',
            'Africa',
        ];

        const combined = unique([
            ...fromAggregated,
            ...FALLBACK_REGIONS,
        ]).sort((a, b) => String(a).localeCompare(String(b)));

        return combined.map((r) => ({ key: String(r), label: String(r) }));
    }, [aggregatedData]);

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

        return results
            .filter((c) => c.iso3 && c.name && isoSet.has((c.iso3 || '').toString().toUpperCase()))
            .map((c) => ({
                key: c.iso3 as string,
                label: c.name as string,
            }));
    }, [countriesRaw, aggregatedData]);

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

    const iso3ToRegion = useMemo(() => {
        const map = new Map<string, string>();
        (mapAggregatedData || []).forEach((a) => {
            const iso3 = (a.country_iso3 || '').toUpperCase();
            const { region } = a;
            if (iso3 && region) {
                map.set(iso3, region);
            }
        });
        return map;
    }, [mapAggregatedData]);

    const itemGroupOptions = useMemo(() => {
        const source = (distinctItemGroups && distinctItemGroups.length > 0)
            ? distinctItemGroups
            : (tableData || []).map((r) => r.product_category).filter(isDefined);
        const combined = unique(source, (v) => String(v).toLowerCase())
            .sort((a, b) => String(a).localeCompare(String(b)));
        return combined.map((g) => ({ key: String(g), label: String(g) }));
    }, [distinctItemGroups, tableData]);

    useEffect(() => {
        let mounted = true;
        fetch('/api/v1/stock-inventory/?distinct=1')
            .then((r) => r.json())
            .then((data) => {
                if (!mounted) return;
                const names = Array.isArray(data?.item_names) ? data.item_names : [];
                const groups = Array.isArray(data?.item_groups) ? data.item_groups : [];
                setDistinctItemNames(names.filter((n) => n));
                setDistinctItemGroups(groups.filter((g) => g));
            })
            .catch(() => {
                if (!mounted) return;
                setDistinctItemNames([]);
                setDistinctItemGroups([]);
            });
        return () => { mounted = false; };
    }, []);

    const itemNameOptions = useMemo(() => {
        const source = distinctItemNames ?? [];
        const combined = unique(source, (v) => String(v).toLowerCase())
            .sort((a, b) => String(a).localeCompare(String(b)));
        return combined.map((n) => ({ key: String(n), label: String(n) }));
    }, [distinctItemNames]);

    const mapData = useMemo(
        () => (mapAggregatedData || []).map((a) => ({
            id: (a.country_iso3 || a.country || '') as string,
            region: a.region ?? null,
            country: a.country ?? null,
            country_iso3: a.country_iso3 ?? null,
            warehouse_id: null,
            warehouse: null,
            warehouse_country: a.country ?? null,
            warehouse_count: a.warehouse_count ?? undefined,
            product_category: null,
            item_name: null,
            unit_measurement: null,
            catalogue_link: null,
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
                'warehouse_id',
                'Warehouse ID',
                (item) => item.warehouse_id ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'warehouse',
                'Warehouse',
                (item) => item.warehouse ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'warehouse_country',
                'Warehouse Country',
                (item) => item.warehouse_country ?? '',
                { sortable: true },
            ),
            createStringColumn<WarehouseStock, string>(
                'product_category',
                'Product Category',
                (item) => item.product_category ?? '',
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
            createStringColumn<WarehouseStock, string>(
                'unit_measurement',
                'Unit Measurement',
                (item) => item.unit_measurement ?? '',
                { sortable: true },
            ),
            createElementColumn<WarehouseStock, string, DetailsCellProps>(
                'catalogue_link',
                'Catalogue Link',
                DetailsCell,
                (_, item) => ({
                    url: item.catalogue_link,
                }),
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
        if (newValue) {
            setFilterItemName(undefined);
        }
    }, []);

    const handleItemNameChange = useCallback((newValue: string | undefined) => {
        setFilterItemName(newValue);
        if (newValue) {
            setFilterItemGroup(undefined);
        }
    }, []);

    const handleReceivingCountryChange = useCallback((newValue: string | undefined) => {
        setReceivingCountry(newValue);
        if (newValue) {
            const region = iso3ToRegion.get(newValue.toUpperCase());
            if (region) {
                setFilterRegions([region]);
            }
        }
    }, [iso3ToRegion]);

    const handleMapCountryClick = useCallback((clickedIso3: string) => {
        const upperIso3 = clickedIso3.toUpperCase();

        // If a region filter is active, explode it into individual countries first
        if (filterRegions && filterRegions.length > 0) {
            const regionCountries = new Set<string>();
            (aggregatedData || []).forEach((a) => {
                const iso3 = (a.country_iso3 || '').toUpperCase();
                if (iso3) {
                    regionCountries.add(iso3);
                }
            });
            (filterCountries ?? []).forEach((c) => regionCountries.add(c.toUpperCase()));

            // Toggle the clicked country
            if (regionCountries.has(upperIso3)) {
                regionCountries.delete(upperIso3);
            } else {
                regionCountries.add(upperIso3);
            }

            const next = Array.from(regionCountries);
            setFilterCountries(next.length > 0 ? next : undefined);
            setFilterRegions(undefined);
            return;
        }

        // Simple toggle: select/deselect the clicked country
        const current = filterCountries ?? [];
        const isAlreadySelected = current.some(
            (c) => c.toUpperCase() === upperIso3,
        );
        if (isAlreadySelected) {
            const next = current.filter((c) => c.toUpperCase() !== upperIso3);
            setFilterCountries(next.length > 0 ? next : undefined);
        } else {
            setFilterCountries([...current, upperIso3]);
        }
    }, [filterRegions, filterCountries, aggregatedData]);

    const handleClearAll = useCallback(() => {
        setFilterRegions(undefined);
        setFilterCountries(undefined);
        setFilterItemGroup(undefined);
        setFilterItemName(undefined);
        setReceivingCountry(undefined);
    }, []);

    const keySelector = useCallback((item: WarehouseStock) => item.id, []);

    const ownerStats = useMemo(() => {
        let warehouseTotal = 0;
        (aggregatedData || []).forEach((a) => {
            warehouseTotal += typeof a.warehouse_count === 'number' ? a.warehouse_count : 0;
        });

        const itemGroups = new Set<string>();
        (tableData || []).forEach((row) => {
            if (row.product_category) {
                itemGroups.add(row.product_category);
            }
        });

        return {
            ifrcWarehouses: warehouseTotal,
            ifrcItemGroups: itemGroups.size,
        };
    }, [aggregatedData, tableData]);

    const showNoCountryData = Boolean(
        filterCountries
        && filterCountries.length > 0
        && !pending
        && !selectedCountryHasData,
    );

    return (
        <Container
            className={styles.page}
            headingLevel={2}
        >
            <div className={styles.layout}>
                <div className={styles.summaryCards}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {ownerStats.ifrcWarehouses}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                IFRC Warehouses
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                {ownerStats.ifrcItemGroups}
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Item Categories
                            </div>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                0
                            </div>
                            <div className={styles.summaryCardLabel}>
                                ICRC Warehouses
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                0
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Item Categories
                            </div>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                0
                            </div>
                            <div className={styles.summaryCardLabel}>
                                NS Warehouses
                            </div>
                        </div>
                        <div className={styles.summaryCardBlock}>
                            <div className={styles.summaryCardValue}>
                                0
                            </div>
                            <div className={styles.summaryCardLabel}>
                                Item Categories
                            </div>
                        </div>
                    </div>
                </div>

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

                <div className={styles.mapCard}>
                    <WarehouseStocksMap
                        data={mapData}
                        selectedCountryNames={filterCountries}
                        selectedRegions={filterRegions}
                        onCountryClick={handleMapCountryClick}
                    />
                </div>

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

                {receivingCountry && (
                    <CustomsDataCard countryIso3={receivingCountry} />
                )}
            </div>
        </Container>
    );
}

export default WarehouseStocksTable;
