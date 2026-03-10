import React from 'react';
import {
    render,
    screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';

import { Component as SparkView } from '#views/Spark';

import SparkRouterWrapper from './Spark.testUtils';

const mockNavigate = vi.fn();

const mockRequestReturn = {
    pending: false,
    response: undefined,
    error: undefined,
    retry: vi.fn(),
};

vi.mock('#hooks/useRouting', () => ({
    default: () => ({ navigate: mockNavigate }),
}));

vi.mock('#utils/restRequest', () => ({
    useRequest: () => mockRequestReturn,
    useLazyRequest: () => ({ ...mockRequestReturn, trigger: vi.fn() }),
    useExternalRequest: () => mockRequestReturn,
    useRiskRequest: () => mockRequestReturn,
    useRiskLazyRequest: () => ({ ...mockRequestReturn, trigger: vi.fn() }),
    RequestContext: React.createContext(null),
}));

vi.mock('#views/SparkStockInventory/WarehouseStocksTable', () => ({ default: () => null }));
vi.mock('#views/SparkProBonoServices', () => ({ default: () => null }));

beforeEach(() => {
    mockNavigate.mockClear();
    globalThis.fetch = vi.fn((url: string) => {
        if (typeof url === 'string' && (url.includes('/api/') || url.includes('/data/'))) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results: [] }),
                text: () => Promise.resolve(''),
            } as Response);
        }
        return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    }) as typeof fetch;
});

afterEach(() => {
    vi.clearAllMocks();
});

function getTab(name: RegExp | string): HTMLElement {
    const tabs = screen.getAllByRole('button', { name });
    return tabs[0]!;
}

test('Spark layout renders all four tab labels', () => {
    render(
        <SparkRouterWrapper>
            <SparkView />
        </SparkRouterWrapper>,
    );

    expect(getTab(/stock inventory/i)).toBeDefined();
    expect(getTab(/framework agreements/i)).toBeDefined();
    expect(getTab(/pro bono services/i)).toBeDefined();
    expect(getTab(/custom regulations/i)).toBeDefined();
});

test('Spark layout shows SPARK heading', () => {
    render(
        <SparkRouterWrapper>
            <SparkView />
        </SparkRouterWrapper>,
    );

    const headings = screen.getAllByRole('heading', { name: /^SPARK$/i });
    expect(headings.length).toBeGreaterThanOrEqual(1);
});

test('Spark at /spark shows Stock Inventory tab (default)', () => {
    render(
        <SparkRouterWrapper initialEntry="/spark">
            <SparkView />
        </SparkRouterWrapper>,
    );

    const stockTab = getTab(/stock inventory/i);
    expect(stockTab.querySelector('[class*="active"]')).toBeTruthy();
});

test('Clicking Framework Agreements tab calls navigate with sparkFrameworkAgreements', async () => {
    const user = userEvent.setup();
    render(
        <SparkRouterWrapper>
            <SparkView />
        </SparkRouterWrapper>,
    );

    await user.click(getTab(/framework agreements/i));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('sparkFrameworkAgreements');
});

test('Clicking Custom Regulations tab calls navigate with sparkCustomRegulations', async () => {
    const user = userEvent.setup();
    render(
        <SparkRouterWrapper>
            <SparkView />
        </SparkRouterWrapper>,
    );

    await user.click(getTab(/custom regulations/i));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('sparkCustomRegulations');
});
