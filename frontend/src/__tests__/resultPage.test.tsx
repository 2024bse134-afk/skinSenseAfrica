import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultPage from '@/app/result/[id]/page';
import * as api from '@/features/assessment/api';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    use: (promise: any) => promise,
}));

jest.mock('@/features/assessment/api', () => ({
    getAssessment: jest.fn(),
}));

describe('ResultPage component', () => {
    const mockPush = jest.fn();
    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    it('shows loading state initially', async () => {
        (api.getAssessment as jest.Mock).mockResolvedValueOnce({});
        render(<ResultPage params={Promise.resolve({ id: 'test-id' })} />);
        expect(screen.getByText(/Loading Results.../i)).toBeInTheDocument();
    });

    it('displays low confidence UI when recommendation confidence < 0.82', async () => {
        (api.getAssessment as jest.Mock)
            .mockResolvedValueOnce({}) // initial load without recommendation
            .mockResolvedValueOnce({
                recommendation: { confidence_score: 0.59, recommendation: 'some condition' },
                safety: { recommendation_permission: 'allowed' },
            });
        render(<ResultPage params={Promise.resolve({ id: 'test-id' })} />);
        await waitFor(() => expect(screen.getByText(/Results not ready/i)).toBeInTheDocument());
        // after polling, low confidence UI should appear
        await waitFor(() => expect(screen.getByText(/PROFESSIONAL EVALUATION RECOMMENDED/i)).toBeInTheDocument());
    });

    it('displays high confidence UI when recommendation confidence >= 0.82', async () => {
        (api.getAssessment as jest.Mock)
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({
                recommendation: { confidence_score: 0.85, recommendation: 'some condition' },
                safety: { recommendation_permission: 'allowed' },
            });
        render(<ResultPage params={Promise.resolve({ id: 'test-id' })} />);
        await waitFor(() => expect(screen.getByText(/Results not ready/i)).toBeInTheDocument());
        await waitFor(() => expect(screen.getByText(/AI-assisted screening result/i)).toBeInTheDocument());
    });
});
