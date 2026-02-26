/* eslint-disable max-len */

import {
    type SetStateAction,
    useMemo,
} from 'react';
import {
    Container,
    DateOutput,
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

    const totalPages = Math.ceil(totalCount / pageSize);

    const displayedPages = useMemo(() => {
        if (totalPages <= 1) {
            return totalPages === 1 ? [0] : [];
        }

        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_val, index) => index);
        }

        const windowSize = 5;
        const half = Math.floor(windowSize / 2);

        let start = Math.max(1, page - half);
        let end = Math.min(totalPages - 2, page + half);

        const visibleCount = end - start + 1;
        if (visibleCount < windowSize) {
            const missing = windowSize - visibleCount;
            if (start === 1) {
                end = Math.min(totalPages - 2, end + missing);
            } else if (end === totalPages - 2) {
                start = Math.max(1, start - missing);
            }
        }

        const pages = new Set<number>([0, totalPages - 1]);
        for (let pageStart = start; pageStart <= end; pageStart += 1) {
            pages.add(pageStart);
        }

        return Array.from(pages).sort((a, b) => a - b);
    }, [page, totalPages]);



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
            createStringColumn(
                'vendorName',
                'Vendor name',
                (item: FrameworkAgreement) => item.vendorName,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
            createStringColumn(
                'pricePerUnit',
                'Unit price',
                (item: FrameworkAgreement) => item.pricePerUnit,
                { sortable: true, defaultEmptyValue: PLACEHOLDER_EMPTY },
            ),
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
        if (!columnToSort?.valueComparator) {
            return data;
        }

        const sorted = [...data].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [data, sortState.sorting, columns]);

    return (
        <Container>
            <div className={styles.filterSection}>
                <p className={styles.resultCount}>
                    Showing
                    {' '}
                    {data.length}
                    {' '}
                    of
                    {' '}
                    {totalCount}
                    {' '}
                    results
                </p>
            </div>

            <div className={styles.tableContainer}>
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
            {totalPages > 0 && (
                <div className={styles.paginationContainer}>
                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => onPageChange(Math.max(0, page - 1))}
                        disabled={pending || page === 0}
                        aria-label="Previous page"
                    >
                        &lt;
                    </button>

                    {displayedPages.map((pageNumber, index) => {
                        const previousPage = displayedPages[index - 1];
                        const showEllipsis = index > 0 && previousPage !== undefined && pageNumber - previousPage > 1;

                        return (
                            <span key={pageNumber} className={styles.pageWrapper}>
                                {showEllipsis && (
                                    <span className={styles.pageEllipsis} aria-hidden>
                                        …
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onPageChange(pageNumber)}
                                    className={pageNumber === page
                                        ? styles.pageButtonActive
                                        : styles.pageButton}
                                    disabled={pending}
                                    aria-label={`Page ${pageNumber + 1}`}
                                    aria-current={pageNumber === page ? 'page' : undefined}
                                >
                                    {pageNumber + 1}
                                </button>
                            </span>
                        );
                    })}

                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                        disabled={pending || page >= totalPages - 1}
                        aria-label="Next page"
                    >
                        &gt;
                    </button>
                </div>
            )}
        </Container>
    );
}

export default FrameworkAgreementsTable;
