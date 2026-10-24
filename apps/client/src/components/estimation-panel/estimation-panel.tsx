import {
    ClockCircleOutlined,
    EyeOutlined,
    PauseOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    UndoOutlined,
} from '@ant-design/icons';
import { TimerState } from '@planitpoker/shared';
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

/**
 * The centre panel: countdown, current story, deck and the reveal controls.
 *
 * Sections stack rather than overlay, and every action row wraps, so the panel
 * keeps its shape as the timer labels and vote counters grow.
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

    if (!roomState) return null;

    const currentStory = roomState.stories[roomState.currentStoryIndex ?? 0];
    const activeVoters = (roomState.participants ?? []).filter((p) => !p.isSpectator && p.isOnline);
    const votedCount = activeVoters.filter((p) => p.hasVoted).length;
    const votingProgress = activeVoters.length > 0 ? (votedCount / activeVoters.length) * 100 : 0;

    const timer = roomState.timer;
    const isTimerRunning = timer?.isRunning === true;
    const roundNumber = (currentStory?.rounds.length ?? 0) + (roomState.votesRevealed ? 0 : 1);

    const timerPresets: MenuProps['items'] = TIMER_PRESET_SECONDS.map((seconds) => ({
        key: String(seconds),
        label: t(`estimation.preset.${seconds}` as const),
    }));

    return (
        <>
            <Card style={{ height: '100%' }}>
                <Flex gap={16} vertical>
                    <Flex align="center" gap={8} justify="space-between" wrap>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                            {t('estimation.title')}
                        </Typography.Title>

                        <Space size={8} wrap>
                            <Tag icon={<ClockCircleOutlined />}>
                                {isTimerEnding(timer) || timer?.isRunning === true ? (
                                    <Badge
                                        status={isTimerEnding(timer) ? 'error' : 'processing'}
                                        text={formatTimerDisplay(timer, t('estimation.timerOff'))}
                                    />
                                ) : (
                                    formatTimerDisplay(timer, t('estimation.timerOff'))
                                )}
                            </Tag>

                            {isAdmin &&
                                (timer ? (
                                    <Space size={4}>
                                        <Tooltip
                                            title={
                                                isTimerRunning
                                                    ? t('estimation.pause')
                                                    : t('estimation.start')
                                            }
                                        >
                                            <Button
                                                aria-label={t('estimation.toggle')}
                                                icon={
                                                    isTimerRunning ? (
                                                        <PauseOutlined />
                                                    ) : (
                                                        <PlayCircleOutlined />
                                                    )
                                                }
                                                onClick={
                                                    isTimerRunning
                                                        ? pauseTimer
                                                        : () => startTimer(timer.duration)
                                                }
                                            />
                                        </Tooltip>
                                        <Tooltip title={t('estimation.resetTimer')}>
                                            <Button
                                                aria-label={t('estimation.resetTimer')}
                                                icon={<ReloadOutlined />}
                                                onClick={resetTimer}
                                            />
                                        </Tooltip>
                                    </Space>
                                ) : (
                                    <Dropdown
                                        menu={{
                                            items: timerPresets,
                                            onClick: ({ key }) => startTimer(Number(key)),
                                        }}
                                        trigger={['click']}
                                    >
                                        <Button
                                            aria-label={t('estimation.start')}
                                            icon={<PlayCircleOutlined />}
                                        />
                                    </Dropdown>
                                ))}

                            {roomState.autoReveal && (
                                <Tooltip title={t('estimation.autoReveal.hint')}>
                                    <Tag icon={<ThunderboltOutlined />}>
                                        {t('estimation.autoReveal')}
                                    </Tag>
                                </Tooltip>
                            )}
                        </Space>
                    </Flex>

                    {roomState.isEnded && (
                        <Alert
                            action={
                                <Button onClick={() => setIsSummaryOpen(true)} size="small">
                                    {t('estimation.viewSummary')}
                                </Button>
                            }
                            description={t('estimation.ended.desc')}
                            showIcon
                            title={t('estimation.ended.title')}
                            type="success"
                        />
                    )}

                    <Card
                        extra={
                            currentStory ? (
                                <Tag>{t('estimation.round', { round: roundNumber })}</Tag>
                            ) : undefined
                        }
                        size="small"
                        title={t('estimation.currentStory')}
                        type="inner"
                    >
                        <Typography.Title level={5} style={{ marginTop: 0 }}>
                            {currentStory?.title ?? t('estimation.noStory')}
                        </Typography.Title>
                        {currentStory?.description && (
                            <Typography.Paragraph type="secondary">
                                {currentStory.description}
                            </Typography.Paragraph>
                        )}
                    </Card>

                    {roomState.votesRevealed ? <ResultsPanel /> : <CardDeck />}

                    <Flex gap={8} vertical>
                        <Flex gap={8} justify="space-between" wrap>
                            <Typography.Text>{t('estimation.progress')}</Typography.Text>
                            <Typography.Text type="secondary">
                                {t('estimation.progress.count', {
                                    percent: Math.round(votingProgress),
                                    total: activeVoters.length,
                                    voted: votedCount,
                                })}
                            </Typography.Text>
                        </Flex>
                        <Progress
                            aria-label={t('estimation.progress')}
                            percent={votingProgress}
                            showInfo={false}
                        />
                        <Flex justify="end" wrap>
                            {renderVoteActions({
                                activeVoterCount: activeVoters.length,
                                isAdmin,
                                onResetVotes: resetVotes,
                                onRevealVotes: revealVotes,
                                t,
                                votedCount,
                                votesRevealed: roomState.votesRevealed,
                            })}
                        </Flex>
                    </Flex>
                </Flex>
            </Card>

            <SessionSummary onClose={() => setIsSummaryOpen(false)} open={isSummaryOpen} />
        </>
    );
};
