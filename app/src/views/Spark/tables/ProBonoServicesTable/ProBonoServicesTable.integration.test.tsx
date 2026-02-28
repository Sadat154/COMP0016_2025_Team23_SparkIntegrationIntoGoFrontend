import {
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';
import { render, screen } from '@testing-library/react';

import ProBonoServicesTable from './index';

const mockResults = [
    {
        id: 1,
        company: 'Acme Logistics',
        name1: 'Jane Doe',
        email1: 'jane@acme.example',
        name2: 'John Smith',
        email2: 'john@acme.example',
        services: 'Air / Road',
        comments: 'Available 24/7',
    },
    {
        id: 2,
        company: 'Global Aid Co',
        name1: 'Alice Brown',
        email1: 'alice@globalaid.example',
        name2: '',
        email2: '',
        services: 'Sea',
        comments: '',
    },
];

const mockUseRequest = vi.fn(() => ({
    pending: false,
    response: { results: mockResults },
    error: undefined,
    retry: vi.fn(),
}));

vi.mock('#utils/restRequest', () => ({
    useRequest: (opts: unknown) => mockUseRequest(opts),
}));

beforeEach(() => {
    mockUseRequest.mockReturnValue({
        pending: false,
        response: { results: mockResults },
        error: undefined,
        retry: vi.fn(),
    });
});

test('ProBonoServicesTable renders table with column headers', () => {
    render(<ProBonoServicesTable />);

    expect(screen.getAllByText('Company').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Contact Name 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Transport Means & Services').length).toBeGreaterThanOrEqual(1);
});

test('ProBonoServicesTable renders API data in table', () => {
    render(<ProBonoServicesTable />);

    expect(screen.getAllByText('Acme Logistics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Global Aid Co').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Alice Brown').length).toBeGreaterThanOrEqual(1);
});

test('ProBonoServicesTable shows Company and Transport filters', () => {
    render(<ProBonoServicesTable />);

    expect(screen.getAllByPlaceholderText('All Companies').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText('All Transport Services').length).toBeGreaterThanOrEqual(1);
});

test('ProBonoServicesTable shows loading state when pending', () => {
    mockUseRequest.mockReturnValue({
        pending: true,
        response: undefined,
        error: undefined,
        retry: vi.fn(),
    });

    render(<ProBonoServicesTable />);

    expect(screen.getAllByText('Company').length).toBeGreaterThanOrEqual(1);
});
