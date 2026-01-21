import { Container, Tabs, TabList, TabPanel, Tab } from '@ifrc-go/ui';
import { useState } from 'react';

import Page from '#components/Page';
import styles from './styles.module.css';
import { WorldMap } from './components/WorldMap';
import ProBonoServicesTable from './ProBonoServicesTable';
import CustomRegulationsMatrix from './CustomRegulationsMatrix';
/** @knipignore */

export function Component() {
    const [activeTab, setActiveTab] = useState<string>('SPARK Dashboard');
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
                    onChange={setActiveTab}
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
                            <div className={styles.placeholder}>
                                <h2 className={styles.placeholderTitle}>Framework Agreements</h2>
                                <p className={styles.placeholderText}>Placeholder for framework agreements content.</p>
                            </div>
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
