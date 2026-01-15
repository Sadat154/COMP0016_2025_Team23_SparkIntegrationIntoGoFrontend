import { useMemo } from 'react';
import {
    Table,
    Container,
} from '@ifrc-go/ui';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';

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
            ),
            createStringColumn<ProBonoService, number>(
                'name1',
                'Contact Name 1',
                (item) => item.name1,
            ),
            createStringColumn<ProBonoService, number>(
                'email1',
                'Email 1',
                (item) => item.email1,
            ),
            createStringColumn<ProBonoService, number>(
                'name2',
                'Contact Name 2',
                (item) => item.name2,
            ),
            createStringColumn<ProBonoService, number>(
                'email2',
                'Email 2',
                (item) => item.email2,
            ),
            createStringColumn<ProBonoService, number>(
                'services',
                'Transport Means & Services',
                (item) => item.services,
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

    return (
        <Container>
            <div className={styles.tableContainer}>
                <Table
                    data={tableData}
                    keySelector={numericIdSelector}
                    columns={columns}
                    pending={pending}
                    filtered={false}
                />
            </div>
        </Container>
    );
}

export default ProBonoServicesTable;
