import {
    useMemo,
    useState,
} from 'react';
import {
    Table,
    Container,
} from '@ifrc-go/ui';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';

import styles from './FrameworkAgreementsTable.module.css';

interface FrameworkAgreement {
    fa_number: string;
    supplier_name: string;
    pa_type: string;
    pa_bu_region_name: string;
    pa_bu_country_name: string;
    pa_line_product_type: string;
    pa_line_procurement_category: string;
    pa_line_item_name: string;
    pa_effective_date_fa_start_date: string;
    pa_expiration_date_fa_end_date: string;
    supplier_country: string;
    pa_workflow_status: string;
    pa_status: string;
    item_service_short_description: string;
}

interface Props {
    data: FrameworkAgreement[];
    pending?: boolean;
}

function FrameworkAgreementsTable({ data, pending = false }: Props) {
    // rowsPerPage: Number of rows to display on each individual page
    const rowsPerPage = 100;
    // displayData: Use all available data (no limit on total rows)
    const displayData = data;
    const totalPages = Math.ceil(displayData.length / rowsPerPage);
    
    const [currentPage, setCurrentPage] = useState(0);
    
    const paginatedData = displayData.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage
    );

    const columns = useMemo(
        () => [
            createStringColumn(
                'fa_number',
                'FA Number',
                (item: FrameworkAgreement) => item.fa_number,
            ),
            createStringColumn(
                'supplier_name',
                'Supplier Name',
                (item: FrameworkAgreement) => item.supplier_name,
            ),
            createStringColumn(
                'pa_type',
                'PA Type',
                (item: FrameworkAgreement) => item.pa_type,
            ),
            createStringColumn(
                'pa_bu_region_name',
                'PA BU Region Name',
                (item: FrameworkAgreement) => item.pa_bu_region_name,
            ),
            createStringColumn(
                'pa_bu_country_name',
                'PA BU Country Name',
                (item: FrameworkAgreement) => item.pa_bu_country_name,
            ),
            createStringColumn(
                'pa_line_product_type',
                'PA Line Product Type',
                (item: FrameworkAgreement) => item.pa_line_product_type,
            ),
            createStringColumn(
                'pa_line_procurement_category',
                'PA Line Procurement Category',
                (item: FrameworkAgreement) => item.pa_line_procurement_category,
            ),
            createStringColumn(
                'pa_effective_date_fa_start_date',
                'PA Effective Date',
                (item: FrameworkAgreement) => item.pa_effective_date_fa_start_date,
            ),
            createStringColumn(
                'pa_expiration_date_fa_end_date',
                'PA Expiration Date',
                (item: FrameworkAgreement) => item.pa_expiration_date_fa_end_date,
            ),
            createStringColumn(
                'supplier_country',
                'Supplier Country',
                (item: FrameworkAgreement) => item.supplier_country,
            ),
            createStringColumn(
                'pa_status',
                'PA Status',
                (item: FrameworkAgreement) => item.pa_status,
            ),
            createStringColumn(
                'item_service_short_description',
                'Item / Service Short Description',
                (item: FrameworkAgreement) => item.item_service_short_description,
            ),
        ],
        [],
    );

    return (
        <Container>
            <div className={styles.tableContainer}>
                <Table
                    data={paginatedData}
                    keySelector={(row, index) => index}
                    columns={columns}
                    pending={pending}
                    filtered={false}
                />
            </div>
            <div className={styles.paginationContainer}>
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={currentPage === i ? styles.pageButtonActive : styles.pageButton}
                        disabled={pending}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </Container>
    );
}

export default FrameworkAgreementsTable;
