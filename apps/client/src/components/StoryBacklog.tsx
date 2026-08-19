import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Paper,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface StoryBacklogProps {
    onClose: () => void;
    open: boolean;
}

export const StoryBacklog: React.FC<StoryBacklogProps> = ({ onClose, open }) => {
    const {
        addStory,
        bulkAddStories,
        deleteStory,
        isAdmin,
        roomState,
        setCurrentStory,
        updateStoryEstimate,
    } = useSocket();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Score editing state
    const [editingStory, setEditingStory] = useState<{
        id: string;
        title: string;
        currentScore?: string | number;
    } | null>(null);
    const [editScoreValue, setEditScoreValue] = useState('');

    // Bulk Import state
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');

    if (!roomState) {
        return null;
    }

    const handleCreateStory = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            return;
        }
        addStory(title.trim(), description.trim() || undefined);
        setTitle('');
        setDescription('');
        setIsAdding(false);
    };

    const handleBulkImport = () => {
        if (!bulkText.trim()) {
            return;
        }

        const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
        const parsedStories = lines.map((line) => {
            const parts = line.split(/[;,|]/);
            if (parts.length > 1) {
                return {
                    title: parts[0].trim(),
                    description: parts.slice(1).join(' - ').trim(),
                };
            }
            return { title: line.trim() };
        });

        if (parsedStories.length > 0) {
            bulkAddStories(parsedStories);
        }

        setBulkText('');
        setIsBulkOpen(false);
    };

    const handleExportCSV = () => {
        const csvContent =
            'data:text/csv;charset=utf-8,' +
            'ID,Title,Description,Status,Final Estimate\n' +
            roomState.stories
                .map(
                    (s, idx) =>
                        `"${idx + 1}","${s.title.replace(/"/g, '""')}","${(
                            s.description || ''
                        ).replace(/"/g, '""')}","${s.status}","${s.finalEstimate ?? ''}"`
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
        <>
            <Drawer
                anchor="right"
                onClose={onClose}
                open={open}
                PaperProps={{
                    sx: {
                        boxSizing: 'border-box',
                        p: 3,
                        width: { sm: 420, xs: '100%' },
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        alignItems: 'center',
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 3,
                    }}
                >
                    <Typography sx={{ fontWeight: 800 }} variant="h6">
                        Story Backlog ({roomState.stories.length})
                    </Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Action bar */}
                <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    {isAdmin && (
                        <>
                            <Button
                                fullWidth
                                onClick={() => setIsAdding(!isAdding)}
                                startIcon={<AddIcon />}
                                sx={{ fontWeight: 700 }}
                                variant="contained"
                            >
                                Add Story
                            </Button>

                            <Tooltip title="Bulk Import Stories (Admin)">
                                <IconButton
                                    color="primary"
                                    onClick={() => setIsBulkOpen(true)}
                                    sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}
                                >
                                    <FileUploadIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}

                    <Tooltip title="Export to CSV">
                        <IconButton
                            color="primary"
                            onClick={handleExportCSV}
                            sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}
                        >
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Add Form */}
                {isAdding && isAdmin && (
                    <Paper
                        component="form"
                        elevation={2}
                        onSubmit={handleCreateStory}
                        sx={{ bgcolor: 'action.hover', borderRadius: '16px', mb: 3, p: 2 }}
                    >
                        <Typography sx={{ fontWeight: 700, mb: 1.5 }} variant="subtitle2">
                            New Story Details
                        </Typography>
                        <TextField
                            fullWidth
                            label="Story Title"
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            size="small"
                            sx={{ mb: 1.5 }}
                            value={title}
                        />
                        <TextField
                            fullWidth
                            label="Description / Acceptance Criteria"
                            multiline
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            size="small"
                            sx={{ mb: 2 }}
                            value={description}
                        />
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button onClick={() => setIsAdding(false)} size="small">
                                Cancel
                            </Button>
                            <Button
                                disabled={!title.trim()}
                                size="small"
                                type="submit"
                                variant="contained"
                            >
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
                                elevation={isActive ? 4 : 0}
                                key={story.id}
                                onClick={() => {
                                    if (isAdmin && !isActive) {
                                        setCurrentStory(index);
                                    }
                                }}
                                sx={{
                                    bgcolor: isActive ? 'action.selected' : 'background.paper',
                                    border: isActive
                                        ? '2px solid #6366f1'
                                        : '1px solid rgba(148, 163, 184, 0.2)',
                                    borderRadius: '14px',
                                    cursor: isAdmin && !isActive ? 'pointer' : 'default',
                                    mb: 1.5,
                                    transition: 'all 0.2s ease',
                                    '&:hover':
                                        isAdmin && !isActive
                                            ? {
                                                  borderColor: 'primary.main',
                                                  boxShadow: 2,
                                                  transform: 'translateX(4px)',
                                              }
                                            : {},
                                }}
                            >
                                <ListItem alignItems="flex-start" sx={{ py: 1.5 }}>
                                    <ListItemText
                                        primary={
                                            <Box
                                                sx={{
                                                    alignItems: 'center',
                                                    display: 'flex',
                                                    gap: 1,
                                                }}
                                            >
                                                <Typography
                                                    sx={{ fontWeight: 700 }}
                                                    variant="subtitle2"
                                                >
                                                    {index + 1}. {story.title}
                                                </Typography>
                                                {isActive && (
                                                    <Chip
                                                        color="primary"
                                                        label="Estimating"
                                                        size="small"
                                                        sx={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            height: 20,
                                                        }}
                                                    />
                                                )}
                                                {story.finalEstimate !== undefined &&
                                                story.finalEstimate !== null ? (
                                                    <Tooltip
                                                        title={isAdmin ? 'Click to edit score' : ''}
                                                    >
                                                        <Chip
                                                            clickable={isAdmin}
                                                            color="success"
                                                            label={`Score: ${story.finalEstimate}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isAdmin) {
                                                                    setEditingStory({
                                                                        id: story.id,
                                                                        title: story.title,
                                                                        currentScore:
                                                                            story.finalEstimate,
                                                                    });
                                                                    setEditScoreValue(
                                                                        String(story.finalEstimate)
                                                                    );
                                                                }
                                                            }}
                                                            size="small"
                                                            sx={{
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                height: 20,
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ) : (
                                                    isAdmin && (
                                                        <Tooltip title="Set Score Manually">
                                                            <Chip
                                                                clickable
                                                                color="default"
                                                                label="+ Score"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingStory({
                                                                        id: story.id,
                                                                        title: story.title,
                                                                        currentScore: '',
                                                                    });
                                                                    setEditScoreValue('');
                                                                }}
                                                                size="small"
                                                                sx={{
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    height: 20,
                                                                }}
                                                                variant="outlined"
                                                            />
                                                        </Tooltip>
                                                    )
                                                )}
                                            </Box>
                                        }
                                        secondary={story.description}
                                    />
                                    {isAdmin && (
                                        <ListItemSecondaryAction>
                                            <Tooltip title="Edit Score">
                                                <IconButton
                                                    color="default"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingStory({
                                                            id: story.id,
                                                            title: story.title,
                                                            currentScore: story.finalEstimate,
                                                        });
                                                        setEditScoreValue(
                                                            story.finalEstimate !== undefined &&
                                                                story.finalEstimate !== null
                                                                ? String(story.finalEstimate)
                                                                : ''
                                                        );
                                                    }}
                                                    size="small"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            {!isActive && (
                                                <Tooltip title="Estimate This Story (Admin)">
                                                    <IconButton
                                                        color="primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentStory(index);
                                                        }}
                                                        size="small"
                                                    >
                                                        <PlayArrowIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {roomState.stories.length > 1 && (
                                                <IconButton
                                                    color="error"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteStory(story.id);
                                                    }}
                                                    size="small"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </ListItemSecondaryAction>
                                    )}
                                </ListItem>
                            </Paper>
                        );
                    })}
                </List>
            </Drawer>

            {/* Manual Score Edit Modal */}
            <Dialog
                fullWidth
                maxWidth="xs"
                onClose={() => setEditingStory(null)}
                open={Boolean(editingStory)}
                PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ Edit Story Score</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                        Set the final score for <strong>{editingStory?.title}</strong>:
                    </Typography>

                    <TextField
                        autoFocus
                        fullWidth
                        label="Final Estimate / Points"
                        onChange={(e) => setEditScoreValue(e.target.value)}
                        placeholder="e.g. 1, 2, 3, 5, 8, M, etc."
                        sx={{ mb: 2 }}
                        value={editScoreValue}
                    />

                    {roomState?.activeDeck && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {roomState.activeDeck.map((val) => (
                                <Chip
                                    clickable
                                    color={editScoreValue === String(val) ? 'primary' : 'default'}
                                    key={String(val)}
                                    label={val}
                                    onClick={() => setEditScoreValue(String(val))}
                                    sx={{ fontWeight: 700 }}
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: 2, px: 3 }}>
                    <Button onClick={() => setEditingStory(null)}>Cancel</Button>
                    <Button
                        disabled={!editScoreValue.trim()}
                        onClick={() => {
                            if (editingStory) {
                                const parsedNum = Number(editScoreValue.trim());
                                const finalVal = !isNaN(parsedNum)
                                    ? parsedNum
                                    : editScoreValue.trim();
                                updateStoryEstimate(editingStory.id, finalVal);
                                setEditingStory(null);
                            }
                        }}
                        sx={{ fontWeight: 700 }}
                        variant="contained"
                    >
                        Save Score
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Import Modal */}
            <Dialog
                fullWidth
                maxWidth="sm"
                onClose={() => setIsBulkOpen(false)}
                open={isBulkOpen}
                PaperProps={{ sx: { borderRadius: '20px' } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Bulk Import User Stories</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                        Paste multiple user stories below. Enter one story per line (e.g.{' '}
                        <code>Story Title; Story Description</code>).
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        label="User Stories (One per line)"
                        multiline
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="User Login API; Implement OAuth authentication&#10;Dashboard Widgets; Build responsive metrics cards&#10;Export PDF Reports; Generate monthly summary"
                        rows={8}
                        value={bulkText}
                    />
                </DialogContent>
                <DialogActions sx={{ pb: 2, px: 3 }}>
                    <Button onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                    <Button
                        disabled={!bulkText.trim()}
                        onClick={handleBulkImport}
                        variant="contained"
                    >
                        Import Stories
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
