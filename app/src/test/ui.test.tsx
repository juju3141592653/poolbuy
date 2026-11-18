/** Screen-level tests: the acceptance criteria users can see. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { buildSeedState } from '../data/seed';
import { StoreProvider } from '../state/store';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(
    <StoreProvider initialState={buildSeedState()}>
      <App />
    </StoreProvider>,
  );
}

async function go(hash: string) {
  // Simulates the user typing a URL / using an external link.
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  window.location.hash = '';
});

describe('Screen 1: pool list', () => {
  it('shows each open pool with price, progress and time left, and the footer disclaimer', () => {
    renderAt('#/');
    const card = screen.getByTestId('pool-card-pool-tote');
    expect(within(card).getByText('Custom tote bags for craft sellers')).toBeInTheDocument();
    expect(within(card).getByText('US$1.50')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '420');
    expect(within(card).getByText(/left$/)).toBeInTheDocument();
    expect(screen.getByText('Student concept prototype for SC4025. Not affiliated with Alibaba.')).toBeInTheDocument();
  });
  it('labels every status in text, not colour alone', () => {
    renderAt('#/');
    expect(screen.getAllByText('Filling').length).toBeGreaterThan(0);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});

describe('Screen 2: pool detail (stories 4 and 5)', () => {
  it('shows the full cost breakdown before the Join button', () => {
    renderAt('#/pool/pool-tote');
    const breakdown = screen.getByRole('table', { name: /full cost breakdown/i });
    const join = screen.getByRole('button', { name: /join pool/i });
    // DOCUMENT_POSITION_FOLLOWING (4): the button comes after the breakdown.
    expect(breakdown.compareDocumentPosition(join) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(breakdown).getByText(/GST \(9%\)/)).toBeInTheDocument();
    expect(within(breakdown).getByText('US$194.02')).toBeInTheDocument();
  });
  it('shows units to the next tier and the new price', () => {
    renderAt('#/pool/pool-tote');
    expect(screen.getByTestId('next-tier')).toHaveTextContent('580 more units unlocks US$1.00 per unit');
  });
  it('blocks invalid quantities with a message and a disabled button', async () => {
    const user = userEvent.setup();
    renderAt('#/pool/pool-tote');
    const input = screen.getByLabelText(/how many units/i);
    await user.clear(input);
    await user.type(input, '2.5');
    expect(screen.getByText('Quantity must be a whole number, like 100.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /join pool/i })).toBeDisabled();
  });
});

describe('Screen 4: join confirmation (stories 2 and 3)', () => {
  it('says you are only charged if the pool fills, then joins and confirms the pool', async () => {
    const user = userEvent.setup();
    renderAt('#/pool/pool-tote/join?qty=80');
    expect(screen.getByText('You are only charged if the pool fills.')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-join'));
    expect(await screen.findByTestId('flash')).toHaveTextContent('You filled the pool!');
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
  });
  it('re-validates the quantity from the URL instead of trusting it', () => {
    renderAt('#/pool/pool-tote/join?qty=%3Cscript%3E');
    expect(screen.getByText('Check your quantity')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-join')).not.toBeInTheDocument();
  });
});

describe('Screen 5: my pools (stories 3 and 6)', () => {
  it('lists my pools with text statuses and a Leave button only while Filling', async () => {
    const user = userEvent.setup();
    renderAt('#/my');
    const phone = screen.getByTestId('my-pool-pool-phone');
    const jar = screen.getByTestId('my-pool-pool-jar');
    expect(within(phone).getByText('Filling')).toBeInTheDocument();
    expect(within(jar).getByText('Refunded')).toBeInTheDocument();
    expect(within(jar).getByText(/hold released · nothing charged/)).toBeInTheDocument();
    expect(within(jar).queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();

    await user.click(within(phone).getByRole('button', { name: 'Leave' }));
    await user.click(within(phone).getByRole('button', { name: /yes, leave/i }));
    expect(await screen.findByTestId('flash')).toHaveTextContent('was released straight away');
    expect(screen.queryByTestId('my-pool-pool-phone')).not.toBeInTheDocument();
  });
});

describe('Screen 3: start a pool (story 1)', () => {
  it('creates a pool that shows up in the list immediately', async () => {
    const user = userEvent.setup();
    renderAt('#/start');
    await user.click(screen.getByRole('radio', { name: /custom poly mailers/i }));
    await user.click(screen.getByRole('radio', { name: /1,000 units/i }));
    await user.type(screen.getByLabelText(/how many units do you need/i), '300');
    await user.type(screen.getByLabelText(/pool title/i), 'Eco mailers for online sellers');
    await user.click(screen.getByTestId('start-pool-submit'));
    expect(await screen.findByTestId('flash')).toHaveTextContent('Your pool is live');
    await go('#/');
    expect(screen.getByText('Eco mailers for online sellers')).toBeInTheDocument();
  });
  it('keeps unverified suppliers out of pools', () => {
    renderAt('#/start');
    expect(screen.getByRole('radio', { name: /woven labels/i })).toBeDisabled();
  });
  it('shows an error instead of saving a script in the note', async () => {
    const user = userEvent.setup();
    renderAt('#/start');
    await user.click(screen.getByRole('radio', { name: /custom poly mailers/i }));
    await user.type(screen.getByLabelText(/^note$/i), '<img src=x onerror=alert(1)>');
    expect(screen.getByText(/Note can't contain angle brackets/)).toBeInTheDocument();
  });
});

describe('Demo controls', () => {
  it('Simulate deadline refunds a pool below target', async () => {
    const user = userEvent.setup();
    renderAt('#/pool/pool-box');
    await user.click(screen.getByTestId('simulate-deadline'));
    expect(await screen.findByTestId('flash')).toHaveTextContent('Refunded');
    expect(screen.getAllByText('Refunded').length).toBeGreaterThan(0);
  });
});
