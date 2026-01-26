import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    SelectInput,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import { createStringColumn } from '@ifrc-go/ui/utils';
import {
    isDefined,
    isNotDefined,
    unique,
} from '@togglecorp/fujs';

import useFilterState from '#hooks/useFilterState';
import { useRequest } from '#utils/restRequest';

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

interface ApiResponse {
    results: WarehouseStock[];
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

function WarehouseStocksTable() {
    const [filterRegion, setFilterRegion] = useState<string | undefined>();
    const [filterCountry, setFilterCountry] = useState<string | undefined>();
    const [filterItemGroup, setFilterItemGroup] = useState<string | undefined>();
    const [filterItemName, setFilterItemName] = useState<string | undefined>();

    const { sortState } = useFilterState({ filter: {} });

    const { pending, response } = useRequest({ url: '/api/v1/warehouse-stocks/' } as any);
    const tableData = (response as ApiResponse | undefined)?.results ?? [];

    const regionOptions = useMemo(() => {
        const regions = tableData.map((item) => item.region).filter(isDefined);
        const uniqueRegions = unique(regions, (r) => r).sort();
        return uniqueRegions.map((r) => ({ key: r, label: r }));
    }, [tableData]);

    const countryOptions = useMemo(() => {
        const countries = tableData.map((item) => item.country).filter(isDefined);
        const uniqueCountries = unique(countries, (c) => c).sort();
        return uniqueCountries.map((c) => ({ key: c, label: c }));
    }, [tableData]);

    const itemGroupOptions = useMemo(() => {
        const groups = tableData.map((item) => item.item_group).filter(isDefined);
        const uniqueGroups = unique(groups, (g) => g).sort();
        return uniqueGroups.map((g) => ({ key: g, label: g }));
    }, [tableData]);

    const itemNameOptions = useMemo(() => {
        const names = tableData.map((item) => item.item_name).filter(isDefined);
        const uniqueNames = unique(names, (n) => n).sort();
        return uniqueNames.map((n) => ({ key: n, label: n }));
    }, [tableData]);

    // For MAP: apply filters except country (so clicking map is meaningful later)
    const mapFilteredData = useMemo(() => {
        let filtered = tableData;

        if (filterRegion) {
            filtered = filtered.filter((item) => item.region === filterRegion);
        }
        if (filterItemGroup) {
            filtered = filtered.filter((item) => item.item_group === filterItemGroup);
        }
        if (filterItemName) {
            filtered = filtered.filter((item) => item.item_name === filterItemName);
        }

        return filtered;
    }, [tableData, filterRegion, filterItemGroup, filterItemName]);

    // Apply all filters for table
    const filteredData = useMemo(() => {
        let filtered = tableData;

        if (filterRegion) {
            filtered = filtered.filter((item) => item.region === filterRegion);
        }
        if (filterCountry) {
            filtered = filtered.filter((item) => item.country === filterCountry);
        }
        if (filterItemGroup) {
            filtered = filtered.filter((item) => item.item_group === filterItemGroup);
        }
        if (filterItemName) {
            filtered = filtered.filter((item) => item.item_name === filterItemName);
        }

        return filtered;
    }, [tableData, filterRegion, filterCountry, filterItemGroup, filterItemName]);

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

    const sortedData = useMemo(() => {
        if (isNotDefined(filteredData) || !sortState.sorting) {
            return filteredData;
        }

        const columnToSort = columns.find((column) => column.id === sortState.sorting?.name);
        if (!columnToSort?.valueComparator) {
            return filteredData;
        }

        const sorted = [...filteredData].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [filteredData, sortState.sorting, columns]);

    const stringKeySelector = useCallback((option: { key: string }) => option.key, []);
    const stringLabelSelector = useCallback((option: { label: string }) => option.label, []);

    const handleClearFilters = useCallback(() => {
        setFilterRegion(undefined);
        setFilterCountry(undefined);
        setFilterItemGroup(undefined);
        setFilterItemName(undefined);
    }, []);

    const hasFilters = Boolean(filterRegion || filterCountry || filterItemGroup || filterItemName);
    const keySelector = useCallback((item: WarehouseStock) => item.id, []);

    return (
        <Container
            className={styles.page}
            description={filterCountry ? `Showing data for ${filterCountry}. Click the map bubble again or use filters to change selection.` : 'Click on a country bubble in the map to filter, or use the filters on the left.'}
            headingLevel={2}
        >
            <div className={styles.layout}>
                {/* LEFT: Filters card (grey) */}
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

                    {hasFilters && (
                        <div className={styles.clearRow}>
                            <Button
                                name={undefined}
                                onClick={handleClearFilters}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    )}
                </div>

                <div className={styles.mapCard}>
                    <WarehouseStocksMap
                        data={mapFilteredData}
                        selectedCountryName={filterCountry}
                        onCountrySelect={setFilterCountry}
                    />
                </div>

                <div className={styles.tableCard}>
                    <div className={styles.tableScroll}>
                        <SortContext.Provider value={sortState}>
                            <Table
                                data={sortedData}
                                keySelector={keySelector}
                                columns={columns}
                                pending={pending}
                                filtered={false}
                            />
                        </SortContext.Provider>
                    </div>
                </div>
            </div>
        </Container>
    );
}

export default WarehouseStocksTable;
