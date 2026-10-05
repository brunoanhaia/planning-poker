import {
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    PlayCircleOutlined,
    PlusOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import { EstimateValue, RoomState, Story } from '@planitpoker/shared';
import {
    App as AntApp,
    Badge,
    Button,
    Card,
    Divider,
    Empty,
    Flex,
    Input,
    Modal,
    Space,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import React, { Fragment, useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { DeckChipPicker } from '../deck-chip-picker/deck-chip-picker';
import { buildBacklogCsvFilename, escapeCsvCell, parseBulkStories } from './story-backlog.utils';

/** CSV columns emitted by the export, in order. */
const CSV_COLUMNS = ['ID', 'Title', 'Description', 'Status', 'Final Estimate'] as const;

/** Padding applied to each area of the backlog, in pixels. */
const PANEL_PADDING = 16;

/** Width of a story title before it collapses to an ellipsis. */
const STORY_TITLE_MAX_WIDTH = '28ch';

/** The story whose score is currently being edited, plus its draft value. */
interface ScoreDraft {
    currentScore: EstimateValue | undefined;
    id: string;
    title: string;
}

/** Converts a draft value to the number or string the server expects. */
const toFinalEstimate = (value: string): number | string => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
};

/**
 * Renders the story lifecycle as a status badge.
 *
 * `Badge` keeps the label in Ant Design's body text colour and carries the state
 * in the dot, which stays legible in both colour schemes.
 */
const renderStoryStatus = (story: Story) => {
    if (story.status === 'completed') {
        return <Badge status="success" text="Done" />;
    }
    if (story.status === 'estimating') {
        return <Badge status="processing" text="Estimating" />;
    }
    return <Badge status="default" text="Pending" />;
};

/** Triggers a client side CSV download for the whole backlog. */
const downloadBacklogCsv = (room: RoomState): void => {
    const header = CSV_COLUMNS.map(escapeCsvCell).join(',');
    const rows = room.stories.map((story, index) =>
        [index + 1, story.title, story.description || '', story.status, story.finalEstimate ?? '']
            .map(escapeCsvCell)
            .join(',')
    );

    const link = document.createElement('a');
    link.setAttribute(
        'href',
        encodeURI(['data:text/csv;charset=utf-8,', header, ...rows].join('\n'))
    );
    link.setAttribute('download', buildBacklogCsvFilename(room.title));
    document.body.appendChild(link);
    link.click();
    link.remove();
};

/**
 * The room's story list, plus the admin-only authoring and import actions.
 *
 * Each story is a wrapping flex row: title and badges on one line, the admin
 * controls on the next when space runs out, so the two can never overlap.
 */
export const StoryBacklog: React.FC = () => {
    const {
        addStory,
        bulkAddStories,
        deleteStory,
        isAdmin,
        roomState,
        setCurrentStory,
        updateStoryEstimate,
    } = useSocket();
    const { message } = AntApp.useApp();

    const [isAdding, setIsAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scoreDraft, setScoreDraft] = useState<null | ScoreDraft>(null);
    const [editScoreValue, setEditScoreValue] = useState('');
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [pendingStoryIndex, setPendingStoryIndex] = useState<null | number>(null);

    if (!roomState) {
        return null;
    }

    const closeAddForm = () => {
        setIsAdding(false);
        setTitle('');
        setDescription('');
    };

    const handleCreateStory = (event: React.FormEvent) => {
        event.preventDefault();
        if (!title.trim()) {
            return;
        }
        addStory(title.trim(), description.trim() || undefined);
        closeAddForm();
    };

    const handleBulkImport = () => {
        const stories = parseBulkStories(bulkText);
        if (stories.length === 0) {
            return;
        }
        bulkAddStories(stories);
        setBulkText('');
        setIsBulkOpen(false);
        void message.success(`Imported ${stories.length} stories.`);
    };

    const openScoreDraft = (story: Story) => {
        setScoreDraft({ currentScore: story.finalEstimate, id: story.id, title: story.title });
        setEditScoreValue(
            story.finalEstimate !== undefined && story.finalEstimate !== null
                ? String(story.finalEstimate)
                : ''
        );
    };

    const closeScoreDraft = () => {
        setScoreDraft(null);
        setEditScoreValue('');
    };

    const saveScoreDraft = () => {
        if (!scoreDraft || !editScoreValue.trim()) {
            return;
        }
        updateStoryEstimate(scoreDraft.id, toFinalEstimate(editScoreValue.trim()));
        closeScoreDraft();
    };

    return (
        <>
            <Card
                styles={{ body: { padding: 0 } }}
                title={
                    <Typography.Text>Story Backlog ({roomState.stories.length})</Typography.Text>
                }
            >
                <Flex gap={8} style={{ padding: PANEL_PADDING }} wrap>
                    {isAdmin && (
                        <>
                            <Button
                                icon={<PlusOutlined />}
                                onClick={() => setIsAdding((previous) => !previous)}
                                type="primary"
                            >
                                Add Story
                            </Button>
                            <Tooltip title="Bulk Import Stories (Admin)">
                                <Button
                                    aria-label="Bulk import stories"
                                    icon={<UploadOutlined />}
                                    onClick={() => setIsBulkOpen(true)}
                                />
                            </Tooltip>
                        </>
                    )}

                    <Tooltip title="Export to CSV">
                        <Button
                            aria-label="Export backlog to CSV"
                            icon={<DownloadOutlined />}
                            onClick={() => downloadBacklogCsv(roomState)}
                        />
                    </Tooltip>
                </Flex>

                {isAdding && isAdmin && (
                    <form onSubmit={handleCreateStory}>
                        <Flex gap={8} style={{ padding: PANEL_PADDING }} vertical>
                            <Typography.Text strong>New Story Details</Typography.Text>

                            <div>
                                <label htmlFor="backlog-new-story-title">Story Title</label>
                                <Input
                                    id="backlog-new-story-title"
                                    onChange={(event) => setTitle(event.target.value)}
                                    value={title}
                                />
                            </div>

                            <div>
                                <label htmlFor="backlog-new-story-description">
                                    Description / Acceptance Criteria
                                </label>
                                <Input.TextArea
                                    autoSize={{ minRows: 2 }}
                                    id="backlog-new-story-description"
                                    onChange={(event) => setDescription(event.target.value)}
                                    value={description}
                                />
                            </div>

                            <Flex gap={8} justify="end">
                                <Button onClick={closeAddForm}>Cancel</Button>
                                <Button disabled={!title.trim()} htmlType="submit" type="primary">
                                    Save Story
                                </Button>
                            </Flex>
                        </Flex>
                    </form>
                )}

                {roomState.stories.length === 0 ? (
                    <Flex justify="center" style={{ padding: PANEL_PADDING }}>
                        <Empty description="No stories yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </Flex>
                ) : (
                    <Flex component="ul" vertical>
                        {roomState.stories.map((story, index) => {
                            const isActive = index === roomState.currentStoryIndex;
                            const hasEstimate =
                                story.finalEstimate !== undefined && story.finalEstimate !== null;

                            return (
                                <Fragment key={story.id}>
                                    {index > 0 && <Divider style={{ margin: 0 }} />}
                                    <Flex
                                        align="center"
                                        component="li"
                                        gap={8}
                                        justify="space-between"
                                        style={{ padding: PANEL_PADDING }}
                                        wrap
                                    >
                                        <Flex gap={4} style={{ flex: 1, minWidth: 0 }} vertical>
                                            <Space align="center" size={4} wrap>
                                                <Typography.Text
                                                    ellipsis={{ tooltip: story.title }}
                                                    strong
                                                    style={{ maxWidth: STORY_TITLE_MAX_WIDTH }}
                                                >
                                                    {`${index + 1}. ${story.title}`}
                                                </Typography.Text>
                                                {renderStoryStatus(story)}
                                                {hasEstimate && (
                                                    <Tag>{`Score: ${story.finalEstimate}`}</Tag>
                                                )}
                                            </Space>
                                            {story.description && (
                                                <Typography.Text type="secondary">
                                                    {story.description}
                                                </Typography.Text>
                                            )}
                                        </Flex>

                                        {isAdmin && (
                                            <Space size={4}>
                                                <Tooltip title="Edit Score">
                                                    <Button
                                                        aria-label={`Edit score for ${story.title}`}
                                                        icon={<EditOutlined />}
                                                        onClick={() => openScoreDraft(story)}
                                                        size="small"
                                                        type="text"
                                                    />
                                                </Tooltip>
                                                {!isActive && (
                                                    <Tooltip title="Estimate This Story (Admin)">
                                                        <Button
                                                            aria-label={`Estimate ${story.title}`}
                                                            icon={<PlayCircleOutlined />}
                                                            onClick={() =>
                                                                setPendingStoryIndex(index)
                                                            }
                                                            size="small"
                                                            type="text"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {roomState.stories.length > 1 && (
                                                    <Tooltip title="Delete Story">
                                                        <Button
                                                            aria-label={`Delete ${story.title}`}
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => deleteStory(story.id)}
                                                            size="small"
                                                            type="text"
                                                        />
                                                    </Tooltip>
                                                )}
                                            </Space>
                                        )}
                                    </Flex>
                                </Fragment>
                            );
                        })}
                    </Flex>
                )}
            </Card>

            <Modal
                footer={
                    <Flex gap={8} justify="space-between" wrap>
                        <Button
                            danger
                            disabled={!scoreDraft?.currentScore}
                            onClick={() => {
                                if (scoreDraft) {
                                    updateStoryEstimate(scoreDraft.id, null);
                                    closeScoreDraft();
                                }
                            }}
                        >
                            Reset Score
                        </Button>
                        <Space>
                            <Button onClick={closeScoreDraft}>Cancel</Button>
                            <Button
                                disabled={!editScoreValue.trim()}
                                onClick={saveScoreDraft}
                                type="primary"
                            >
                                Save Score
                            </Button>
                        </Space>
                    </Flex>
                }
                onCancel={closeScoreDraft}
                open={Boolean(scoreDraft)}
                title="Edit Story Score"
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">
                        {`Set the final score for "${scoreDraft?.title ?? ''}".`}
                    </Typography.Text>

                    <div>
                        <label htmlFor="backlog-story-score">Final Estimate / Points</label>
                        <Input
                            id="backlog-story-score"
                            onChange={(event) => setEditScoreValue(event.target.value)}
                            placeholder="e.g. 1, 2, 3, 5, 8, M"
                            value={editScoreValue}
                        />
                    </div>

                    <DeckChipPicker
                        activeValue={editScoreValue}
                        deck={roomState.activeDeck}
                        onSelect={(value) => setEditScoreValue(String(value))}
                    />
                </Flex>
            </Modal>

            <Modal
                okButtonProps={{ disabled: !bulkText.trim() }}
                okText="Import Stories"
                onCancel={() => setIsBulkOpen(false)}
                onOk={handleBulkImport}
                open={isBulkOpen}
                title="Bulk Import User Stories"
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">
                        Paste one story per line, as Title; Description.
                    </Typography.Text>

                    <div>
                        <label htmlFor="backlog-bulk-text">User Stories (One per line)</label>
                        <Input.TextArea
                            autoSize={{ minRows: 8 }}
                            id="backlog-bulk-text"
                            onChange={(event) => setBulkText(event.target.value)}
                            placeholder={
                                'User Login API; Implement OAuth authentication\nDashboard Widgets; Build responsive metrics cards'
                            }
                            value={bulkText}
                        />
                    </div>
                </Flex>
            </Modal>

            <Modal
                okText="Change Story"
                onCancel={() => setPendingStoryIndex(null)}
                onOk={() => {
                    if (pendingStoryIndex !== null) {
                        setCurrentStory(pendingStoryIndex);
                        setPendingStoryIndex(null);
                    }
                }}
                open={pendingStoryIndex !== null}
                title="Confirm Story Change"
            >
                <Typography.Paragraph>
                    Are you sure you want to change the active story? This will affect all
                    participants and reset the timer.
                </Typography.Paragraph>
            </Modal>
        </>
    );
};
