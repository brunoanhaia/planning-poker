import {
    expect,
    type Browser,
    type BrowserContext,
    type Download,
    type Page,
} from '@playwright/test';

export interface PageOptions {
    locale?: string;
    preparePage?: (page: Page) => Promise<void>;
    viewport?: { height: number; width: number };
}

export interface RoomSession {
    adminContext: BrowserContext;
    adminPage: Page;
    roomCode: string;
}

export interface VoterSession {
    voterContext: BrowserContext;
    voterPage: Page;
}

export interface OpenSession {
    context?: BrowserContext;
    page?: Page;
}

/**
 * Creates a new planning poker room as admin and extracts the generated room code.
 */
export const createRoom = async (
    browser: Browser,
    adminName = 'Admin',
    sessionTitle?: string,
    options?: PageOptions
): Promise<RoomSession> => {
    const adminContext = await browser.newContext({
        locale: options?.locale ?? 'en-US',
        viewport: options?.viewport,
    });
    try {
        const adminPage = await adminContext.newPage();
        if (options?.preparePage) {
            await options.preparePage(adminPage);
        }
        await adminPage.goto('/');

        await adminPage.locator('#profile-display-name').fill(adminName);
        if (sessionTitle) {
            await adminPage.locator('#create-session-title').fill(sessionTitle);
        }
        await adminPage
            .getByRole('button', {
                name: /Start Session & Generate Room Code|Iniciar Sessão e Gerar Código da Sala/i,
            })
            .click();

        // The room badge is translated, so it is matched by shape rather than copy.
        const roomBadge = adminPage.getByText(/^(Room|Sala): /i).first();
        await expect(roomBadge).toBeVisible();
        const badgeText = await roomBadge.innerText();
        const roomCode = badgeText.replace(/^(Room|Sala):\s*/i, '').trim();

        return { adminContext, adminPage, roomCode };
    } catch (error) {
        // A caller only receives the context on success, so a failed setup must
        // not leave a live context behind for the rest of the worker.
        await adminContext.close();
        throw error;
    }
};

/**
 * Joins an existing planning poker room in a separate browser context.
 */
export const joinRoom = async (
    browser: Browser,
    roomCode: string,
    voterName = 'Voter 1',
    options?: PageOptions
): Promise<VoterSession> => {
    const voterContext = await browser.newContext({
        locale: options?.locale ?? 'en-US',
        viewport: options?.viewport,
    });
    try {
        const voterPage = await voterContext.newPage();
        if (options?.preparePage) {
            await options.preparePage(voterPage);
        }
        await voterPage.goto('/');

        await voterPage.getByRole('tab', { name: /Join Session|Entrar na Sessão/i }).click();
        await voterPage.locator('#join-session-room-code').fill(roomCode);
        await voterPage.locator('#profile-display-name').fill(voterName);
        await voterPage
            .getByRole('button', { name: /Join Room Now|Entrar na Sala Agora/i })
            .click();

        await expect(voterPage.getByText(voterName)).toBeVisible({ timeout: 10000 });
        return { voterContext, voterPage };
    } catch (error) {
        await voterContext.close();
        throw error;
    }
};

/**
 * Casts a vote by selecting a card from the estimation deck and asserts its active state.
 */
export const castVote = async (page: Page, cardValue: number | string): Promise<void> => {
    const card = page.getByRole('button', { name: `Select estimate ${cardValue}`, exact: true });
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
};

/**
 * Ends the planning session via the Room Settings modal and popconfirm dialog.
 */
export const endSessionViaSettings = async (adminPage: Page): Promise<void> => {
    await adminPage.getByRole('button', { name: /Room Settings/i }).click();
    const settingsModal = adminPage.getByRole('dialog', { name: /Room & Session Settings/i });
    await expect(settingsModal).toBeVisible();

    await settingsModal.getByRole('button', { name: /End Planning Session/i }).click();
    await adminPage.getByRole('button', { name: /^End Session$/i }).click();
    await expect(settingsModal).toBeHidden();
};

/**
 * Streams the content of a Playwright Download object into a UTF-8 string.
 */
export const readDownloadContent = async (download: Download): Promise<string> => {
    const stream = await download.createReadStream();
    if (!stream) {
        throw new Error('Download stream is null');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
};

/** Unroutes every intercepted socket, then closes the contexts it was given. */
export const closeSessions = async (
    sessions: readonly (OpenSession | undefined)[]
): Promise<void> => {
    for (const session of sessions) {
        await session?.page?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
        await session?.context?.close().catch(() => {});
    }
};
