import { expect, test } from '@playwright/test';
import { createRoom } from './support/room-session';

test.describe('Content Stress', () => {
    test('long content stays inside a 320 px viewport', async ({ browser }) => {
        test.setTimeout(90_000);

        for (const locale of ['en-US', 'pt-BR']) {
            const { adminContext, adminPage } = await createRoom(
                browser,
                'x'.repeat(50),
                'Sprint planning '.repeat(8).slice(0, 120),
                { locale, viewport: { height: 640, width: 320 } }
            );

            try {
                const bulkButton = adminPage.getByRole('button', {
                    name: /Bulk import stories|Importar histórias em massa/i,
                });
                await bulkButton.click();

                const bulkInput = adminPage.getByLabel(
                    /User Stories \(One per line\)|Histórias de Usuário \(uma por linha\)/i
                );
                await bulkInput.fill(`${'T'.repeat(120)}; ${'D'.repeat(2000)}`);

                const importSubmit = adminPage.getByRole('button', {
                    name: /^(Import Stories|Importar Histórias)$/i,
                });
                await importSubmit.click();
                // The import dialog closes before the server answers, so the
                // dialog is not a completion signal: assert the row itself, the
                // 120-character title and the 2000-character description that
                // have to survive a 320 px viewport.
                const importedRow = adminPage
                    .getByRole('listitem')
                    .filter({ hasText: 'T'.repeat(120) });
                await expect(importedRow).toBeVisible();
                await expect(importedRow).toContainText('D'.repeat(2000));
                await expect(
                    adminPage.getByText(/Story Backlog \(2\)|Backlog de Histórias \(2\)/)
                ).toBeVisible();

                await expect
                    .poll(async () =>
                        adminPage.evaluate(
                            () =>
                                document.documentElement.scrollWidth <=
                                document.documentElement.clientWidth
                        )
                    )
                    .toBe(true);

                const roomBadge = adminPage.getByText(/^(Room|Sala): /i).first();
                await expect(roomBadge).toBeVisible();

                const participantsHeading = adminPage
                    .getByRole('heading', { name: /Participants|Participantes/i })
                    .or(adminPage.getByText(/^(Participants|Participantes)/i))
                    .first();
                await expect(participantsHeading).toBeVisible();

                const estimationHeading = adminPage
                    .getByRole('heading', { name: /Estimation|Estimativa/i })
                    .or(adminPage.getByText(/^(Estimation|Estimativa)$/i))
                    .first();
                await expect(estimationHeading).toBeVisible();

                const settingsButton = adminPage.getByRole('button', {
                    name: /Room Settings|Configurações da Sala/i,
                });
                await settingsButton.click();

                const settingsDialog = adminPage.getByRole('dialog');
                await expect(settingsDialog).toBeVisible();

                const box = await settingsDialog.boundingBox();
                expect(box).not.toBeNull();
                if (box) {
                    expect(box.width).toBeLessThanOrEqual(320);
                }

                await adminPage.keyboard.press('Escape');
                await expect(settingsDialog).toBeHidden();

                await test.info().attach(`content-stress-${locale}`, {
                    body: await adminPage.screenshot({ fullPage: true }),
                    contentType: 'image/png',
                });
            } finally {
                await adminContext.close();
            }
        }
    });
});
