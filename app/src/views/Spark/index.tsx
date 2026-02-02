import { useState } from 'react';
import {
    Outlet,
    useLocation,
} from 'react-router-dom';
import {
    Tab,
    TabList,
    TabPanel,
    Tabs,
} from '@ifrc-go/ui';

import Page from '#components/Page';
import useRouting from '#hooks/useRouting';

import WarehouseStocksTable from './WarehouseStocks/WarehouseStocksTable';
import ProBonoServicesTable from './tables';

import styles from './styles.module.css';

type SparkTabKey =
    | 'spark-dashboard'
    | 'warehouse-stocks'
    | 'framework-agreements'
    | 'pro-bono-services'
    | 'custom-regulations';

/** @knipignore */
function Component() {
    const location = useLocation();
    const { navigate } = useRouting();

    const [localActiveTab, setLocalActiveTab] = useState<SparkTabKey>('spark-dashboard');

    const isFrameworkAgreementsRoute = location.pathname.startsWith('/spark/framework-agreements');
    const isCustomRegulationsRoute = location.pathname.startsWith('/spark/custom-regulations');

    let activeTab: SparkTabKey = localActiveTab;
    if (isFrameworkAgreementsRoute) {
        activeTab = 'framework-agreements';
    } else if (isCustomRegulationsRoute) {
        activeTab = 'custom-regulations';
    }

    const handleTabChange = (nextTab: SparkTabKey) => {
        if (nextTab === 'framework-agreements') {
            navigate('sparkFrameworkAgreements');
            return;
        }

        if (nextTab === 'custom-regulations') {
            navigate('sparkCustomRegulations');
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
                                <p className={styles.placeholderText}>
                                    Overview map and dashboard widgets.
                                </p>

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
                            <Outlet />
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        </Page>
    );
}

Component.displayName = 'Spark';

/** @knipignore */
export { Component };
export default Component;
