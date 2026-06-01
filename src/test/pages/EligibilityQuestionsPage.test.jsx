import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../test-utils';
import EligibilityQuestionsPage from '../../pages/EligibilityQuestionsPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('EligibilityQuestionsPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders page title', () => {
    render(<EligibilityQuestionsPage />);

    expect(screen.getByText('A few quick questions')).toBeInTheDocument();
  });

  it('displays first question about age', () => {
    render(<EligibilityQuestionsPage />);

    expect(screen.getByText('Are you over 75 years old?')).toBeInTheDocument();
  });

  it('shows Yes and No answer buttons', () => {
    render(<EligibilityQuestionsPage />);

    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('shows question progress indicator', () => {
    render(<EligibilityQuestionsPage />);

    expect(screen.getByText(/Question 1 of 4/i)).toBeInTheDocument();
  });

  it('advances to next question when answer is selected', async () => {
    const user = userEvent.setup();
    render(<EligibilityQuestionsPage />);

    const noButton = screen.getByRole('button', { name: 'No' });
    await user.click(noButton);

    expect(screen.getByText('Do you have any roof works planned in the next 12 months?')).toBeInTheDocument();
  });

  it('continue button is disabled until all questions are answered', () => {
    render(<EligibilityQuestionsPage />);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();
  });

  it('navigates to slot-selection when all qualifying answers are given', async () => {
    const user = userEvent.setup();
    render(<EligibilityQuestionsPage />);

    // Answer all questions with qualifying responses
    // Q1: Over 75? -> No (qualifying)
    await user.click(screen.getByRole('button', { name: 'No' }));

    // Q2: Roof works planned? -> No (qualifying)
    await user.click(screen.getByRole('button', { name: 'No' }));

    // Q3: Income over £15k? -> Yes (qualifying)
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    // Q4: Likely to pass credit check? -> Yes (qualifying)
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    // Click continue
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).not.toBeDisabled();
    await user.click(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/slot-selection', search: '' });
  });

  it('navigates to confirmation with disqualified status when over 75', async () => {
    const user = userEvent.setup();
    render(<EligibilityQuestionsPage />);

    // Q1: Over 75? -> Yes (disqualifying)
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    // Q2: Roof works planned? -> No
    await user.click(screen.getByRole('button', { name: 'No' }));

    // Q3: Income over £15k? -> Yes
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    // Q4: Likely to pass credit check? -> Yes
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    // Click continue
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/confirmation', search: '' },
      { replace: true }
    );
  });
});
