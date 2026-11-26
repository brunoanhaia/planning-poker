import { expect, test } from '@playwright/test';
import { createRoom } from './support/room-session';

test.describe('Content Stress', () => {
    test('the lobby primary action fits a 320 px viewport in every locale', async ({ browser }) => {
        for (const locale of ['en-US', 'pt-BR', 'es-ES']) {
            const context = await browser.newContext({
                locale,
                viewport: { height: 640, width: 320 },
            });
            try {
                const page = await context.newPage();
                await page.goto('/');

                const submit = page.getByRole('button', {
                    name: /^(Start Session & Generate Room Code|Entrar na Sala|Iniciar Sesión y Generar Código de Sala)$/i,
                });
                await expect(submit).toBeVisible();

                const metrics = await submit.evaluate((element) => ({
                    clientWidth: element.clientWidth,
                    height: element.getBoundingClientRect().height,
                    scrollWidth: element.scrollWidth,
                }));
                expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
                // A primary touch target stays comfortable even when the label
                // fits on a single line.
                expect(metrics.height).toBeGreaterThanOrEqual(44);

                const box = await submit.boundingBox();
                expect(box).not.toBeNull();
                if (box) {
                    expect(box.width).toBeLessThanOrEqual(320);
                }

                await expect
                    .poll(async () =>
                        page.evaluate(
                            () =>
                                document.documentElement.scrollWidth <=
                                document.documentElement.clientWidth
                        )
                    )
                    .toBe(true);
            } finally {
                await context.close();
            }
        }
    });

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
