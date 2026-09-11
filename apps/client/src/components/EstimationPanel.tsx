import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import StyleIcon from '@mui/icons-material/Style';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
    Box,
    Button,
    Chip,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material';
import { Story, TimerState } from '@planitpoker/shared';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';
import { CardDeck } from './CardDeck';
import { ResultsPanel } from './ResultsPanel';

interface VoteActionsArgs {
    activeVoterCount: number;
    isAdmin: boolean;
    onResetVotes: () => void;
    onRevealVotes: () => void;
    votedCount: number;
    votesRevealed: boolean;
}

/**
 * Checks whether the countdown timer is in its final seconds.
 */
const isTimerEnding = (timer: TimerState | null | undefined): boolean => {
    if (!timer) {
        return false;
    }
    return timer.remaining <= 10 && timer.remaining > 0;
};

/**
 * Resolves the timer badge background for its current state.
 */
const getTimerBackground = (timerEnding: boolean, isRunning: boolean): string => {
    if (timerEnding) {
        return 'error.dark';
    }
    if (isRunning) {
        return 'action.selected';
    }
    return 'background.default';
};

/**
 * Resolves the timer badge text color for its current state.
 */
const getTimerTextColor = (timerEnding: boolean): string => {
    if (timerEnding) {
        return '#fff';
    }
    return 'text.primary';
};

/**
 * Resolves the timer icon color for its current state.
 */
const getTimerIconColor = (
    timerEnding: boolean,
    isRunning: boolean
): 'action' | 'inherit' | 'primary' => {
    if (timerEnding) {
        return 'inherit';
    }
    if (isRunning) {
        return 'primary';
    }
    return 'action';
};

/**
 * Resolves the timer control tooltip for its current state.
 */
const getTimerTooltip = (isRunning: boolean): string => {
    if (isRunning) {
        return 'Pause Timer';
    }
    return 'Start Timer';
};

/**
 * Formats the remaining time, or a placeholder when the timer is off.
 */
const formatTimerDisplay = (timer: TimerState | null | undefined): string => {
    if (!timer) {
        return 'Timer: Off';
    }
    return `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, '0')}`;
};

/**
 * Resolves the paper elevation for the timer badge.
 */
const getTimerElevation = (timer: TimerState | null | undefined): number => {
    if (timer?.isRunning) {
        return 2;
    }
    return 0;
};

/**
 * Renders the play/pause icon matching the timer state.
 */
const renderTimerIcon = (isRunning: boolean): React.ReactNode => {
    if (isRunning) {
        return <PauseIcon fontSize="small" />;
    }
    return <PlayArrowIcon fontSize="small" />;
};

/**
 * Resolves the current story heading, with a fallback when none is active.
 */
const getCurrentStoryTitle = (story: Story | undefined): string => {
    if (!story) {
        return 'No active story selected';
    }
    return story.title;
};

/**
 * Renders the voting deck or the results, depending on the reveal state.
 */
const renderEstimationContent = (votesRevealed: boolean): React.ReactNode => {
    if (votesRevealed) {
        return <ResultsPanel />;
    }
    return <CardDeck />;
};

/**
 * Resolves the reveal-button suffix shown once every voter has voted.
 */
const getAllVotedSuffix = (votedCount: number, activeVoterCount: number): string => {
    if (votedCount === activeVoterCount && activeVoterCount > 0) {
        return '(All voted!)';
    }
    return '';
};

/**
 * Renders the reveal/reset/waiting actions for the current voting state.
 */
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
            return (
                <Chip
                    icon={<VisibilityIcon />}
                    label="Waiting for Host to reveal"
                    sx={{ fontWeight: 700, py: 2, px: 1 }}
                />
            );
        }
        return (
            <Button
                color="primary"
                disabled={activeVoterCount === 0}
                onClick={onRevealVotes}
                startIcon={<VisibilityIcon />}
                sx={{
                    borderRadius: '24px',
                    fontWeight: 800,
                    px: 4,
                    py: 1,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
                variant="contained"
            >
                Reveal Votes {getAllVotedSuffix(votedCount, activeVoterCount)}
            </Button>
        );
    }
    if (!isAdmin) {
        return null;
    }
    return (
        <Button
            color="secondary"
            onClick={onResetVotes}
            startIcon={<RefreshIcon />}
            sx={{
                borderRadius: '24px',
                fontWeight: 800,
                px: 4,
                py: 1,
            }}
            variant="outlined"
        >
            Reset Votes (Admin)
        </Button>
    );
};

