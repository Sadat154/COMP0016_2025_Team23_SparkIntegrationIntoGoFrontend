import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    Modal,
} from '@ifrc-go/ui';

import { useRequest } from '#utils/restRequest';

import useCountryRaw from '#hooks/domain/useCountryRaw';

import styles from './CustomsDataCard.module.css';

interface Snippet {
    id: string;
    snippet_order: number;
    snippet_text: string;
}

interface Source {
    id: string;
    rank: number;
    url: string;
    title: string;
    publisher: string;
    published_at: string | null;
    authority_score: number;
    freshness_score: number;
    relevance_score: number;
    specificity_score: number;
    total_score: number;
    snippets: Snippet[];
}

interface CustomsSnapshot {
    id: string;
    country_name: string;
    generated_at: string;
    summary_text: string;
    current_situation_bullets: string[];
    sources: Source[];
    status: 'success' | 'partial' | 'failed';
    error_message?: string;
}

interface CustomsDataCardProps {
    countryIso3?: string | null;
}

function CustomsDataCard(props: CustomsDataCardProps) {
    const { countryIso3 } = props;
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const countriesRaw = useCountryRaw() as Array<{ iso3?: string | null; name?: string | null }> | undefined;
    const countryName = useMemo(() => {
        if (!countryIso3) return undefined;
        const match = (countriesRaw ?? []).find(
            (c) => (c.iso3 || '').toUpperCase() === countryIso3.toUpperCase(),
        );
        return match?.name ?? countryIso3;
    }, [countriesRaw, countryIso3]);

    const {
        pending,
        response,
        error,
    } = useRequest({
        skip: !countryName,
        url: countryName ? `/api/v2/customs-ai-updates/${encodeURIComponent(countryName)}/` : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const typedResponse = (response as CustomsSnapshot | undefined);

    const formattedDate = useMemo(() => {
        if (!typedResponse) return '';
        const d = new Date(typedResponse.generated_at);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}-${mm}-${yy}`;
    }, [typedResponse]);

    const handleViewDetails = useCallback(() => {
        setShowDetailsModal(true);
    }, []);

    if (!countryIso3) {
        return null;
    }

    return (
        <Container
            className={styles.customsDataCard}
            heading="Real-Time Customs Information"
            headingLevel={3}
        >
            {pending && (
                <div className={styles.loadingContainer}>
                    <p>Loading customs data...</p>
                </div>
            )}

            {error && (
                <div className={styles.errorContainer}>
                    <p className={styles.error}>
                        Unable to load customs data for this country
                    </p>
                </div>
            )}

            {typedResponse && (
                <div className={styles.contentContainer}>
                    <div className={styles.headerRow}>
                        <p className={styles.generatedDate}>
                            Last update:
                            {' '}
                            {formattedDate}
                        </p>
                        <Button
                            name="view_customs_details"
                            onClick={handleViewDetails}
                        >
                            View Details
                        </Button>
                    </div>

                    <p className={styles.summaryText}>
                        <strong>Current situation:</strong>
                        {' '}
                        {typedResponse.summary_text}
                    </p>

                    <p className={styles.disclaimer}>
                        Customs information is indicative and situational. Always confirm with your customs agent or IFRC logistics focal point before shipment
                    </p>

                    {showDetailsModal && (
                        <Modal
                            title={`Customs Details - ${typedResponse.country_name}`}
                            onClose={() => setShowDetailsModal(false)}
                        >
                            <div className={styles.detailsModal}>
                                {/* Sources Section */}
                                <div className={styles.modalSection}>
                                    <h4 className={styles.modalSectionTitle}>Sources & Evidence</h4>
                                    {typedResponse.sources?.map((source: Source) => (
                                        <div key={source.id} className={styles.sourceDetailCard}>
                                            <div className={styles.sourceDetailHeader}>
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.sourceDetailTitle}
                                                >
                                                    {source.title}
                                                </a>
                                            </div>
                                            <p className={styles.sourceDetailInfo}>
                                                <strong>Publisher:</strong>
                                                {' '}
                                                {source.publisher || 'Unknown'}
                                            </p>
                                            {source.published_at && (
                                                <p className={styles.sourceDetailInfo}>
                                                    <strong>Published:</strong>
                                                    {' '}
                                                    {new Date(
                                                        source.published_at,
                                                    ).toLocaleDateString()}
                                                </p>
                                            )}
                                            <p className={styles.scoreInfo}>
                                                <strong>Credibility Scores:</strong>
                                                <br />
                                                Authority:
                                                {' '}
                                                {source.authority_score}
                                                {' '}
                                                | Freshness:
                                                {' '}
                                                {source.freshness_score}
                                                {' '}
                                                | Relevance:
                                                {' '}
                                                {source.relevance_score}
                                                {' '}
                                                | Specificity:
                                                {' '}
                                                {source.specificity_score}
                                                <br />
                                                <strong>Total:</strong>
                                                {' '}
                                                {source.total_score}
                                            </p>

                                            {source.snippets && source.snippets.length > 0 && (
                                                <div className={styles.snippetsContainer}>
                                                    <strong className={styles.snippetsTitle}>
                                                        Evidence Snippets:
                                                    </strong>
                                                    {source.snippets.map((snippet: Snippet) => (
                                                        <div
                                                            key={snippet.id}
                                                            className={styles.snippetBox}
                                                        >
                                                            <p className={styles.snippetText}>
                                                                {snippet.snippet_text}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Modal>
                    )}
                </div>
            )}
        </Container>
    );
}

export default CustomsDataCard;
