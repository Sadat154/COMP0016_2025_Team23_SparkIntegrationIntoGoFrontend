import { useMemo } from 'react';
import {
    Table,
    Container,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';
import { isNotDefined } from '@togglecorp/fujs';

import useFilterState from '#hooks/useFilterState';
import { useRequest } from '#utils/restRequest';
import styles from './ProBonoServicesTable.module.css';

interface ProBonoService {
    id: number;
    company: string;
    name1: string;
    email1: string;
    name2: string;
    email2: string;
    services: string;
    comments: string;
}

interface ApiResponse {
    results: ProBonoService[];
}

function ProBonoServicesTable() {
    const {
        sortState,
    } = useFilterState({
        filter: {},
    });

    const {
        pending,
        response,
    } = useRequest({
        url: '/api/v1/pro-bono-services/',
    } as any);

    const columns = useMemo(
        () => [
            createStringColumn<ProBonoService, number>(
                'company',
                'Company',
                (item) => item.company,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'name1',
                'Contact Name 1',
                (item) => item.name1,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'email1',
                'Email 1',
                (item) => item.email1,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'name2',
                'Contact Name 2',
                (item) => item.name2,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'email2',
                'Email 2',
                (item) => item.email2,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'services',
                'Transport Means & Services',
                (item) => item.services,
                { sortable: true },
            ),
            createStringColumn<ProBonoService, number>(
                'comments',
                'Comments',
                (item) => item.comments,
            ),
        ],
        [],
    );

    const tableData = (response as ApiResponse | undefined)?.results ?? [];

    // Client-side sorting
    const sortedData = useMemo(() => {
        if (isNotDefined(tableData) || !sortState.sorting) {
            return tableData;
        }

        const columnToSort = columns.find((column) => column.id === sortState.sorting?.name);
        if (!columnToSort?.valueComparator) {
            return tableData;
        }

        const sorted = [...tableData].sort(columnToSort.valueComparator);
        return sortState.sorting.direction === 'dsc' ? sorted.reverse() : sorted;
    }, [tableData, sortState.sorting, columns]);

    return (
        <Container>
            <div className={styles.tableContainer}>
                <SortContext.Provider value={sortState}>
                    <Table
                        data={sortedData}
                        keySelector={numericIdSelector}
                        columns={columns}
                        pending={pending}
                        filtered={false}
                    />
                </SortContext.Provider>
            </div>
        </Container>
    );
}

export default ProBonoServicesTable;
