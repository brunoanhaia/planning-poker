import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { DeckType, PRESET_DECKS } from '@planitpoker/shared';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface RoomSettingsModalProps {
    onClose: () => void;
    open: boolean;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({ onClose, open }) => {
    const {
        changeDeck,
        endSession,
        isAdmin,
        roomState,
        toggleAutoReveal,
        toggleLockRoom,
        updateRoomTitle,
    } = useSocket();

    const [title, setTitle] = useState(roomState?.title || '');
    const [deckType, setDeckType] = useState<DeckType>(roomState?.deckType || 'fibonacci');
    const [customDeckStr, setCustomDeckStr] = useState<string>(
        roomState?.customDeck ? roomState.customDeck.join(', ') : '1, 2, 3, 5, 8'
    );

    if (!roomState || !isAdmin) return null;

    const handleSave = () => {
        if (title.trim() && title.trim() !== roomState.title) {
            updateRoomTitle(title.trim());
        }

        if (deckType === 'custom') {
            const parsed = customDeckStr
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => (!isNaN(Number(s)) ? Number(s) : s));

            changeDeck('custom', parsed.length > 0 ? parsed : [1, 2, 3, 5, 8]);
        } else {
            changeDeck(deckType);
        }
        onClose();
    };

    const handleEndPlanning = () => {
        if (window.confirm('Are you sure you want to end this planning estimation session?')) {
            endSession();
            onClose();
        }
    };

    return (
        <Dialog
            fullWidth
            maxWidth="xs"
            onClose={onClose}
            open={open}
            PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>👑 Room & Session Settings</DialogTitle>
            <DialogContent>
                <Typography color="text.secondary" sx={{ mb: 2.5 }} variant="body2">
                    Configure room settings, deck rules, and session status.
                </Typography>

                {/* Room Title */}
                <TextField
                    fullWidth
                    label="Room / Sprint Title"
                    onChange={(e) => setTitle(e.target.value)}
                    sx={{ mb: 2.5 }}
                    value={title}
                />

                {/* Estimation Deck */}
                <FormControl fullWidth sx={{ mb: 2.5 }}>
                    <InputLabel>Estimation Deck Type</InputLabel>
                    <Select
                        label="Estimation Deck Type"
                        onChange={(e) => setDeckType(e.target.value as DeckType)}
                        value={deckType}
                    >
                        <MenuItem value="fibonacci">Fibonacci (1, 2, 3, 5, 8, 13, 21...)</MenuItem>
                        <MenuItem value="modified_fibonacci">
                            Modified Fibonacci (0, 0.5, 1, 2, 3, 5...)
                        </MenuItem>
                        <MenuItem value="tshirt">T-Shirt Sizes (XS, S, M, L, XL, XXL)</MenuItem>
                        <MenuItem value="powers_of_2">Powers of 2 (1, 2, 4, 8, 16, 32...)</MenuItem>
                        <MenuItem value="custom">Custom Deck</MenuItem>
                    </Select>
                </FormControl>

                {deckType === 'custom' ? (
                    <TextField
                        fullWidth
                        helperText="Enter values separated by commas"
                        label="Comma-Separated Custom Cards"
                        onChange={(e) => setCustomDeckStr(e.target.value)}
                        placeholder="e.g. 1, 2, 3, 5, 8, 10, ?, ☕"
                        sx={{ mb: 2 }}
                        value={customDeckStr}
                    />
                ) : (
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: '12px', mb: 2.5, p: 2 }}>
                        <Typography
                            color="text.secondary"
                            sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}
                            variant="caption"
                        >
                            Selected Cards Preview:
                        </Typography>
                        <Typography sx={{ color: 'primary.main', fontWeight: 700 }} variant="body2">
                            {PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>].join('  ·  ')}
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Admin switches */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={roomState.autoReveal}
                                color="primary"
                                onChange={toggleAutoReveal}
                            />
                        }
                        label={
                            <Box>
                                <Typography sx={{ fontWeight: 700 }} variant="body2">
                                    Auto-Reveal Votes
                                </Typography>
                                <Typography
                                    color="text.secondary"
                                    sx={{ fontSize: 11 }}
                                    variant="caption"
                                >
                                    Automatically flip cards when everyone has voted
                                </Typography>
                            </Box>
                        }
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={roomState.isLocked}
                                color="error"
                                onChange={toggleLockRoom}
                            />
                        }
                        label={
                            <Box>
                                <Typography sx={{ fontWeight: 700 }} variant="body2">
                                    Lock Room
                                </Typography>
                                <Typography
                                    color="text.secondary"
                                    sx={{ fontSize: 11 }}
                                    variant="caption"
                                >
                                    Prevent new participants from joining
                                </Typography>
                            </Box>
                        }
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* End Session Button */}
                {!roomState.isEnded && (
                    <Button
                        color="error"
                        fullWidth
                        onClick={handleEndPlanning}
                        sx={{ fontWeight: 700 }}
                        variant="outlined"
                    >
                        End Planning Session
                    </Button>
                )}
            </DialogContent>

            <DialogActions sx={{ pb: 2, px: 3 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} sx={{ fontWeight: 700 }} variant="contained">
                    Apply Settings
                </Button>
            </DialogActions>
        </Dialog>
    );
};
