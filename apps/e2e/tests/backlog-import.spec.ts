import { expect, test } from '@playwright/test';
import { createRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Backlog Import', () => {
    test('bulk import appends every parsed story', async ({ browser }) => {
        const { adminContext, adminPage } = await createRoom(browser);

        try {
            await adminPage.getByRole('button', { name: 'Bulk import stories' }).click();
            await adminPage
                .getByLabel('User Stories (One per line)')
                .fill('Story A; Acceptance A\nStory B\nStory C');
            await adminPage.getByRole('button', { name: /^Import Stories$/ }).click();

            await expect(adminPage.getByText('Imported 3 stories.')).toBeVisible();
            await expect(adminPage.getByText('Story Backlog (4)')).toBeVisible();
            for (const title of ['Story A', 'Story B', 'Story C']) {
                await expect(
                    adminPage.getByRole('listitem').filter({ hasText: title })
                ).toHaveCount(1);
            }
        } finally {
            await adminContext.close();
        }
    });

    test('a paste with no usable title adds nothing', async ({ browser }) => {
        const { adminContext, adminPage } = await createRoom(browser);

        try {
            await adminPage.getByRole('button', { name: 'Bulk import stories' }).click();
            await adminPage.getByLabel('User Stories (One per line)').fill(';');
            await adminPage.getByRole('button', { name: /^Import Stories$/ }).click();

            await expect(
                adminPage.getByText(
                    'No story could be read. Give each line a title, as "Title; Description".'
                )
            ).toBeVisible();

            await adminPage.getByRole('button', { name: 'Cancel' }).click();
            await expect(adminPage.getByText('Story Backlog (1)')).toBeVisible();
        } finally {
            await adminContext.close();
        }
    });
});
