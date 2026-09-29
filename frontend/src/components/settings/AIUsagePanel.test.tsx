import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { AIUsagePanel } from './AIUsagePanel';
import { apiService } from '@/services/api';

vi.mock('@/services/api', () => ({ apiService: { get: vi.fn() } }));

const data = {
  total: {
    requests: 2,
    input_tokens: 1000,
    output_tokens: 500,
    cached_tokens: 200,
    reasoning_tokens: 300,
    cost_usd: 0.000332,
    unpriced: 1,
    errors: 1
  },
  models: [],
  recent: [],
  tracking_since: '2026-09-28 00:00:00',
  prices: [
    {
      provider: 'openai',
      model: 'gpt-6-luna',
      label: 'GPT-6 Luna',
      rate: {
        input: 0.1,
        output: 0.5,
        cached: 0.01,
        source: 'https://developers.openai.com/api/docs/pricing',
        checked: '2026-09-28'
      }
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('shows partial cost, unknown requests and published prices', async () => {
  vi.mocked(apiService.get).mockResolvedValue(data);
  render(<AIUsagePanel />);
  expect(await screen.findByText('Costo conocido (parcial)')).toBeTruthy();
  expect(screen.getByText(/1 solicitudes sin costo estimable/)).toBeTruthy();
  expect(screen.getByText(/0,000332|0\.000332/)).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Tarifas de tokens' }));
  expect(await screen.findByText(/0,10|0\.10/)).toBeTruthy();
  expect(screen.getByText(/0,50|0\.50/)).toBeTruthy();
});

test('failed refresh removes stale totals instead of showing zero or old costs', async () => {
  vi.mocked(apiService.get).mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('offline'));
  render(<AIUsagePanel />);
  await screen.findByText(/0,000332|0\.000332/);
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar consumo' }));
  expect(await screen.findByText(/No se pudo cargar el consumo/)).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(/0,000332|0\.000332/)).toBeNull());
});
