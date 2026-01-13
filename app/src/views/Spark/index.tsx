import { Container } from '@ifrc-go/ui';
import { useState } from 'react';

import Page from '#components/Page';
import styles from './styles.module.css';
import { WorldMap } from './components/WorldMap';
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
                <ul className={styles.tabs} role="tablist">
                    {[
                        'SPARK Dashboard',
                        'Framework Agreements',
                        'Pro Bono Services',
                        'Custom Regulations',
                    ].map((tab) => (
                        <li key={tab} className={styles.tabItem}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab}
                                className={activeTab === tab ? styles.tabSelected : styles.tab}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className={styles.tabContent}>
                {activeTab === 'SPARK Dashboard' && (
                    <div className={styles.placeholder}>
                        <h2 className={styles.placeholderTitle}>SPARK Dashboard</h2>
                        <p className={styles.placeholderText}>Overview map and dashboard widgets.</p>
                        <Container>
                            <WorldMap width={1200} height={600} />
                        </Container>
                    </div>
                )}

                {activeTab === 'Framework Agreements' && (
                    <div className={styles.placeholder}>
                        <h2 className={styles.placeholderTitle}>Framework Agreements</h2>
                        <p className={styles.placeholderText}>Placeholder for framework agreements content.</p>
                    </div>
                )}

                {activeTab === 'Pro Bono Services' && (
                    <div className={styles.placeholder}>
                        <h2 className={styles.placeholderTitle}>Pro Bono Services</h2>
                        <p className={styles.placeholderText}>Placeholder for pro bono services content.</p>
                    </div>
                )}

                {activeTab === 'Custom Regulations' && (
                    <div className={styles.placeholder}>
                        <h2 className={styles.placeholderTitle}>Custom Regulations</h2>
                        <p className={styles.placeholderText}>Placeholder for custom regulations content.</p>
                    </div>
                )}
            </div>
        </Page>
    );
}

Component.displayName = 'Spark';
