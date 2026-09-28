import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, ThemeSelector } from '@/components/common/ThemeProvider';

afterEach(cleanup);
it('recupera la preferencia guardada y permite cambiarla desde el selector', async () => {
  localStorage.setItem('rpa-theme', 'dark');
  const { unmount } = render(<ThemeProvider><ThemeSelector /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe('dark');
  await userEvent.click(screen.getByRole('combobox', { name: 'Apariencia' }));
  await userEvent.click(screen.getByText('Día'));
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  expect(localStorage.getItem('rpa-theme')).toBe('light');
  unmount();
  render(<ThemeProvider><ThemeSelector /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('usa el tema del sistema cuando no existe una preferencia explícita', () => {
  render(<ThemeProvider><ThemeSelector /></ThemeProvider>);
  expect(localStorage.getItem('rpa-theme')).toBe('system');
  expect(document.documentElement.dataset.theme).toBe('light');
});
