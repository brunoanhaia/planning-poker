import { test, expect } from '@playwright/test';

test.describe('Admin Management', () => {
  test('admin can manage room settings', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');

    await adminPage.getByLabel(/Your Display Name/i).fill('Admin');
    await adminPage.getByRole('button', { name: /Start Session & Generate Room Code/i }).click();

    // Verify Settings is accessible
    await adminPage.getByRole('button', { name: /Room Settings/i }).click();
    
    // Check if the dialog is open
    const dialog = adminPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Toggle lock room
    const lockSwitch = adminPage.getByRole('checkbox', { name: /Lock Room/i });
    if (await lockSwitch.count() > 0) {
      await lockSwitch.click();
    }
    
    // Save settings
    await adminPage.getByRole('button', { name: /Apply Settings/i }).click();

    // Wait for modal to close
    await expect(dialog).toBeHidden();

    // Verify Locked chip is visible
    await expect(adminPage.getByText('Locked').first()).toBeVisible();

    await adminContext.close();
  });
});
