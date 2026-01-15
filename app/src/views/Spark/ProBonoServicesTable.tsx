import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    Table,
    Container,
    SelectInput,
    Button,
} from '@ifrc-go/ui';
import { SortContext } from '@ifrc-go/ui/contexts';
import {
    createStringColumn,
    numericIdSelector,
} from '@ifrc-go/ui/utils';
import {
    isDefined,
    isNotDefined,
    unique,
} from '@togglecorp/fujs';

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
    const [filterCompany, setFilterCompany] = useState<string | undefined>();
    const [filterService, setFilterService] = useState<string | undefined>();

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

    const tableData = (response as ApiResponse | undefined)?.results ?? [];

    // Generate filter options for Company
    const companyOptions = useMemo(() => {
        const companies = tableData.map((item) => item.company).filter(isDefined);
        const uniqueCompanies = unique(companies, (c) => c).sort();
        return uniqueCompanies.map((company) => ({ key: company, label: company }));
    }, [tableData]);

    // Generate filter options for Transport Services
    // Split by "/" and create individual categories
    const serviceOptions = useMemo(() => {
        const allServices: string[] = [];
        tableData.forEach((item) => {
            if (item.services) {
                // Split by "/" and trim whitespace
                const services = item.services.split('/').map((s) => s.trim());
                allServices.push(...services);
            }
        });
        const uniqueServices = unique(allServices, (s) => s.toLowerCase()).sort();
        return uniqueServices.map((service) => ({ key: service, label: service }));
    }, [tableData]);

    // Apply filters
    const filteredData = useMemo(() => {
        let filtered = tableData;

        if (filterCompany) {
            filtered = filtered.filter((item) => item.company === filterCompany);
        }

        if (filterService) {
            filtered = filtered.filter((item) => {
                if (!item.services) return false;
                const services = item.services.toLowerCase();
                return services.includes(filterService.toLowerCase());
            });
        }

        return filtered;
    }, [tableData, filterCompany, filterService]);

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

    // Client-side sorting
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
        setFilterCompany(undefined);
        setFilterService(undefined);
    }, []);

    return (
        <Container>
            <div className={styles.filters}>
                <SelectInput
                    placeholder="All Companies"
                    label="Company"
                    name={undefined}
                    value={filterCompany}
                    onChange={setFilterCompany}
                    keySelector={stringKeySelector}
                    labelSelector={stringLabelSelector}
                    options={companyOptions}
                />
                <SelectInput
                    placeholder="All Transport Services"
                    label="Transport Means & Services"
                    name={undefined}
                    value={filterService}
                    onChange={setFilterService}
                    keySelector={stringKeySelector}
                    labelSelector={stringLabelSelector}
                    options={serviceOptions}
                />
                {(filterCompany || filterService) && (
                    <Button
                        name={undefined}
                        onClick={handleClearFilters}
                    >
                        Clear Filters
                    </Button>
                )}
            </div>
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
