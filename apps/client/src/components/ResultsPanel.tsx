import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    LinearProgress,
    Paper,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';
import { useEstimationStats } from '../hooks/useEstimationStats';

export const ResultsPanel: React.FC = () => {
    const { isAdmin, roomState, setCurrentStory, updateStoryEstimate } = useSocket();

    const [isManualEditOpen, setIsManualEditOpen] = useState(false);
    const [manualScore, setManualScore] = useState('');
    const [allStoriesCompletedNotice, setAllStoriesCompletedNotice] = useState(false);

    const [confirmNextStoryOpen, setConfirmNextStoryOpen] = useState(false);
    const [pendingEstimate, setPendingEstimate] = useState<number | string | undefined>(undefined);

    const {
        average,
        consensusPercentage,
        hasNumeric,
        isFullConsensus,
        modeVote,
        totalVotes,
        voteCounts,
        votedParticipants,
    } = useEstimationStats(roomState);
    const currentStory = roomState?.stories[roomState?.currentStoryIndex ?? 0];

    if (!roomState?.votesRevealed) {
        return null;
    }

    if (votedParticipants.length === 0) {
        return (
            <Paper sx={{ borderRadius: '20px', my: 2, p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body1">
                    No votes were cast for this story yet.
                </Typography>
            </Paper>
        );
    }

    const computeFinalEstimate = (customEstimate?: number | string): number | string => {
        if (customEstimate !== undefined && customEstimate !== '') {
            const parsedNum = Number(customEstimate);
            return !Number.isNaN(parsedNum) ? parsedNum : customEstimate;
        }
        return hasNumeric ? Number(average) : modeVote;
    };

    const promptSaveEstimate = (customEstimate?: number | string) => {
        setPendingEstimate(customEstimate);
        setConfirmNextStoryOpen(true);
    };

    const confirmSaveEstimate = () => {
        if (!currentStory || !isAdmin || !roomState) {
            return;
        }

        const finalVal = computeFinalEstimate(pendingEstimate);
        updateStoryEstimate(currentStory.id, finalVal);

        const nextIndex = roomState.currentStoryIndex + 1;
        if (nextIndex < roomState.stories.length) {
            setCurrentStory(nextIndex);
        } else {
            setAllStoriesCompletedNotice(true);
        }

        setConfirmNextStoryOpen(false);
        setIsManualEditOpen(false);
    };

    return (
        <>
            <Paper
                elevation={8}
                sx={{
                    background: (theme) =>
                        theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    borderRadius: '24px',
                    my: 3,
                    p: { sm: 4, xs: 2.5 },
                }}
            >
                <Box
                    sx={{
                        alignItems: 'center',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        justifyContent: 'space-between',
                        mb: 3,
                    }}
                >
                    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
                        <Typography sx={{ fontWeight: 800 }} variant="h5">
                            Estimation Results
                        </Typography>
                        {isFullConsensus && (
                            <Chip
                                color="success"
                                icon={<CheckCircleIcon />}
                                label="100% Consensus 🎉"
                                sx={{ fontWeight: 700 }}
                            />
                        )}
                    </Box>

                    {currentStory && isAdmin && (
                        <Box
                            sx={{
                                alignItems: 'center',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1.5,
                            }}
                        >
                            <Button
                                color="primary"
                                onClick={() => {
                                    setManualScore(hasNumeric ? String(average) : String(modeVote));
                                    setIsManualEditOpen(true);
                                }}
                                startIcon={<EditIcon />}
                                sx={{ borderRadius: '12px', fontWeight: 700 }}
                                variant="outlined"
                            >
                                Custom Score
                            </Button>
                            <Button
                                color="success"
                                onClick={() => promptSaveEstimate()}
                                startIcon={<SaveIcon />}
                                sx={{ borderRadius: '12px', fontWeight: 700 }}
                                variant="contained"
                            >
                                Accept {hasNumeric ? `Avg (${average})` : `Mode (${modeVote})`}
                            </Button>
                        </Box>
                    )}
                </Box>

                <Grid container spacing={{ sm: 3, xs: 1.5 }} sx={{ mb: { sm: 4, xs: 2.5 } }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Box
                            sx={{
                                bgcolor: 'action.hover',
                                borderRadius: '16px',
                                p: { sm: 2, xs: 1.5 },
                                textAlign: 'center',
                            }}
                        >
                            <Typography
                                color="text.secondary"
                                sx={{ fontWeight: 700, fontSize: { xs: '10px', sm: '12px' } }}
                                variant="caption"
                            >
                                AVERAGE
                            </Typography>
                            <Typography
                                color="primary.main"
                                sx={{
                                    fontWeight: 800,
                                    mt: 0.5,
                                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                                }}
                                variant="h4"
                            >
                                {average}
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Box
                            sx={{
                                bgcolor: 'action.hover',
                                borderRadius: '16px',
                                p: { sm: 2, xs: 1.5 },
                                textAlign: 'center',
                            }}
                        >
                            <Typography
                                color="text.secondary"
                                sx={{ fontWeight: 700, fontSize: { xs: '10px', sm: '12px' } }}
                                variant="caption"
                            >
                                CONSENSUS
                            </Typography>
                            <Typography
                                color="secondary.main"
                                sx={{
                                    fontWeight: 800,
                                    mt: 0.5,
                                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                                }}
                                variant="h4"
                            >
                                {consensusPercentage}%
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Box
                            sx={{
                                bgcolor: 'action.hover',
                                borderRadius: '16px',
                                p: { sm: 2, xs: 1.5 },
                                textAlign: 'center',
                            }}
                        >
                            <Typography
                                color="text.secondary"
                                sx={{ fontWeight: 700, fontSize: { xs: '10px', sm: '12px' } }}
                                variant="caption"
                            >
                                TOP VOTE
                            </Typography>
                            <Typography
                                color="info.main"
                                sx={{
                                    fontWeight: 800,
                                    mt: 0.5,
                                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                                }}
                                variant="h4"
                            >
                                {modeVote}
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Box
                            sx={{
                                bgcolor: 'action.hover',
                                borderRadius: '16px',
                                p: { sm: 2, xs: 1.5 },
                                textAlign: 'center',
                            }}
                        >
                            <Typography
                                color="text.secondary"
                                sx={{ fontWeight: 700, fontSize: { xs: '10px', sm: '12px' } }}
                                variant="caption"
                            >
                                VOTERS
                            </Typography>
                            <Typography
                                color="text.primary"
                                sx={{
                                    fontWeight: 800,
                                    mt: 0.5,
                                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                                }}
                                variant="h4"
                            >
                                {totalVotes}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                <Typography sx={{ fontWeight: 700, mb: 2 }} variant="subtitle2">
                    Vote Distribution Breakdown
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Object.entries(voteCounts).map(([vote, count]) => {
                        const pct = Math.round((count / totalVotes) * 100);
                        return (
                            <Box key={vote} sx={{ alignItems: 'center', display: 'flex', gap: 2 }}>
                                <Paper
                                    sx={{
                                        alignItems: 'center',
                                        bgcolor: 'primary.main',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        display: 'flex',
                                        fontWeight: 800,
                                        height: 40,
                                        justifyContent: 'center',
                                        width: 40,
                                    }}
                                >
                                    {vote}
                                </Paper>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            mb: 0.5,
                                        }}
                                    >
                                        <Typography sx={{ fontWeight: 700 }} variant="body2">
                                            {count} {count === 1 ? 'vote' : 'votes'}
                                        </Typography>
                                        <Typography
                                            color="text.secondary"
                                            sx={{ fontWeight: 600 }}
                                            variant="body2"
                                        >
                                            {pct}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        sx={{
                                            backgroundColor: 'action.hover',
                                            borderRadius: 5,
                                            height: 10,
                                            '& .MuiLinearProgress-bar': {
                                                background:
                                                    'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)',
                                                borderRadius: 5,
                                            },
                                        }}
                                        value={pct}
                                        variant="determinate"
                                    />
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Paper>

            {/* Custom Score Dialog */}
            <Dialog
                fullWidth
                maxWidth="xs"
                onClose={() => setIsManualEditOpen(false)}
                open={isManualEditOpen}
                slotProps={{ paper: { sx: { borderRadius: '20px', p: 1 } } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ Set Custom Story Score</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                        Enter a custom estimate for <strong>{currentStory?.title}</strong> or pick
                        from the deck options:
                    </Typography>

                    <TextField
                        autoFocus
                        fullWidth
                        label="Estimate / Story Points"
                        onChange={(e) => setManualScore(e.target.value)}
                        placeholder="e.g. 3, 5, 8, M, etc."
                        sx={{ mb: 2 }}
                        value={manualScore}
                    />

                    {roomState?.activeDeck && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {roomState.activeDeck.map((val) => (
                                <Chip
                                    clickable
                                    color={manualScore === String(val) ? 'primary' : 'default'}
                                    key={String(val)}
                                    label={val}
                                    onClick={() => setManualScore(String(val))}
                                    sx={{ fontWeight: 700 }}
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: 2, px: 3, justifyContent: 'space-between' }}>
                    <Button
                        color="error"
                        onClick={() => {
                            if (currentStory) {
                                updateStoryEstimate(currentStory.id, null);
                                setIsManualEditOpen(false);
                            }
                        }}
                    >
                        Reset
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={() => setIsManualEditOpen(false)}>Cancel</Button>
                        <Button
                            disabled={!manualScore.trim()}
                            onClick={() => promptSaveEstimate(manualScore.trim())}
                            sx={{ fontWeight: 700 }}
                            variant="contained"
                        >
                            Save & Next
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>

            {/* Confirm Next Story Dialog */}
            <Dialog
                fullWidth
                maxWidth="xs"
                onClose={() => setConfirmNextStoryOpen(false)}
                open={confirmNextStoryOpen}
                slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Confirm Story Change</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Are you sure you want to save this estimate and advance to the next story?
                        This will affect all participants and reset the timer.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ pb: 2, px: 3 }}>
                    <Button onClick={() => setConfirmNextStoryOpen(false)}>Cancel</Button>
                    <Button color="primary" onClick={confirmSaveEstimate} variant="contained">
                        Save & Advance
                    </Button>
                </DialogActions>
            </Dialog>

            {/* All Stories Completed Notification */}
            <Snackbar
                anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
                autoHideDuration={6000}
                onClose={() => setAllStoriesCompletedNotice(false)}
                open={allStoriesCompletedNotice}
            >
                <Alert
                    onClose={() => setAllStoriesCompletedNotice(false)}
                    severity="success"
                    sx={{ borderRadius: '16px', fontWeight: 700, width: '100%' }}
                    variant="filled"
                >
                    🎉 All stories in the backlog have been estimated!
                </Alert>
            </Snackbar>
        </>
    );
};
