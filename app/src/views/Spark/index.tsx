import { Container } from '@ifrc-go/ui';

import Page from '#components/Page';
import { WorldMap } from './components/WorldMap';
/** @knipignore */
// eslint-disable-next-line import/prefer-default-export
export function Component() {
    return (
        <Page
            // FIXME: use strings
            title="SPARK"
            // FIXME: use strings
            heading="SPARK"
        >
            <Container>
                <WorldMap width={1200} height={600} />
            </Container>
        </Page>
    );
}

Component.displayName = 'Spark';
