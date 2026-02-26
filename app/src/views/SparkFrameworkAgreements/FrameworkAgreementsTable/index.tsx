/* eslint-disable max-len */

import {
    type SetStateAction,
    useMemo,
} from 'react';
import {
    Container,
    DateOutput,
    Pager,
    Table,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createElementColumn,
    createStringColumn,
} from '@ifrc-go/ui/utils';
import { compareDate } from '@togglecorp/fujs';


import useFilterState from '#hooks/useFilterState';

import styles from './FrameworkAgreementsTable.module.css';

const PLACEHOLDER_EMPTY = '—';

/** Days from today beyond which FA expiring is shown as "good" (green); otherwise "soon" (orange) */
const FA_EXPIRING_GOOD_DAYS_THRESHOLD = 90;

function getExpiryStatusClass(dateStr: string | undefined | null): 'good' | 'soon' | undefined {
    if (!dateStr) return undefined;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const daysFromNow = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysFromNow > FA_EXPIRING_GOOD_DAYS_THRESHOLD) return 'good';
    if (daysFromNow >= 0) return 'soon';
    return undefined;
}

interface FAExpiringCellProps {
    value?: string | null;
    statusClass?: 'good' | 'soon';
    className?: string;
}

function FAExpiringCell({ value, statusClass, className }: FAExpiringCellProps) {
    const wrapperClass = statusClass ? styles[`faExpiring${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}`] : undefined;
    const combinedClassName = [wrapperClass, className].filter(Boolean).join(' ') || undefined;
    return (
        <div className={combinedClassName}>
            <DateOutput
                value={value}
                invalidText={PLACEHOLDER_EMPTY}
            />
        </div>
    );
}

interface DateCellProps {
    value?: string | null;
    className?: string;
}

function DateCell({ value, className }: DateCellProps) {
    return (
        <div className={className}>
            <DateOutput
                value={value}
                invalidText={PLACEHOLDER_EMPTY}
            />
        </div>
    );
}

interface DescriptionCellProps {
    value?: string | null;
    className?: string;
}

function DescriptionCell({ value, className }: DescriptionCellProps) {
    return (
        <div className={className}>
            {value || PLACEHOLDER_EMPTY}
        </div>
    );
}

interface PriceCellProps {
    value?: string | null;
}

