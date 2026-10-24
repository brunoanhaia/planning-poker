import {
    ClockCircleOutlined,
    EyeOutlined,
    PauseOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    UndoOutlined,
} from '@ant-design/icons';
import { Story, TimerState } from '@planitpoker/shared';
import {
    Alert,
    Badge,
    Button,
    Card,
    Dropdown,
    Flex,
    MenuProps,
    Progress,
    Space,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { Translate } from '../../i18n/i18n-context';
import { useTranslation } from '../../i18n/use-translation';
import { CardDeck } from '../card-deck/card-deck';
import { ResultsPanel } from '../results-panel/results-panel';
import { SessionSummary } from '../session-summary/session-summary';

/** Countdown presets offered to the host, in seconds. */
const TIMER_PRESET_SECONDS = [30, 60, 120, 300] as const;

/** Remaining seconds below which the timer is flagged as about to expire. */
const TIMER_ENDING_THRESHOLD = 10;

interface VoteActionsArgs {
    activeVoterCount: number;
    isAdmin: boolean;
    onResetVotes: () => void;
    onRevealVotes: () => void;
    votedCount: number;
    votesRevealed: boolean;
}

interface TimerControlsArgs {
    isAdmin: boolean;
    isRunning: boolean;
    onPause: () => void;
    onReset: () => void;
    onStart: (duration: number) => void;
    t: Translate;
    timer: null | TimerState;
}

interface VotingProgressArgs {
    activeVoterCount: number;
    isAdmin: boolean;
    onResetVotes: () => void;
    onRevealVotes: () => void;
    progress: number;
    t: Translate;
    votedCount: number;
    votesRevealed: boolean;
}

/** `true` while the countdown is in its final seconds. */
const isTimerEnding = (timer: null | TimerState | undefined): boolean =>
    Boolean(timer && timer.remaining > 0 && timer.remaining <= TIMER_ENDING_THRESHOLD);

/** Formats the remaining time, or a placeholder when the timer is off. */
const formatTimerDisplay = (timer: null | TimerState | undefined, offLabel: string): string => {
    if (!timer) {
        return offLabel;
    }
    const minutes = Math.floor(timer.remaining / 60);
    const seconds = String(timer.remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
};

/** Builds the countdown presets offered by the timer menu. */
const buildTimerPresets = (t: Translate): MenuProps['items'] =>
    TIMER_PRESET_SECONDS.map((seconds) => ({
        key: String(seconds),
        label: t(`estimation.preset.${seconds}` as const),
    }));

/** Renders the countdown badge, marking the final seconds as running out. */
const renderTimerTag = (timer: null | TimerState, t: Translate): React.ReactNode => {
    const display = formatTimerDisplay(timer, t('estimation.timerOff'));
    const isRunning = timer?.isRunning === true;

    if (!isTimerEnding(timer) && !isRunning) {
        return <Tag icon={<ClockCircleOutlined />}>{display}</Tag>;
    }

    return (
        <Tag icon={<ClockCircleOutlined />}>
            <Badge status={isTimerEnding(timer) ? 'error' : 'processing'} text={display} />
        </Tag>
    );
};

/** Renders the host's countdown controls: start (with presets), pause and reset. */
const renderTimerControls = ({
    isAdmin,
    isRunning,
    onPause,
    onReset,
    onStart,
    t,
    timer,
}: TimerControlsArgs): React.ReactNode => {
    if (!isAdmin) {
        return null;
    }

    if (!timer) {
        return (
            <Dropdown
                menu={{
                    items: buildTimerPresets(t),
                    onClick: ({ key }) => onStart(Number(key)),
                }}
                trigger={['click']}
            >
                <Button aria-label={t('estimation.start')} icon={<PlayCircleOutlined />} />
            </Dropdown>
        );
    }

    return (
        <Space size={4}>
            <Tooltip title={isRunning ? t('estimation.pause') : t('estimation.start')}>
                <Button
                    aria-label={t('estimation.toggle')}
                    icon={isRunning ? <PauseOutlined /> : <PlayCircleOutlined />}
                    onClick={isRunning ? onPause : () => onStart(timer.duration)}
                />
            </Tooltip>
            <Tooltip title={t('estimation.resetTimer')}>
                <Button
                    aria-label={t('estimation.resetTimer')}
                    icon={<ReloadOutlined />}
                    onClick={onReset}
                />
            </Tooltip>
        </Space>
    );
};

/** Renders the reveal/reset/waiting affordance for the current voting state. */
const renderVoteActions = ({
    activeVoterCount,
    isAdmin,
    onResetVotes,
    onRevealVotes,
    votedCount,
    votesRevealed,
    t,
}: VoteActionsArgs & { t: Translate }): React.ReactNode => {
    if (!votesRevealed) {
        if (!isAdmin) {
            return <Tag>{t('estimation.waiting')}</Tag>;
        }

        const allVoted = activeVoterCount > 0 && votedCount === activeVoterCount;

        return (
            <Button
                disabled={activeVoterCount === 0}
                icon={<EyeOutlined />}
                onClick={onRevealVotes}
                type="primary"
            >
                {allVoted ? t('estimation.reveal.all') : t('estimation.reveal')}
            </Button>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <Button icon={<UndoOutlined />} onClick={onResetVotes}>
            {t('estimation.resetVotes')}
        </Button>
    );
};

/** Renders the current story and the round it is on. */
const renderStoryCard = (
    story: Story | undefined,
    roundNumber: number,
    t: Translate
): React.ReactNode => (
    <Card
        extra={story && <Tag>{t('estimation.round', { round: roundNumber })}</Tag>}
        size="small"
        title={t('estimation.currentStory')}
        type="inner"
    >
        <Typography.Title level={5} style={{ marginTop: 0 }}>
            {story?.title ?? t('estimation.noStory')}
        </Typography.Title>
        {story?.description && (
            <Typography.Paragraph type="secondary">{story.description}</Typography.Paragraph>
        )}
    </Card>
);

/** Renders the closing banner, with the shortcut to the summary. */
const renderEndedBanner = (onOpenSummary: () => void, t: Translate): React.ReactNode => (
    <Alert
        action={
            <Button onClick={onOpenSummary} size="small">
                {t('estimation.viewSummary')}
            </Button>
        }
        description={t('estimation.ended.desc')}
        showIcon
        title={t('estimation.ended.title')}
        type="success"
    />
);

/** Renders the voting progress and the action the current role can take. */
const renderVotingProgress = ({
    activeVoterCount,
    isAdmin,
    onResetVotes,
    onRevealVotes,
    progress,
    t,
    votedCount,
    votesRevealed,
}: VotingProgressArgs): React.ReactNode => (
    <Flex gap={8} vertical>
        <Flex gap={8} justify="space-between" wrap>
            <Typography.Text>{t('estimation.progress')}</Typography.Text>
            <Typography.Text type="secondary">
                {t('estimation.progress.count', {
                    percent: Math.round(progress),
                    total: activeVoterCount,
                    voted: votedCount,
                })}
            </Typography.Text>
        </Flex>
        <Progress aria-label={t('estimation.progress')} percent={progress} showInfo={false} />
        <Flex justify="end" wrap>
            {renderVoteActions({
                activeVoterCount,
                isAdmin,
                onResetVotes,
                onRevealVotes,
                t,
                votedCount,
                votesRevealed,
            })}
        </Flex>
    </Flex>
);

/**
 * The centre panel: countdown, current story, deck and the reveal controls.
 *
 * Sections stack rather than overlay, and every action row wraps, so the panel
 * keeps its shape as the timer labels and vote counters grow. Each section is a
 * render helper so the component itself stays a readable composition.
 */
export const EstimationPanel: React.FC = () => {
    const { isAdmin, pauseTimer, resetTimer, resetVotes, revealVotes, roomState, startTimer } =
        useSocket();
    const { t } = useTranslation();

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const lastOpenedEndRef = useRef<null | number>(null);

    // The summary opens once per session end: a second render of the same ended
    // room must not reopen a dialog the facilitator has already dismissed.
    useEffect(() => {
        const endedAt = roomState?.endedAt ?? null;
        if (endedAt !== null && lastOpenedEndRef.current !== endedAt) {
            lastOpenedEndRef.current = endedAt;
            setIsSummaryOpen(true);
        }
    }, [roomState?.endedAt]);

    if (!roomState) {
        return null;
    }

    const currentStory = roomState.stories[roomState.currentStoryIndex ?? 0];
    const activeVoters = (roomState.participants ?? []).filter((p) => !p.isSpectator && p.isOnline);
    const votedCount = activeVoters.filter((p) => p.hasVoted).length;
    const votingProgress = activeVoters.length > 0 ? (votedCount / activeVoters.length) * 100 : 0;
    const roundNumber = (currentStory?.rounds.length ?? 0) + Number(!roomState.votesRevealed);

    return (
        <>
            <Card style={{ height: '100%' }}>
                <Flex gap={16} vertical>
                    <Flex align="center" gap={8} justify="space-between" wrap>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                            {t('estimation.title')}
                        </Typography.Title>

                        <Space size={8} wrap>
                            {renderTimerTag(roomState.timer, t)}
                            {renderTimerControls({
                                isAdmin,
                                isRunning: roomState.timer?.isRunning === true,
                                onPause: pauseTimer,
                                onReset: resetTimer,
                                onStart: startTimer,
                                t,
                                timer: roomState.timer,
                            })}
                            {roomState.autoReveal && (
                                <Tooltip title={t('estimation.autoReveal.hint')}>
                                    <Tag icon={<ThunderboltOutlined />}>
                                        {t('estimation.autoReveal')}
                                    </Tag>
                                </Tooltip>
                            )}
                        </Space>
                    </Flex>

                    {roomState.isEnded && renderEndedBanner(() => setIsSummaryOpen(true), t)}

                    {renderStoryCard(currentStory, roundNumber, t)}

                    {roomState.votesRevealed ? <ResultsPanel /> : <CardDeck />}

                    {renderVotingProgress({
                        activeVoterCount: activeVoters.length,
                        isAdmin,
                        onResetVotes: resetVotes,
                        onRevealVotes: revealVotes,
                        progress: votingProgress,
                        t,
                        votedCount,
                        votesRevealed: roomState.votesRevealed,
                    })}
                </Flex>
            </Card>

            <SessionSummary onClose={() => setIsSummaryOpen(false)} open={isSummaryOpen} />
        </>
    );
};
