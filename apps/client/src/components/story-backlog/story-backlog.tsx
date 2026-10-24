import {
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    PlayCircleOutlined,
    PlusOutlined,
    ProfileOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import { EstimateValue, MAX_STORIES_PER_ROOM, RoomState, Story } from '@planitpoker/shared';
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
import { Translate } from '../../i18n/i18n-context';
import { useTranslation } from '../../i18n/use-translation';
import { DeckChipPicker } from '../deck-chip-picker/deck-chip-picker';
import { StoryBreakdownModal } from '../story-breakdown-modal/story-breakdown-modal';
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

/** Renders the story lifecycle as a status badge. */
const renderStoryStatus = (status: Story['status'], t: Translate): React.ReactNode => {
    if (status === 'completed') {
        return <Badge status="success" text={t('backlog.status.done')} />;
    }
    if (status === 'estimating') {
        return <Badge status="processing" text={t('backlog.status.estimating')} />;
    }
    return <Badge status="default" text={t('backlog.status.pending')} />;
};

/** Triggers a client side CSV download for the whole backlog. */
const downloadBacklogCsv = (room: RoomState): void => {
    const header = CSV_COLUMNS.map(escapeCsvCell).join(',');
    const rows = room.stories.map((story) =>
        [story.id, story.title, story.description || '', story.status, story.finalEstimate ?? '']
            .map(escapeCsvCell)
            .join(',')
    );

    const link = document.createElement('a');
    link.setAttribute(
        'href',
        `data:text/csv;charset=utf-8,${encodeURIComponent([header, ...rows].join('\n'))}`
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
    const { t } = useTranslation();

    const [isAdding, setIsAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scoreDraft, setScoreDraft] = useState<null | ScoreDraft>(null);
    const [editScoreValue, setEditScoreValue] = useState('');
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [pendingStoryIndex, setPendingStoryIndex] = useState<null | number>(null);
    const [breakdownStoryId, setBreakdownStoryId] = useState<null | string>(null);

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
        const parsed = parseBulkStories(bulkText);
        // A room holds a bounded backlog, and the import travels as a bounded
        // number of frames, so the paste is capped at what the room can still
        // take instead of overflowing both.
        const capacity = Math.max(0, MAX_STORIES_PER_ROOM - roomState.stories.length);
        const stories = parsed.slice(0, capacity);
        if (stories.length === 0) {
            // Nothing usable in the paste is a different problem from a full
            // backlog, and telling an admin the wrong one wastes their time.
            const nothingToImport = parsed.length === 0;
            const warning = nothingToImport
                ? t('backlog.imported.none')
                : t('backlog.imported.skipped', {
                      max: MAX_STORIES_PER_ROOM,
                      skipped: parsed.length,
                  });
            void message.warning(warning);
            return;
        }
        bulkAddStories(stories);
        setBulkText('');
        setIsBulkOpen(false);
        void message.success(t('backlog.imported', { count: stories.length }));
        if (parsed.length > stories.length) {
            void message.warning(
                t('backlog.imported.skipped', {
                    max: MAX_STORIES_PER_ROOM,
                    skipped: parsed.length - stories.length,
                })
            );
        }
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
                    <Typography.Text>
                        {t('backlog.title', { total: roomState.stories.length })}
                    </Typography.Text>
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
                                {t('backlog.add')}
                            </Button>
                            <Tooltip title={t('backlog.bulk')}>
                                <Button
                                    aria-label={t('backlog.bulk.aria')}
                                    icon={<UploadOutlined />}
                                    onClick={() => setIsBulkOpen(true)}
                                />
                            </Tooltip>
                        </>
                    )}

                    <Tooltip title={t('backlog.export')}>
                        <Button
                            aria-label={t('backlog.export.aria')}
                            icon={<DownloadOutlined />}
                            onClick={() => downloadBacklogCsv(roomState)}
                        />
                    </Tooltip>
                </Flex>

                {isAdding && isAdmin && (
                    <form onSubmit={handleCreateStory}>
                        <Flex gap={8} style={{ padding: PANEL_PADDING }} vertical>
                            <Typography.Text strong>{t('backlog.new')}</Typography.Text>

                            <div>
                                <label htmlFor="backlog-new-story-title">
                                    {t('backlog.titleLabel')}
                                </label>
                                <Input
                                    id="backlog-new-story-title"
                                    onChange={(event) => setTitle(event.target.value)}
                                    value={title}
                                />
                            </div>

                            <div>
                                <label htmlFor="backlog-new-story-description">
                                    {t('backlog.description')}
                                </label>
                                <Input.TextArea
                                    autoSize={{ minRows: 2 }}
                                    id="backlog-new-story-description"
                                    onChange={(event) => setDescription(event.target.value)}
                                    value={description}
                                />
                            </div>

                            <Flex gap={8} justify="end">
                                <Button onClick={closeAddForm}>{t('common.cancel')}</Button>
                                <Button disabled={!title.trim()} htmlType="submit" type="primary">
                                    {t('backlog.save')}
                                </Button>
                            </Flex>
                        </Flex>
                    </form>
                )}

                {roomState.stories.length === 0 ? (
                    <Flex justify="center" style={{ padding: PANEL_PADDING }}>
                        <Empty
                            description={t('backlog.empty')}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
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
                                                {renderStoryStatus(story.status, t)}
                                                {hasEstimate && (
                                                    <Tag>
                                                        {t('backlog.score', {
                                                            value: String(story.finalEstimate),
                                                        })}
                                                    </Tag>
                                                )}
                                                {story.rounds.length > 0 && (
                                                    <Tag>
                                                        {t('backlog.rounds', {
                                                            count: story.rounds.length,
                                                        })}
                                                    </Tag>
                                                )}
                                            </Space>
                                            {story.description && (
                                                <Typography.Text type="secondary">
                                                    {story.description}
                                                </Typography.Text>
                                            )}
                                        </Flex>

                                        <Space size={4}>
                                            <Tooltip title={t('backlog.breakdown')}>
                                                <Button
                                                    aria-label={t('backlog.breakdown')}
                                                    icon={<ProfileOutlined />}
                                                    onClick={() => setBreakdownStoryId(story.id)}
                                                    size="small"
                                                    type="text"
                                                />
                                            </Tooltip>

                                            {isAdmin && (
                                                <>
                                                    <Tooltip
                                                        title={t('backlog.edit.aria', {
                                                            title: story.title,
                                                        })}
                                                    >
                                                        <Button
                                                            aria-label={t('backlog.edit.aria', {
                                                                title: story.title,
                                                            })}
                                                            icon={<EditOutlined />}
                                                            onClick={() => openScoreDraft(story)}
                                                            size="small"
                                                            type="text"
                                                        />
                                                    </Tooltip>
                                                    {!isActive && (
                                                        <Tooltip
                                                            title={t('backlog.estimate.aria', {
                                                                title: story.title,
                                                            })}
                                                        >
                                                            <Button
                                                                aria-label={t(
                                                                    'backlog.estimate.aria',
                                                                    {
                                                                        title: story.title,
                                                                    }
                                                                )}
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
                                                        <Tooltip
                                                            title={t('backlog.delete.aria', {
                                                                title: story.title,
                                                            })}
                                                        >
                                                            <Button
                                                                aria-label={t(
                                                                    'backlog.delete.aria',
                                                                    {
                                                                        title: story.title,
                                                                    }
                                                                )}
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() =>
                                                                    deleteStory(story.id)
                                                                }
                                                                size="small"
                                                                type="text"
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </>
                                            )}
                                        </Space>
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
                            disabled={scoreDraft?.currentScore == null}
                            onClick={() => {
                                if (scoreDraft) {
                                    updateStoryEstimate(scoreDraft.id, null);
                                    closeScoreDraft();
                                }
                            }}
                        >
                            {t('results.resetScore')}
                        </Button>
                        <Space>
                            <Button onClick={closeScoreDraft}>{t('common.cancel')}</Button>
                            <Button
                                disabled={!editScoreValue.trim()}
                                onClick={saveScoreDraft}
                                type="primary"
                            >
                                {t('backlog.saveScore')}
                            </Button>
                        </Space>
                    </Flex>
                }
                onCancel={closeScoreDraft}
                open={Boolean(scoreDraft)}
                title={t('backlog.edit.title')}
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">
                        {t('backlog.edit.body', { title: scoreDraft?.title ?? '' })}
                    </Typography.Text>

                    <div>
                        <label htmlFor="backlog-story-score">{t('backlog.edit.label')}</label>
                        <Input
                            id="backlog-story-score"
                            onChange={(event) => setEditScoreValue(event.target.value)}
                            placeholder={t('backlog.edit.placeholder')}
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
                okText={t('backlog.import.button')}
                onCancel={() => setIsBulkOpen(false)}
                onOk={handleBulkImport}
                open={isBulkOpen}
                title={t('backlog.import.title')}
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">{t('backlog.import.hint')}</Typography.Text>

                    <div>
                        <label htmlFor="backlog-bulk-text">{t('backlog.import.label')}</label>
                        <Input.TextArea
                            autoSize={{ minRows: 8 }}
                            id="backlog-bulk-text"
                            onChange={(event) => setBulkText(event.target.value)}
                            placeholder={t('backlog.import.placeholder')}
                            value={bulkText}
                        />
                    </div>
                </Flex>
            </Modal>

            <Modal
                okText={t('backlog.change.ok')}
                onCancel={() => setPendingStoryIndex(null)}
                onOk={() => {
                    if (pendingStoryIndex !== null) {
                        setCurrentStory(pendingStoryIndex);
                        setPendingStoryIndex(null);
                    }
                }}
                open={pendingStoryIndex !== null}
                title={t('backlog.change.title')}
            >
                <Typography.Paragraph>{t('backlog.change.body')}</Typography.Paragraph>
            </Modal>

            <StoryBreakdownModal
                onClose={() => setBreakdownStoryId(null)}
                story={roomState.stories.find((story) => story.id === breakdownStoryId) ?? null}
            />
        </>
    );
};
