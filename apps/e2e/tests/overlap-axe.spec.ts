import { COLOR_MODE_STORAGE_KEY } from '@planitpoker/shared';
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface ViewportConfig {
    name: string;
    width: number;
    height: number;
}

interface OverlapIssue {
    element1: string;
    element2: string;
    text1: string;
    text2: string;
    overlapArea: number;
}

const VIEWPORTS: ViewportConfig[] = [
    { name: 'Mobile (320px)', width: 320, height: 640 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Desktop (1280px)', width: 1280, height: 800 },
    { name: 'Wide (1920px)', width: 1920, height: 1080 },
];

/** Both design-token schemes the application ships, exercised on every viewport. */
const COLOR_MODES = ['dark', 'light'] as const;

/** Ant Design's form item wrapper, whose label is defined to sit with its control. */
const FORM_ITEM_SELECTOR = '.ant-form-item';

/**
 * Collects every pair of visible, text-bearing or interactive elements whose
 * bounding boxes intersect.
 *
 * Runs inside the page so it can use the real layout engine. Parent/child pairs
 * and label/control pairs are skipped because overlapping is their contract.
 *
 * @param formItemSelector - Wrapper class that pairs a field label with its control.
 * @returns The overlapping pairs, each with the intersection area in px².
 */
const collectOverlapIssues = (formItemSelector: string): OverlapIssue[] => {
    const issues: OverlapIssue[] = [];

    const isVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    const hasDirectText = (element: Element): boolean =>
        Array.from(element.childNodes).some(
            (node) =>
                node.nodeType === Node.TEXT_NODE &&
                Boolean(node.textContent && node.textContent.trim().length > 0)
        );

    const isInteractive = (element: Element): boolean =>
        ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);

    const describe = (element: Element): string => {
        const classes = Array.from(element.classList).join('.');
        return classes
            ? `${element.tagName.toLowerCase()}.${classes}`
            : element.tagName.toLowerCase();
    };

    const belongsToSameFormItem = (a: Element, b: Element): boolean => {
        const itemA = a.closest(formItemSelector);
        return Boolean(itemA) && itemA === b.closest(formItemSelector);
    };

    const candidates: HTMLElement[] = Array.from(
        document.querySelectorAll<HTMLElement>('*')
    ).filter(
        (element) =>
            isVisible(element) &&
            !element.closest('[aria-hidden="true"]') &&
            (hasDirectText(element) || isInteractive(element))
    );

    for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
            const elementA = candidates[i];
            const elementB = candidates[j];

            if (
                elementA.contains(elementB) ||
                elementB.contains(elementA) ||
                belongsToSameFormItem(elementA, elementB)
            ) {
                continue;
            }

            const rectA = elementA.getBoundingClientRect();
            const rectB = elementB.getBoundingClientRect();

            const overlapWidth = Math.max(
                0,
                Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left)
            );
            const overlapHeight = Math.max(
                0,
                Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top)
            );
            const overlapArea = overlapWidth * overlapHeight;

            if (overlapArea <= 0) {
                continue;
            }

            issues.push({
                element1: describe(elementA),
                element2: describe(elementB),
                overlapArea,
                text1: elementA.innerText || elementA.getAttribute('aria-label') || '',
                text2: elementB.innerText || elementB.getAttribute('aria-label') || '',
            });
        }
    }

    return issues;
};

/**
 * Asserts the current page has no axe violations and no overlapping content.
 *
 * @param page - The page under test.
 * @param viewportName - Human readable viewport label used in failure messages.
 * @param state - Which screen is on display, used in failure messages.
 */
const expectCleanLayout = async (page: Page, viewportName: string, state: string) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

    expect(
        accessibilityScanResults.violations,
        `Accessibility violations in the ${state} state on ${viewportName}`
    ).toEqual([]);

    const overlapIssues = await page.evaluate(collectOverlapIssues, FORM_ITEM_SELECTOR);

    expect(
        overlapIssues,
        `Found overlapping elements in the ${state} state on ${viewportName}:\n${JSON.stringify(
            overlapIssues,
            null,
            2
        )}`
    ).toEqual([]);
};

test.describe('UI Overlap & Text Visibility Validation', () => {
    for (const viewport of VIEWPORTS) {
        for (const colorMode of COLOR_MODES) {
            test(`validates the ${colorMode} lobby, room and results on ${viewport.name}`, async ({
                page,
            }) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.addInitScript(([key, mode]) => localStorage.setItem(key, mode), [
                    COLOR_MODE_STORAGE_KEY,
                    colorMode,
                ] as const);
                await page.goto('/');

                await expect(page.getByText('Planit Poker Real-Time')).toBeVisible({
                    timeout: 10000,
                });
                await expectCleanLayout(page, viewport.name, `${colorMode} lobby`);

                await page.getByLabel(/Your Display Name/i).fill('Overlap Tester');
                await page
                    .getByRole('button', { name: /Start Session & Generate Room Code/i })
                    .click();

                await expect(page.getByText('👑 Admin')).toBeVisible({ timeout: 10000 });
                await expect(page.getByText('Voting Progress')).toBeVisible();
                await expectCleanLayout(page, viewport.name, `${colorMode} room`);

                await page.getByRole('button', { name: 'Select estimate 5', exact: true }).click();
                await page.getByRole('button', { name: /Reveal Votes/i }).click();

                await expect(page.getByText('Estimation Results')).toBeVisible({ timeout: 10000 });
                await expectCleanLayout(page, viewport.name, `${colorMode} results`);
            });
        }
    }
});
