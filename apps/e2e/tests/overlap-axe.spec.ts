import { COLOR_MODE_STORAGE_KEY } from '@planitpoker/shared';
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { becomeVoter, completeSetup } from './support/room-session';

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

/** Whether the element paints a box: a hidden or empty element cannot overlap. */
const isVisibleElement = (element: Element): boolean => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};

/** Whether the element owns a non-blank text node of its own. */
const hasDirectText = (element: Element): boolean =>
    Array.from(element.childNodes).some(
        (node) =>
            node.nodeType === Node.TEXT_NODE &&
            Boolean(node.textContent && node.textContent.trim().length > 0)
    );

/** Whether the element is one a user can operate. */
const isInteractive = (element: Element): boolean =>
    ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);

/** Short, CSS-like label used in failure output. */
const describeElement = (element: Element): string => {
    const classes = Array.from(element.classList).join('.');
    return classes ? `${element.tagName.toLowerCase()}.${classes}` : element.tagName.toLowerCase();
};

/** Whether both elements sit inside the same form item, whose label names its control. */
const belongsToSameFormItem = (
    elementA: Element,
    elementB: Element,
    formItemSelector: string
): boolean => {
    const item = elementA.closest(formItemSelector);
    return Boolean(item) && item === elementB.closest(formItemSelector);
};

/** Text a user would read from the element, falling back to its accessible name. */
const elementLabel = (element: Element): string =>
    (element as HTMLElement).innerText || element.getAttribute('aria-label') || '';

/** Whether the element is one the scan should compare with every other. */
const isCandidate = (element: Element): boolean =>
    isVisibleElement(element) &&
    !element.closest('[aria-hidden="true"]') &&
    (hasDirectText(element) || isInteractive(element));

/** Every element worth comparing, in document order. */
const collectCandidates = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('*')).filter(isCandidate);

/** Whether the pair is nested or label/control, so overlapping is its contract. */
const isRelatedPair = (elementA: Element, elementB: Element, formItemSelector: string): boolean =>
    elementA.contains(elementB) ||
    elementB.contains(elementA) ||
    belongsToSameFormItem(elementA, elementB, formItemSelector);

/** Area shared by the two boxes, in px². */
const intersectionArea = (elementA: Element, elementB: Element): number => {
    const rectA = elementA.getBoundingClientRect();
    const rectB = elementB.getBoundingClientRect();
    const width = Math.max(
        0,
        Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left)
    );
    const height = Math.max(
        0,
        Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top)
    );
    return width * height;
};

/** Describes the overlap of one pair, or `null` when the pair is related or disjoint. */
const describeOverlap = (
    elementA: Element,
    elementB: Element,
    formItemSelector: string
): OverlapIssue | null => {
    if (isRelatedPair(elementA, elementB, formItemSelector)) {
        return null;
    }
    const overlapArea = intersectionArea(elementA, elementB);
    if (overlapArea <= 0) {
        return null;
    }
    return {
        element1: describeElement(elementA),
        element2: describeElement(elementB),
        overlapArea,
        text1: elementLabel(elementA),
        text2: elementLabel(elementB),
    };
};

/** Pairs every candidate with every later candidate and keeps the real overlaps. */
const collectOverlapIssues = (formItemSelector: string): OverlapIssue[] => {
    const candidates = collectCandidates();
    const issues: OverlapIssue[] = [];
    for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
            const issue = describeOverlap(candidates[i], candidates[j], formItemSelector);
            if (issue) {
                issues.push(issue);
            }
        }
    }
    return issues;
};

/** Every helper the page-side scan calls, kept addressable by name. */
const PAGE_HELPERS = {
    isVisibleElement,
    hasDirectText,
    isInteractive,
    describeElement,
    belongsToSameFormItem,
    elementLabel,
    isCandidate,
    collectCandidates,
    isRelatedPair,
    intersectionArea,
    describeOverlap,
    collectOverlapIssues,
} satisfies Record<string, (...args: never[]) => unknown>;

/**
 * `page.evaluate` only ships the function it is handed, so the scan travels as
 * source with every helper it calls declared in the same scope.
 */
const OVERLAP_SCAN_SOURCE = Object.entries(PAGE_HELPERS)
    .map(([name, helper]) => `const ${name} = ${helper.toString()};`)
    .join('\n');

/** Runs the overlap scan inside the page. */
const findOverlapIssues = async (page: Page): Promise<OverlapIssue[]> => {
    const script = `(() => {
${OVERLAP_SCAN_SOURCE}
return collectOverlapIssues(${JSON.stringify(FORM_ITEM_SELECTOR)});
})()`;
    return (await page.evaluate(script)) as OverlapIssue[];
};

/**
 * Waits until every CSS transition and animation on the page has finished.
 *
 * antd animates button colours for ~200 ms when a control becomes enabled, and
 * a scan landing inside that window measures the half-faded pair: the room's
 * Reveal control, for one, reads ~1.2:1 mid-transition and 4.6:1 once settled.
 * The state under test is the settled one, and waiting for `getAnimations()`
 * instead of freezing the styles lets antd's own motion lifecycle complete.
 *
 * @param page - The page under test.
 */
const waitForSettledMotion = async (page: Page): Promise<void> => {
    await page.waitForFunction(
        () =>
            !document
                .getAnimations()
                .some(
                    (animation) =>
                        animation instanceof CSSTransition && animation.playState === 'running'
                ),
        undefined,
        { timeout: 5000 }
    );
};

/**
 * Asserts the current page has no axe violations and no overlapping content.
 *
 * @param page - The page under test.
 * @param viewportName - Human readable viewport label used in failure messages.
 * @param state - Which screen is on display, used in failure messages.
 */
const expectCleanLayout = async (page: Page, viewportName: string, state: string) => {
    // A pointer left over a deck card opens its tooltip, which at 320 px floats
    // over the app bar; the state under test is the layout, not the hover card.
    await page.mouse.move(0, 0);
    await waitForSettledMotion(page);
    const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

    expect(
        accessibilityScanResults.violations,
        `Accessibility violations in the ${state} state on ${viewportName}`
    ).toEqual([]);

    const overlapIssues = await findOverlapIssues(page);

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

                // A new room opens on its setup screen: scan that state before
                // staging the first story turns it into a voting room.
                await expect(page.locator('#setup-story-title')).toBeVisible();
                await expect(page.getByRole('button', { name: 'Start Estimating' })).toBeDisabled();
                await expectCleanLayout(page, viewport.name, `${colorMode} setup`);

                await completeSetup(page, ['First User Story']);
                await becomeVoter(page);

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
