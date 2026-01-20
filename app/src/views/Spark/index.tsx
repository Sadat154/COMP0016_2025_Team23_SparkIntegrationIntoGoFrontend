import { Container, Tabs, TabList, TabPanel, Tab } from '@ifrc-go/ui';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Page from '#components/Page';
import useRouting from '#hooks/useRouting';
import styles from './styles.module.css';
import { WorldMap } from './components/WorldMap';
import { ProBonoServicesTable, FrameworkAgreementsTable } from './tables';
/** @knipignore */

type SparkTabKey = 'spark-dashboard' | 'framework-agreements' | 'pro-bono-services' | 'custom-regulations';

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
            description={(
                "Centralised Platform for Enhancing Emergency Supply Chain and Decision-Making"
            )}
        >
            <div className={styles.tabsContainer}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    styleVariant="tab"
                >
                    <TabList>
                        <Tab name="spark-dashboard">SPARK Dashboard</Tab>
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
                            <div className={styles.placeholder}>
                                <h2 className={styles.placeholderTitle}>Custom Regulations</h2>
                                <p className={styles.placeholderText}>Placeholder for custom regulations content.</p>
                            </div>
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        </Page>
    );
}

Component.displayName = 'Spark';
