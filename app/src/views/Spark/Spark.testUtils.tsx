import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface SparkRouterWrapperProps {
    children: ReactNode;
    /** Initial URL path for the router (e.g. "/spark" or "/spark/framework-agreements"). */
    initialEntry?: string;
}

/**
 * Wraps children in MemoryRouter for SPARK integration tests.
 * Use with vi.mock('#hooks/useRouting') to control navigation in tests.
 */
export function SparkRouterWrapper({
    children,
    initialEntry = '/spark',
}: SparkRouterWrapperProps) {
    return (
        <MemoryRouter initialEntries={[initialEntry]}>
            {children}
        </MemoryRouter>
    );
}