function PriceCell({ value }: PriceCellProps) {
    if (!value) {
        return PLACEHOLDER_EMPTY;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return PLACEHOLDER_EMPTY;
    }
    
    return numValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

interface FrameworkAgreement {
    agreementId: string;
    classification?: string | null;
    defaultAgreementLineEffectiveDate?: string | null;
    defaultAgreementLineExpirationDate?: string | null;
    workflowStatus?: string | null;
    status?: string | null;
    pricePerUnit?: string | null;
    paLineProcurementCategory?: string | null;
    vendorName?: string | null;
    vendorValidFrom?: string | null;
    vendorValidTo?: string | null;
    vendorCountry?: string | null;
    regionCountriesCovered?: string | null;
    itemType?: string | null;
    itemCategory?: string | null;
    itemServiceShortDescription?: string | null;
    owner: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}



interface Props {
    data: FrameworkAgreement[];
    pending?: boolean;
    page: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (nextPage: number) => void;
}



function FrameworkAgreementsTable({
    data,
    pending = false,
    page,
    pageSize,
    totalCount,
    onPageChange,
}: Props) {
    const { sortState } = useFilterState({ filter: {} });
    const triStateSort = useMemo(() => ({
        sorting: sortState.sorting,
        setSorting: (value: SetStateAction<{ name: string; direction: 'asc' | 'dsc' } | undefined>) => {
            const proposed = typeof value === 'function' ? value(sortState.sorting) : value;
            let finalValue = proposed;
            if (proposed && sortState.sorting && proposed.name === sortState.sorting.name) {
                // Cycle: asc -> dsc -> undefined
                if (sortState.sorting.direction === 'dsc' && proposed.direction === 'asc') {
                    finalValue = undefined;
                }
            }
            sortState.setSorting(finalValue);
        },
    }), [sortState]);





    const columns = useMemo(
        () => [
            createStringColumn(
                'owner',
                'FA Owner',
                (item: FrameworkAgreement) => item.owner,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            createStringColumn(
                'classification',
                'Coverage',
                (item: FrameworkAgreement) => item.classification || item.regionCountriesCovered,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            createStringColumn(
                'itemCategory',
                'Item categories',
                (item: FrameworkAgreement) => item.itemCategory || item.paLineProcurementCategory,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            createStringColumn(
                'itemType',
                'Item sub-categories',
                (item: FrameworkAgreement) => item.itemType,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            createElementColumn<FrameworkAgreement, string | number, DescriptionCellProps>(
                'itemServiceShortDescription',
                'Item Description',
                DescriptionCell,
                (_key, datum) => ({
                    value: datum.itemServiceShortDescription,
                    className: styles.descriptionCell,
                }),
                { sortable: false },
            ),
            createStringColumn(
                'vendorName',
                'Vendor name',
                (item: FrameworkAgreement) => item.vendorName,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            {
                ...createElementColumn<FrameworkAgreement, string | number, PriceCellProps>(
                    'pricePerUnit',
                    'Unit price',
                    PriceCell,
                    (_key, datum) => ({
                        value: datum.pricePerUnit,
                    }),
                    { sortable: true },
                ),
                valueSelector: (item: FrameworkAgreement) => {
                    const num = parseFloat(item.pricePerUnit || '0');
                    return isNaN(num) ? 0 : num;
                },
                valueComparator: (a: FrameworkAgreement, b: FrameworkAgreement) => {
                    const aNum = parseFloat(a.pricePerUnit || '0');
                    const bNum = parseFloat(b.pricePerUnit || '0');
                    const aVal = isNaN(aNum) ? 0 : aNum;
                    const bVal = isNaN(bNum) ? 0 : bNum;
                    return aVal - bVal;
                },
            },
            createStringColumn(
                'vendorCountry',
                'Shipping from',
                (item: FrameworkAgreement) => item.vendorCountry,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            {
                ...createElementColumn<FrameworkAgreement, string | number, DateCellProps>(
                    'vendorValidTo',
                    'Vendor expiring',
                    DateCell,
                    (_key, datum) => ({
                        value: datum.vendorValidTo,
                        className: styles.expiringDateCell,
                    }),
                    { sortable: true },
                ),
                valueSelector: (item: FrameworkAgreement) => item.vendorValidTo,
                valueComparator: (a: FrameworkAgreement, b: FrameworkAgreement) => compareDate(
                    a.vendorValidTo,
                    b.vendorValidTo,
                ),
            },
            {
                ...createElementColumn<FrameworkAgreement, string | number, FAExpiringCellProps>(
                    'defaultAgreementLineExpirationDate',
                    'FA Expiring',
                    FAExpiringCell,
                    (_key, datum) => ({
                        value: datum.defaultAgreementLineExpirationDate,
                        statusClass: getExpiryStatusClass(datum.defaultAgreementLineExpirationDate),
                        className: styles.expiringDateCell,
                    }),
                    { sortable: true },
                ),
                valueSelector: (item: FrameworkAgreement) => item.defaultAgreementLineExpirationDate,
                valueComparator: (a: FrameworkAgreement, b: FrameworkAgreement) => compareDate(
                    a.defaultAgreementLineExpirationDate,
                    b.defaultAgreementLineExpirationDate,
                ),
            },
        ],
        [],
    );

    const sortedData = useMemo(() => {
        if (!sortState.sorting) {
            return data;
        }

        const columnToSort = columns.find((column) => column.id === sortState.sorting?.name);
        if (!columnToSort || !('valueComparator' in columnToSort)) {
            return data;
        }

        const sorted = [...data].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [data, sortState.sorting, columns]);

    return (
        <Container>
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <span className={styles.tableInfo}>
                        {Math.max(1, (page * pageSize) + 1)}
                        {' '}
                        –
                        {' '}
                        {Math.min((page + 1) * pageSize, totalCount)}
                        {' '}
                        of
                        {' '}
                        {totalCount}
                        {' '}
                        items
                    </span>
                    <div className={styles.tablePagination}>
                        <Pager
                            activePage={page}
                            itemsCount={totalCount}
                            maxItemsPerPage={pageSize}
                            onActivePageChange={onPageChange}
                        />
                    </div>
                </div>
                <div className={styles.tableScroll}>
                    <SortContext.Provider value={triStateSort}>
                        <Table
                            data={sortedData}
                            keySelector={(_row, index) => index}
                            columns={columns}
                            pending={pending}
                            filtered={false}
                        />
                    </SortContext.Provider>
                </div>
            </div>
        </Container>
    );
}

export default FrameworkAgreementsTable;
