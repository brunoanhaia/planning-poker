import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Box,
  FormHelperText,
} from '@mui/material';
import { DeckType, PRESET_DECKS } from '@planitpoker/shared';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface RoomSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({ open, onClose }) => {
  const { roomState, changeDeck } = useSocket();

  const [deckType, setDeckType] = useState<DeckType>(roomState?.deckType || 'fibonacci');
  const [customDeckStr, setCustomDeckStr] = useState<string>(
    roomState?.customDeck ? roomState.customDeck.join(', ') : '1, 2, 3, 5, 8'
  );

  if (!roomState) return null;

  const handleSave = () => {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Room & Deck Settings</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Change the estimation cards used by all participants in this room.
        </Typography>

        <FormControl fullWidth sx={{ mb: 2.5 }}>
          <InputLabel>Estimation Deck Type</InputLabel>
          <Select
            value={deckType}
            label="Estimation Deck Type"
            onChange={(e) => setDeckType(e.target.value as DeckType)}
          >
            <MenuItem value="fibonacci">Fibonacci (1, 2, 3, 5, 8, 13, 21...)</MenuItem>
            <MenuItem value="modified_fibonacci">Modified Fibonacci (0, 0.5, 1, 2, 3, 5...)</MenuItem>
            <MenuItem value="tshirt">T-Shirt Sizes (XS, S, M, L, XL, XXL)</MenuItem>
            <MenuItem value="powers_of_2">Powers of 2 (1, 2, 4, 8, 16, 32...)</MenuItem>
            <MenuItem value="custom">Custom Deck</MenuItem>
          </Select>
        </FormControl>

        {deckType === 'custom' ? (
          <TextField
            fullWidth
            label="Comma-Separated Custom Cards"
            placeholder="e.g. 1, 2, 3, 5, 8, 10, ?, ☕"
            value={customDeckStr}
            onChange={(e) => setCustomDeckStr(e.target.value)}
            helperText="Enter values separated by commas"
            sx={{ mb: 1 }}
          />
        ) : (
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
              Selected Cards Preview:
            </Typography>
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
              {PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>].join('  ·  ')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} sx={{ fontWeight: 700 }}>
          Apply Deck Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};
