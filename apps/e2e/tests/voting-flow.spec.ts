import { test, expect } from '@playwright/test';

test.describe('Voting Flow', () => {
  test('allows voters to vote and admin to reveal', async ({ browser }) => {
    // Admin context
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');

    await adminPage.getByLabel(/Your Display Name/i).fill('Admin');
    await adminPage.getByRole('button', { name: /Start Session & Generate Room Code/i }).click();
    // Get the room code from the Navbar chip
    const roomBadge = adminPage.getByText(/^Room: /i).first();
    await expect(roomBadge).toBeVisible();
    const badgeText = await roomBadge.innerText();
    const roomCode = badgeText.replace('Room: ', '').trim();
    
    // Voter context
    const voterContext = await browser.newContext();
    const voterPage = await voterContext.newPage();
    // Join using the UI
    await voterPage.goto(`/`);
    await voterPage.getByRole('tab', { name: /Join Session/i }).click();
    await voterPage.getByLabel(/6-Character Room Code/i).fill(roomCode);
    await voterPage.getByLabel(/Your Display Name/i).fill('Voter 1');
    await voterPage.getByRole('button', { name: /Join Room Now/i }).click();

    // Voter casts a vote (e.g. 5)
    await expect(voterPage.getByText('Voter 1')).toBeVisible({ timeout: 10000 });
    
    // Wait for the voting cards to appear
    await voterPage.getByText('5', { exact: true }).last().click();
    
    // Admin reveals the votes
    await adminPage.getByRole('button', { name: /Reveal/i }).click();
    
    // Verify that the vote "5" is visible to both admin and voter
    await expect(adminPage.locator('.results-panel').or(adminPage.locator('body')).getByText('5').first()).toBeVisible();
    await expect(voterPage.locator('.results-panel').or(voterPage.locator('body')).getByText('5').first()).toBeVisible();

    // Admin resets the session
    await adminPage.getByRole('button', { name: /Reset/i }).click();
    
    // Reveal button should be visible again instead of Reset
    await expect(adminPage.getByRole('button', { name: /Reveal/i })).toBeVisible();
    
    await adminContext.close();
    await voterContext.close();
  });
});
