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
import React from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { CardDeck } from '../card-deck/card-deck';
import { ResultsPanel } from '../results-panel/results-panel';

/** Countdown presets offered to the host, in seconds. */
const TIMER_PRESETS: MenuProps['items'] = [
    { key: '30', label: '30 Seconds' },
    { key: '60', label: '1 Minute' },
    { key: '120', label: '2 Minutes' },
    { key: '300', label: '5 Minutes' },
];

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
const formatTimerDisplay = (timer: null | TimerState | undefined): string => {
    if (!timer) {
        return 'Timer: Off';
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
}: VoteActionsArgs): React.ReactNode => {
    if (!votesRevealed) {
        if (!isAdmin) {
            return <Tag>Waiting for Host to reveal</Tag>;
        }

        const allVotedSuffix =
            activeVoterCount > 0 && votedCount === activeVoterCount ? ' (All voted!)' : '';

        return (
            <Button
                disabled={activeVoterCount === 0}
                icon={<EyeOutlined />}
                onClick={onRevealVotes}
                type="primary"
            >
                {`Reveal Votes${allVotedSuffix}`}
            </Button>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <Button icon={<UndoOutlined />} onClick={onResetVotes}>
            Reset Votes (Admin)
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

    if (!roomState) return null;

    const currentStory = roomState.stories[roomState.currentStoryIndex ?? 0];
    const activeVoters = (roomState.participants ?? []).filter((p) => !p.isSpectator && p.isOnline);
    const votedCount = activeVoters.filter((p) => p.hasVoted).length;
    const votingProgress = activeVoters.length > 0 ? (votedCount / activeVoters.length) * 100 : 0;

    const timer = roomState.timer;
    const isTimerRunning = timer?.isRunning === true;

    return (
        <Card style={{ height: '100%' }}>
            <Flex gap={16} vertical>
                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        Estimation
                    </Typography.Title>

                    <Space size={8} wrap>
                        <Tag
                            color={
                                isTimerEnding(timer) ? 'red' : isTimerRunning ? 'blue' : undefined
                            }
                            icon={<ClockCircleOutlined />}
                        >
                            {formatTimerDisplay(timer)}
                        </Tag>

                        {isAdmin &&
                            (timer ? (
                                <Space size={4}>
                                    <Tooltip title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}>
                                        <Button
                                            aria-label="Toggle timer"
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
                                    <Tooltip title="Reset Timer">
                                        <Button
                                            aria-label="Reset timer"
                                            icon={<ReloadOutlined />}
                                            onClick={resetTimer}
                                        />
                                    </Tooltip>
                                </Space>
                            ) : (
                                <Dropdown
                                    menu={{
                                        items: TIMER_PRESETS,
                                        onClick: ({ key }) => startTimer(Number(key)),
                                    }}
                                    trigger={['click']}
                                >
                                    <Button
                                        aria-label="Start timer"
                                        icon={<PlayCircleOutlined />}
                                    />
                                </Dropdown>
                            ))}

                        {roomState.autoReveal && (
                            <Tooltip title="Auto-Reveal is active">
                                <Tag icon={<ThunderboltOutlined />}>Auto-Reveal</Tag>
                            </Tooltip>
                        )}
                    </Space>
                </Flex>

                {roomState.isEnded && (
                    <Alert
                        description="All story estimates have been finalized. You can export the summary from the Backlog."
                        showIcon
                        title="Sprint Planning Estimation Session Ended!"
                        type="success"
                    />
                )}

                <Card size="small" title="Current Story" type="inner">
                    <Typography.Title level={5} style={{ marginTop: 0 }}>
                        {currentStory?.title ?? 'No active story selected'}
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
                        <Typography.Text>Voting Progress</Typography.Text>
                        <Typography.Text type="secondary">
                            {`${votedCount} of ${activeVoters.length} voted (${Math.round(votingProgress)}%)`}
                        </Typography.Text>
                    </Flex>
                    <Progress
                        aria-label="Voting progress"
                        percent={votingProgress}
                        showInfo={false}
                    />
                    <Flex justify="end" wrap>
                        {renderVoteActions({
                            activeVoterCount: activeVoters.length,
                            isAdmin,
                            onResetVotes: resetVotes,
                            onRevealVotes: revealVotes,
                            votedCount,
                            votesRevealed: roomState.votesRevealed,
                        })}
                    </Flex>
                </Flex>
            </Flex>
        </Card>
    );
};
