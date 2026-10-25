import { expect, test } from '@playwright/test';

// The browser default locale is not guaranteed (this host opens in pt-BR), so the
// language every test starts from is pinned instead of inherited.
test.use({ locale: 'en-US' });

test('shows English by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Planit Poker Real-Time' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Create Session' })).toBeVisible();
});

test('switches to Portuguese and persists across reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Change language/i }).click();
    await page.getByText('Português (Brasil)').click();

    await expect(page.getByRole('heading', { name: 'Planit Poker em Tempo Real' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Criar Sessão' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Planit Poker em Tempo Real' })).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('planit_language'));
    expect(stored).toBe('pt-BR');
});

test('renders Spanish for an es-AR browser', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'es-AR' });
    const page = await context.newPage();

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Planit Poker en Tiempo Real' })).toBeVisible({
        timeout: 10000,
    });

    await context.close();
});

test('shows the Portuguese ROOM_NOT_FOUND message', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Change language/i }).click();
    await page.getByText('Português (Brasil)').click();
    await expect(page.getByRole('heading', { name: 'Planit Poker em Tempo Real' })).toBeVisible();

    await page.getByRole('tab', { name: 'Entrar na Sessão' }).click();
    await page.getByLabel('Seu Nome de Exibição').fill('E2E Tester');
    await page.getByLabel(/Código da Sala com 8 Caracteres/).fill('ZZZZZZZZ');
    await page.getByRole('button', { name: 'Entrar na Sala Agora' }).click();

    await expect(page.getByText('Sala não encontrada. Confira o código.')).toBeVisible({
        timeout: 10000,
    });
});
