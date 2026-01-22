import {
    useMemo,
} from 'react';
import {
    Table,
    Container,
} from '@ifrc-go/ui';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';

import { useRequest } from '#utils/restRequest';
import styles from './FrameworkAgreementsTable.module.css';

interface FrameworkAgreement {
    id: number;
    fa_number: string;
    supplier_name: string;
    pa_type: string;
    pa_bu_region_name: string;
    pa_bu_country_name: string;
    pa_line_product_type: string;
    pa_line_procurement_category: string;
    pa_line_item_name: string;
    pa_effective_date: string;
    pa_expiration_date: string;
    supplier_country: string;
    pa_workflow_status: string;
    pa_status: string;
    item_service_short_description: string;
}

interface ApiResponse {
    results: FrameworkAgreement[];
}

function FrameworkAgreementsTable() {
    const {
        pending,
        response,
    } = useRequest({
        url: '/api/v1/framework-agreements/',
    } as any);

    const tableData = (response as ApiResponse | undefined)?.results ?? [];

    const columns = useMemo(
        () => [
            createStringColumn<FrameworkAgreement, number>(
                'fa_number',
                'FA Number',
                (item) => item.fa_number,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'supplier_name',
                'Supplier Name',
                (item) => item.supplier_name,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_type',
                'PA Type',
                (item) => item.pa_type,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_bu_region_name',
                'PA BU Region Name',
                (item) => item.pa_bu_region_name,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_bu_country_name',
                'PA BU Country Name',
                (item) => item.pa_bu_country_name,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_line_product_type',
                'PA Line Product Type',
                (item) => item.pa_line_product_type,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_line_procurement_category',
                'PA Line Procurement Category',
                (item) => item.pa_line_procurement_category,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_effective_date',
                'PA Effective Date',
                (item) => item.pa_effective_date,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_expiration_date',
                'PA Expiration Date',
                (item) => item.pa_expiration_date,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'supplier_country',
                'Supplier Country',
                (item) => item.supplier_country,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'pa_status',
                'PA Status',
                (item) => item.pa_status,
            ),
            createStringColumn<FrameworkAgreement, number>(
                'item_service_short_description',
                'Item / Service Short Description',
                (item) => item.item_service_short_description,
            ),
        ],
        [],
    );

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

export default FrameworkAgreementsTable;