export const EstimationPanel: React.FC = () => {
    const { isAdmin, pauseTimer, resetTimer, resetVotes, revealVotes, roomState, startTimer } =
        useSocket();

    const [timerMenuAnchor, setTimerMenuAnchor] = useState<null | HTMLElement>(null);

    if (!roomState) return null;

    const currentStory = roomState.stories[roomState.currentStoryIndex ?? 0];
    const participants = roomState.participants ?? [];

    const activeVoters = participants.filter((p) => !p.isSpectator && p.isOnline);
    const votedCount = activeVoters.filter((p) => p.hasVoted).length;
    const votingProgress = activeVoters.length > 0 ? (votedCount / activeVoters.length) * 100 : 0;

    const timer = roomState.timer;
    const timerEnding = isTimerEnding(timer);
    const isTimerRunning = timer?.isRunning === true;

    const handleOpenTimerMenu = (event: React.MouseEvent<HTMLElement>) => {
        setTimerMenuAnchor(event.currentTarget);
    };

    const handleStartTimerPreset = (duration: number) => {
        startTimer(duration);
        setTimerMenuAnchor(null);
    };

    return (
        <Paper
            elevation={1}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                p: { xs: 2, sm: 3 },
                borderRadius: '16px',
                width: '100%',
                minHeight: '400px',
            }}
        >
            {/* Header: Title and Timer/AutoReveal */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                    flexWrap: 'wrap',
                    gap: 2,
                }}
            >
                <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    <AddBoxIcon color="primary" /> Estimation
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {/* Synchronized Countdown Timer */}
                    <Paper
                        elevation={getTimerElevation(timer)}
                        sx={{
                            alignItems: 'center',
                            bgcolor: getTimerBackground(timerEnding, isTimerRunning),
                            borderRadius: '16px',
                            color: getTimerTextColor(timerEnding),
                            display: 'flex',
                            gap: 1,
                            px: 1.5,
                            py: 0.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <AccessTimeIcon
                            color={getTimerIconColor(timerEnding, isTimerRunning)}
                            fontSize="small"
                        />
                        <Typography
                            sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}
                            variant="body2"
                        >
                            {formatTimerDisplay(timer)}
                        </Typography>

                        {isAdmin && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Tooltip title={getTimerTooltip(isTimerRunning)}>
                                    <IconButton
                                        color="inherit"
                                        onClick={timer ? pauseTimer : handleOpenTimerMenu}
                                        size="small"
                                        sx={{ p: 0.5 }}
                                    >
                                        {renderTimerIcon(isTimerRunning)}
                                    </IconButton>
                                </Tooltip>
                                {timer && (
                                    <Tooltip title="Reset Timer">
                                        <IconButton
                                            color="inherit"
                                            onClick={resetTimer}
                                            size="small"
                                            sx={{ p: 0.5 }}
                                        >
                                            <RefreshIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        )}
                    </Paper>

                    {roomState.autoReveal && (
                        <Tooltip title="Auto-Reveal is active">
                            <Chip
                                color="info"
                                icon={<AutoModeIcon sx={{ fontSize: 16 }} />}
                                label="Auto-Reveal"
                                size="small"
                                sx={{ fontWeight: 700 }}
                            />
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* Session Ended Banner */}
            {roomState.isEnded && (
                <Paper
                    sx={{
                        bgcolor: 'success.dark',
                        borderRadius: '12px',
                        color: '#fff',
                        mb: 3,
                        p: 2,
                        textAlign: 'center',
                    }}
                >
                    <Typography sx={{ fontWeight: 800 }} variant="subtitle1">
                        🎉 Sprint Planning Estimation Session Ended!
                    </Typography>
                    <Typography variant="body2">
                        All story estimates have been finalized. You can export the summary from the
                        Backlog.
                    </Typography>
                </Paper>
            )}

            {/* Current Story Card */}
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: '12px',
                    bgcolor: 'background.default',
                    borderColor: 'divider',
                }}
            >
                <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                >
                    <StyleIcon fontSize="small" /> Current Story
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                    {getCurrentStoryTitle(currentStory)}
                </Typography>
                {currentStory?.description && (
                    <Typography
                        color="text.secondary"
                        variant="body2"
                        sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
                    >
                        {currentStory.description}
                    </Typography>
                )}
            </Paper>

            {/* Deck or Results */}
            <Box
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                }}
            >
                {renderEstimationContent(roomState.votesRevealed)}
            </Box>

            {/* Voting Progress & Actions */}
            <Box sx={{ width: '100%', mt: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Voting Progress
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {votedCount} of {activeVoters.length} voted ({Math.round(votingProgress)}%)
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={votingProgress}
                    sx={{ height: 8, borderRadius: 4, mb: 3 }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    {renderVoteActions({
                        activeVoterCount: activeVoters.length,
                        isAdmin,
                        onResetVotes: resetVotes,
                        onRevealVotes: revealVotes,
                        votedCount,
                        votesRevealed: roomState.votesRevealed,
                    })}
                </Box>
            </Box>

            <Menu
                anchorEl={timerMenuAnchor}
                onClose={() => setTimerMenuAnchor(null)}
                open={Boolean(timerMenuAnchor)}
            >
                <MenuItem onClick={() => handleStartTimerPreset(30)}>30 Seconds</MenuItem>
                <MenuItem onClick={() => handleStartTimerPreset(60)}>1 Minute</MenuItem>
                <MenuItem onClick={() => handleStartTimerPreset(120)}>2 Minutes</MenuItem>
                <MenuItem onClick={() => handleStartTimerPreset(300)}>5 Minutes</MenuItem>
            </Menu>
        </Paper>
    );
};
