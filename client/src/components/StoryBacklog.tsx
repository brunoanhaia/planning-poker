import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Paper,
  Tooltip,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface StoryBacklogProps {
  open: boolean;
  onClose: () => void;
}

export const StoryBacklog: React.FC<StoryBacklogProps> = ({ open, onClose }) => {
  const { roomState, addStory, setCurrentStory, deleteStory } = useSocket();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!roomState) return null;

  const handleCreateStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addStory(title.trim(), description.trim() || undefined);
    setTitle('');
    setDescription('');
    setIsAdding(false);
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'ID,Title,Description,Status,Final Estimate\n' +
      roomState.stories
        .map(
          (s, idx) =>
            `"${idx + 1}","${s.title.replace(/"/g, '""')}","${(s.description || '').replace(
              /"/g,
              '""'
            )}","${s.status}","${s.finalEstimate ?? ''}"`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${roomState.title}_Backlog_Estimates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          p: 3,
          boxSizing: 'border-box',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Story Backlog ({roomState.stories.length})
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Action bar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(!isAdding)}
          sx={{ fontWeight: 700 }}
        >
          Add New Story
        </Button>
        <Tooltip title="Export to CSV">
          <IconButton onClick={handleExportCSV} color="primary" sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Add Form */}
      {isAdding && (
        <Paper
          elevation={2}
          component="form"
          onSubmit={handleCreateStory}
          sx={{ p: 2, mb: 3, borderRadius: '16px', bgcolor: 'action.hover' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            New Story Details
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Story Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label="Description / Acceptance Criteria"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button size="small" type="submit" variant="contained" disabled={!title.trim()}>
              Save Story
            </Button>
          </Box>
        </Paper>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Stories List */}
      <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {roomState.stories.map((story, index) => {
          const isActive = index === roomState.currentStoryIndex;

          return (
            <Paper
              key={story.id}
              elevation={isActive ? 4 : 0}
              sx={{
                mb: 1.5,
                borderRadius: '14px',
                border: isActive ? '2px solid #6366f1' : '1px solid rgba(148, 163, 184, 0.2)',
                bgcolor: isActive ? 'action.selected' : 'background.paper',
                transition: 'all 0.2s ease',
              }}
            >
              <ListItem alignItems="flex-start" sx={{ py: 1.5 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {index + 1}. {story.title}
                      </Typography>
                      {isActive && <Chip label="Estimating" color="primary" size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />}
                      {story.finalEstimate !== undefined && story.finalEstimate !== null && (
                        <Chip
                          label={`Score: ${story.finalEstimate}`}
                          color="success"
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={story.description}
                />
                <ListItemSecondaryAction>
                  {!isActive && (
                    <Tooltip title="Estimate This Story">
                      <IconButton size="small" color="primary" onClick={() => setCurrentStory(index)}>
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {roomState.stories.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => deleteStory(story.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            </Paper>
          );
        })}
      </List>
    </Drawer>
  );
};
