import { DownloadOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
    Col,
    Collapse,
    Flex,
    Modal,
    Row,
    Statistic,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import React from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';
import { buildSessionSummary } from '../../utils/estimation-stats';
import { buildBacklogCsvFilename } from '../story-backlog/story-backlog.utils';
import { StoryBreakdown } from '../story-breakdown/story-breakdown';
import { buildSummaryCsv, formatDuration } from './session-summary.utils';

export interface SessionSummaryProps {
    /** Closes the summary overlay. */
    onClose: () => void;
    /** Whether the summary is visible. */
    open: boolean;
}

/** Triggers a client-side download of the summary CSV. */
const downloadSummaryCsv = (roomTitle: string, csv: string): void => {
    const link = document.createElement('a');
    link.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    link.setAttribute('download', buildBacklogCsvFilename(`${roomTitle} summary`));
    document.body.appendChild(link);
    link.click();
    link.remove();
};

/**
 * End-of-session summary: totals, the full breakdown of every story and the
 * CSV export of what was revealed.
 *
 * Reads the room state the server already broadcast, so the overlay keeps
 * working after the socket drops and never asks the server for the votes a
 * second time.
 */
export const SessionSummary: React.FC<SessionSummaryProps> = ({ onClose, open }) => {
    const { roomState } = useSocket();
    const { t } = useTranslation();

    if (!roomState) {
        return null;
    }

    const summary = buildSessionSummary(roomState);
    const totalRounds = summary.stories.reduce((total, story) => total + story.rounds.length, 0);
    const unestimated = summary.stories.length - summary.estimatedStories;

    return (
        <Modal footer={null} onCancel={onClose} open={open} title={t('summary.title')} width={860}>
            <Flex gap={16} vertical>
                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Typography.Text type="secondary">
                        {t('summary.subtitle', { title: roomState.title })}
                    </Typography.Text>
                    <Tooltip title={t('backlog.export')}>
                        <Button
                            aria-label={t('backlog.export.aria')}
                            icon={<DownloadOutlined />}
                            onClick={() =>
                                downloadSummaryCsv(roomState.title, buildSummaryCsv(summary))
                            }
                        >
                            {t('backlog.export')}
                        </Button>
                    </Tooltip>
                </Flex>

                <Row gutter={[16, 16]}>
                    <Col md={6} xs={12}>
                        <Statistic
                            formatter={String}
                            title={t('summary.estimated')}
                            value={`${summary.estimatedStories}/${summary.stories.length}`}
                        />
                    </Col>
                    <Col md={6} xs={12}>
                        <Statistic
                            formatter={String}
                            title={t('summary.points')}
                            value={summary.totalPoints}
                        />
                    </Col>
                    <Col md={6} xs={12}>
                        <Statistic
                            formatter={String}
                            title={t('summary.rounds')}
                            value={totalRounds}
                        />
                    </Col>
                    <Col md={6} xs={12}>
                        <Statistic
                            formatter={String}
                            title={t('summary.duration')}
                            value={formatDuration(summary.durationMs)}
                        />
                    </Col>
                </Row>

                {unestimated > 0 && (
                    <Typography.Text type="secondary">
                        {t('summary.unestimated', { count: unestimated })}
                    </Typography.Text>
                )}

                {summary.stories.length === 0 ? (
                    <Typography.Text type="secondary">{t('summary.empty')}</Typography.Text>
                ) : (
                    <Collapse
                        items={summary.stories.map((story, index) => ({
                            children: <StoryBreakdown story={roomState.stories[index]} />,
                            extra: (
                                <Flex gap={4} wrap>
                                    {story.rounds.length > 0 && (
                                        <Tag>
                                            {t('backlog.rounds', { count: story.rounds.length })}
                                        </Tag>
                                    )}
                                    {story.finalEstimate !== null && (
                                        <Tag>
                                            {t('backlog.score', { value: story.finalEstimate })}
                                        </Tag>
                                    )}
                                </Flex>
                            ),
                            key: story.storyId,
                            label: (
                                <Card size="small" styles={{ body: { padding: 0 } }} type="inner">
                                    <Typography.Text strong>
                                        {`${index + 1}. ${story.title}`}
                                    </Typography.Text>
                                </Card>
                            ),
                        }))}
                    />
                )}
            </Flex>
        </Modal>
    );
};
