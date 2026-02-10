import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    Button,
    Container,
    TextInput,
    Modal,
} from '@ifrc-go/ui';

import { useRequest } from '#utils/restRequest';

import styles from './CustomsUpdates.module.css';

interface Snippet {
    id: string;
    snippet_order: number;
    snippet_text: string;
    claim_tags?: string[];
}

interface Source {
    id: string;
    rank: number;
    url: string;
    title: string;
    publisher: string;
    published_at: string | null;
    retrieved_at: string;
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
    confidence: 'High' | 'Medium' | 'Low';
    summary_text: string;
    current_situation_bullets: string[];
    sources: Source[];
    status: 'success' | 'partial' | 'failed';
    error_message?: string;
}

function CustomsUpdates() {
    const [countryInput, setCountryInput] = useState<string>('');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const {
        pending,
        response,
        error,
    } = useRequest({
        skipOnMount: true,
        url: selectedCountry ? `/api/v2/customs-ai-updates/${encodeURIComponent(selectedCountry)}/` : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const typedResponse = (response as CustomsSnapshot | undefined);

    const handleSearch = useCallback(() => {
        if (countryInput.trim()) {
            setSelectedCountry(countryInput.trim());
        }
    }, [countryInput]);

    const handleCountryInputChange = useCallback((value: string | undefined) => {
        setCountryInput(value ?? '');
    }, []);

    const handleKeyPress = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        },
        [handleSearch],
    );

    const confidenceBadgeClass = useMemo(() => {
        if (!typedResponse) return undefined;
        if (typedResponse.confidence === 'High') return styles.successBadge;
        if (typedResponse.confidence === 'Medium') return styles.warningBadge;
        return styles.dangerBadge;
    }, [typedResponse]);

    const formattedDate = useMemo(() => {
        if (!typedResponse) return '';
        return new Date(typedResponse.generated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }, [typedResponse]);

    return (
        <Container
            heading="Customs Updates"
            headerDescription="Search for AI-generated customs clearance information by country"
            footerActions={<Button name="customs_search" onClick={handleSearch} disabled={!countryInput.trim()}>Search</Button>}
        >
            <div className={styles.searchContainer}>
                <TextInput
                    name="country-search"
                    label="Country Name"
                    value={countryInput}
                    onChange={handleCountryInputChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter country name (e.g., Kenya, Mozambique)"
                />
            </div>

            {pending && (
                <div className={styles.loadingContainer}>
                    <p>Loading customs data...</p>
                </div>
            )}

            {error && (
                <div className={styles.errorContainer}>
                    <p className={styles.error}>
                        Error: An error occurred while fetching customs data
                    </p>
                </div>
            )}

            {typedResponse && (
                <div className={styles.resultContainer}>
                    <div className={styles.header}>
                        <div>
                            <h2 className={styles.countryName}>{typedResponse?.country_name}</h2>
                            <p className={styles.generatedDate}>
                                Last updated: {formattedDate}
                            </p>
                        </div>
                        <div className={`${styles.confidenceBadge} ${confidenceBadgeClass}`}>
                            {typedResponse?.confidence} Confidence
                        </div>
                    </div>

                    {(typedResponse?.confidence === 'Low' || typedResponse?.status === 'partial') && (
                        <div className={styles.warningBox}>
                            ⚠️ Limited source credibility. Information may be incomplete or outdated.
                        </div>
                    )}

                    <div className={styles.summarySection}>
                        <h3 className={styles.sectionTitle}>Current Situation</h3>
                        <p className={styles.summaryText}>{typedResponse?.summary_text}</p>

                        {typedResponse?.current_situation_bullets && typedResponse.current_situation_bullets.length > 0 && (
                            <ul className={styles.bulletList}>
                                {typedResponse.current_situation_bullets.map((bullet: string, idx: number) => (
                                    <li key={idx}>{bullet}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className={styles.sourceSection}>
                        <div className={styles.sourceHeader}>
                            <h3 className={styles.sectionTitle}>Sources ({typedResponse?.sources?.length ?? 0})</h3>
                            <Button
                                name="view_details"
                                onClick={() => setShowDetailsModal(true)}
                            >
                                View Details
                            </Button>
                        </div>

                        {typedResponse?.sources?.map((source: Source) => (
                            <div key={source.id} className={styles.sourceCard}>
                                <div className={styles.sourceCardHeader}>
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.sourceTitle}
                                    >
                                        {source.title}
                                    </a>
                                    <span className={styles.sourceRank}>Rank {source.rank}</span>
                                </div>
                                <p className={styles.sourcePublisher}>
                                    {source.publisher}
                                    {source.published_at && (
                                        <span className={styles.sourceDate}>
                                            {' '}
                                            • {new Date(source.published_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </p>
                                {source.snippets && source.snippets.length > 0 && (
                                    <div className={styles.snippetPreview}>
                                        {source.snippets[0]?.snippet_text.substring(0, 200) ?? ''}...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {showDetailsModal && typedResponse && (
                        <Modal
                            title={`Customs Update Details - ${typedResponse.country_name}`}
                            onClose={() => setShowDetailsModal(false)}
                        >
                            <div className={styles.detailsModal}>
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
                                                <strong>Publisher:</strong> {source.publisher || 'Unknown'}
                                            </p>
                                            {source.published_at && (
                                                <p className={styles.sourceDetailInfo}>
                                                    <strong>Published:</strong> {new Date(source.published_at).toLocaleDateString()}
                                                </p>
                                            )}
                                            <p className={styles.scoreInfo}>
                                                <strong>Credibility Scores:</strong>
                                                <br />
                                                Authority: {source.authority_score} | Freshness: {source.freshness_score} | Relevance: {source.relevance_score} | Specificity: {source.specificity_score}
                                                <br />
                                                <strong>Total:</strong> {source.total_score}
                                            </p>

                                            {source.snippets && source.snippets.length > 0 && (
                                                <div className={styles.snippetsContainer}>
                                                    <strong className={styles.snippetsTitle}>Evidence Snippets:</strong>
                                                    {source.snippets.map((snippet: Snippet) => (
                                                        <div key={snippet.id} className={styles.snippetBox}>
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

export default CustomsUpdates;
