import { useState } from 'react';
import {
    Container,
    Tab,
    TabList,
    TabPanel,
    Tabs,
} from '@ifrc-go/ui';
import { Outlet, useLocation } from 'react-router-dom';

import Page from '#components/Page';
import useRouting from '#hooks/useRouting';

import WorldMap from './components/WorldMap';
import WarehouseStocksTable from './WarehouseStocks/WarehouseStocksTable';
import ProBonoServicesTable from './ProBonoServicesTable';
import CustomRegulationsMatrix from './CustomRegulationsMatrix';

import styles from './styles.module.css';
/** @knipignore */

type SparkTabKey =
    | 'spark-dashboard'
    | 'warehouse-stocks'
    | 'framework-agreements'
    | 'pro-bono-services'
    | 'custom-regulations';

export function Component() {
    const location = useLocation();
    const { navigate } = useRouting();

    const [localActiveTab, setLocalActiveTab] = useState<SparkTabKey>('spark-dashboard');

    const isFrameworkAgreementsRoute = location.pathname.startsWith('/spark/framework-agreements');
    const activeTab: SparkTabKey = isFrameworkAgreementsRoute
        ? 'framework-agreements'
        : localActiveTab;

    const handleTabChange = (nextTab: SparkTabKey) => {
        if (nextTab === 'framework-agreements') {
            navigate('sparkFrameworkAgreements');
            return;
        }

        // Keep the URL clean for non-routed tabs
        navigate('globalLogistics');
        setLocalActiveTab(nextTab);
    };

    return (
        <Page
            title="SPARK"
            heading="SPARK"
            description="Centralised Platform for Enhancing Emergency Supply Chain and Decision-Making"
        >
            <div className={styles.tabsContainer}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    styleVariant="tab"
                >
                    <TabList>
                        <Tab name="spark-dashboard">SPARK Dashboard</Tab>
                        <Tab name="warehouse-stocks">Warehouse Stocks</Tab>
                        <Tab name="framework-agreements">Framework Agreements</Tab>
                        <Tab name="pro-bono-services">Pro Bono Services</Tab>
                        <Tab name="custom-regulations">Custom Regulations</Tab>
                    </TabList>

                    <TabPanel name="spark-dashboard">
                        <div className={styles.tabContent}>
                            <div className={styles.placeholder}>
                                <h2 className={styles.placeholderTitle}>SPARK Dashboard</h2>
                                <p className={styles.placeholderText}>Overview map and dashboard widgets.</p>
                                <Container>
                                    <WorldMap width={1200} height={600} />
                                </Container>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel name="warehouse-stocks">
                        <div className={styles.tabContent}>
                            <WarehouseStocksTable />
                        </div>
                    </TabPanel>

                    <TabPanel name="framework-agreements">
                        <div className={styles.tabContent}>
                            <Outlet />
                        </div>
                    </TabPanel>

                    <TabPanel name="pro-bono-services">
                        <div className={styles.tabContent}>
                            <ProBonoServicesTable />
                        </div>
                    </TabPanel>

                    <TabPanel name="custom-regulations">
                        <div className={styles.tabContent}>
                            <CustomRegulationsMatrix />
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        </Page>
    );
}

Component.displayName = 'Spark';
