import {
    expect,
    type Browser,
    type BrowserContext,
    type Download,
    type Page,
} from '@playwright/test';

/**
 * Default backlog staged by {@link createRoom}.
 *
 * Rooms start with no story, so every existing spec asks for the same single
 * entry to keep its original fixture.
 */
const DEFAULT_SETUP_STORIES = ['First User Story'] as const;

/** Accessible name of the setup action that stages the drafted story, in every shipped locale. */
const ADD_STORY_BUTTON = /^(Add Story|Adicionar história|Añadir historia)$/i;

/** Accessible name of the setup action that starts the room, in every shipped locale. */
const START_SETUP_BUTTON = /^(Start Estimating|Iniciar estimativa|Iniciar estimación)$/i;

/** Accessible name of the navbar spectator switch, in every shipped locale. */
const SPECTATOR_SWITCH = /^(Spectator mode|Modo observador)$/i;

export interface PageOptions {
    /** Flips the creator to a voter before the session is returned. */
    adminVotes?: boolean;
    locale?: string;
    preparePage?: (page: Page) => Promise<void>;
    /** Leaves the room on its setup screen, for specs that drive it themselves. */
    skipSetup?: boolean;
    /** Backlog staged before starting; defaults to one "First User Story" entry. */
    stories?: readonly string[];
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
 * Stages the given stories on the room setup screen and starts the session.
 *
 * The screen is only rendered while the room has no story, so it disappears as
 * soon as the server accepts the staged backlog.
 *
 * @param page - Page showing the setup screen.
 * @param stories - Story titles to stage before starting.
 */
export const completeSetup = async (
    page: Page,
    stories: readonly string[] = DEFAULT_SETUP_STORIES
): Promise<void> => {
    const storyTitle = page.locator('#setup-story-title');
    await expect(storyTitle).toBeVisible();

    // The stories share one input and must be staged in order. Chaining the
    // promises keeps that order without an await inside a loop.
    await stories.reduce<Promise<void>>(
        (previous, story) =>
            previous.then(async () => {
                await storyTitle.fill(story);
                await page.getByRole('button', { name: ADD_STORY_BUTTON }).click();
                await expect(page.getByText(story, { exact: true }).first()).toBeVisible();
            }),
        Promise.resolve()
    );

    await page.getByRole('button', { name: START_SETUP_BUTTON }).click();
    await expect(storyTitle).toBeHidden();
};

/**
 * Flips the current participant to a voter when the room still has them as a
 * spectator.
 *
 * The creator starts observing, so specs that vote as the admin have to leave
 * that state first. The navbar switch is the one control rendered both on the
 * setup screen and in the room.
 *
 * @param page - Page of the participant to convert.
 */
export const becomeVoter = async (page: Page): Promise<void> => {
    const spectatorSwitch = page.getByRole('switch', { name: SPECTATOR_SWITCH });
    await expect(spectatorSwitch).toBeVisible();
    // The creator enters as a spectator, so the box is checked. Waiting for that
    // state first matters after a room broadcast: an early read can see it
    // unchecked, skip the click and leave the deck hidden and Reveal disabled.
    await expect(spectatorSwitch).toBeChecked();
    await spectatorSwitch.click();
    await expect(spectatorSwitch).not.toBeChecked();
};

/**
 * Creates a new planning poker room as admin and extracts the generated room code.
 *
 * Unless `skipSetup` is set, the room is taken through its setup screen with the
 * requested backlog, because a fresh room has no story and therefore no voting
 * panel.
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

        if (!options?.skipSetup) {
            await completeSetup(adminPage, options?.stories ?? DEFAULT_SETUP_STORIES);
        }
        if (options?.adminVotes) {
            await becomeVoter(adminPage);
        }

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
    await Promise.all(
        sessions.map(async (session) => {
            await session?.page?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await session?.context?.close().catch(() => {});
        })
    );
};
