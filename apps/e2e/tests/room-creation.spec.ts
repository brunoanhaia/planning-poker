import { test, expect } from '@playwright/test';

test('creates a room and verifies admin presence', async ({ page }) => {
    await page.goto('/');

    // Enter display name
    await page.getByLabel(/Your Display Name/i).fill('E2E Admin');

    // Enter session title
    await page.getByLabel(/Session \/ Project Title/i).fill('E2E Test Session');

    // Click start session
    await page.getByRole('button', { name: /Start Session & Generate Room Code/i }).click();

    // Verify navigation to room by checking if the room title is visible in the Navbar
    await expect(page.getByText('E2E Test Session')).toBeVisible({ timeout: 10000 });

    // Admin should see the Admin badge
    await expect(page.getByText('👑 Admin')).toBeVisible();

    // Admin should see the Settings button
    await expect(page.getByRole('button', { name: /Room Settings/i })).toBeVisible();
});
