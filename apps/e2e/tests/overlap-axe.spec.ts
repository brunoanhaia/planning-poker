import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface ViewportConfig {
    name: string;
    width: number;
    height: number;
}

const VIEWPORTS: ViewportConfig[] = [
    { name: 'Mobile (320px)', width: 320, height: 640 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Desktop (1280px)', width: 1280, height: 800 },
];

/**
 * Custom rule in axe-core & DOM collision analysis to ensure no rendered text node
 * or interactive element is obscured by unintended overlapping sibling or parent elements.
 */
test.describe('Lobby Exploratory UI Overlap & Text Visibility Validation', () => {
    for (const vp of VIEWPORTS) {
        test(`validates no elements overlap and all text is visible on ${vp.name} viewport`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('/');

            // Wait for initial render
            await expect(page.getByText('Planit Poker Real-Time')).toBeVisible({ timeout: 10000 });

            // Run Axe accessibility scan for standard a11y & contrast/visibility rules
            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();

            expect(accessibilityScanResults.violations).toEqual([]);

            // Deep DOM bounding-rect collision and text occlusion check
            const overlapIssues = await page.evaluate(() => {
                const results: Array<{
                    element1: string;
                    element2: string;
                    text1: string;
                    text2: string;
                    overlapArea: number;
                }> = [];

                const isVisible = (el: Element): boolean => {
                    const style = window.getComputedStyle(el);
                    if (
                        style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        style.opacity === '0'
                    ) {
                        return false;
                    }
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                };

                const elements: HTMLElement[] = [];
                const all = document.querySelectorAll<HTMLElement>('*');
                for (let i = 0; i < all.length; i++) {
                    const el = all[i];
                    if (!isVisible(el)) {
                        continue;
                    }

                    // Exclude form labels (floating outlined field labels that inherently overlap input outlines by MUI design)
                    if (
                        el.tagName === 'LABEL' ||
                        el.classList.contains('MuiFormLabel-root') ||
                        el.classList.contains('MuiFormLabel-asterisk') ||
                        el.classList.contains('MuiInputLabel-root')
                    ) {
                        continue;
                    }

                    // Check if element has non-empty direct text content or is interactive control
                    const hasDirectText = Array.from(el.childNodes).some(
                        (node) =>
                            node.nodeType === Node.TEXT_NODE &&
                            Boolean(node.textContent && node.textContent.trim().length > 0)
                    );

                    const isInteractive = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(
                        el.tagName
                    );

                    if (hasDirectText || isInteractive) {
                        elements.push(el);
                    }
                }

                // Check pairwise for unintended overlap / occlusion
                for (let i = 0; i < elements.length; i++) {
                    for (let j = i + 1; j < elements.length; j++) {
                        const elA = elements[i];
                        const elB = elements[j];

                        // Skip parent-child / ancestor relationships or same form control container
                        if (
                            elA.contains(elB) ||
                            elB.contains(elA) ||
                            (elA.closest('.MuiFormControl-root') &&
                                elA.closest('.MuiFormControl-root') ===
                                    elB.closest('.MuiFormControl-root'))
                        ) {
                            continue;
                        }

                        const rectA = elA.getBoundingClientRect();
                        const rectB = elB.getBoundingClientRect();

                        // Calculate rectangle intersection
                        const xOverlap = Math.max(
                            0,
                            Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left)
                        );
                        const yOverlap = Math.max(
                            0,
                            Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top)
                        );
                        const overlapArea = xOverlap * yOverlap;

                        if (overlapArea > 0) {
                            // Elements are overlapping each other
                            results.push({
                                element1: `${elA.tagName.toLowerCase()}.${Array.from(elA.classList).join('.')}`,
                                element2: `${elB.tagName.toLowerCase()}.${Array.from(elB.classList).join('.')}`,
                                text1: elA.innerText || elA.getAttribute('aria-label') || '',
                                text2: elB.innerText || elB.getAttribute('aria-label') || '',
                                overlapArea,
                            });
                        }
                    }
                }

                return results;
            });

            expect(
                overlapIssues,
                `Found overlapping elements on ${vp.name} that may hide text:\n${JSON.stringify(overlapIssues, null, 2)}`
            ).toEqual([]);
        });
    }
});
