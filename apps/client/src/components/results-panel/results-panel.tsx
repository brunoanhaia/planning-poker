import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import {
    App as AntApp,
    Badge,
    Button,
    Card,
    Col,
    Flex,
    Input,
    Modal,
    Progress,
    Row,
    Space,
    Statistic,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';
import { DeckChipPicker } from '../deck-chip-picker/deck-chip-picker';
import { useEstimationStats } from './results-panel.hooks';

/** Distinguishes a numeric estimate from a symbolic one such as "XL" or "?". */
const toFinalEstimate = (value: number | string): number | string => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
};

/**
 * Revealed votes for the active story, with the actions the host can take next.
 *
 * The statistic grid uses real grid columns so the figures never overlap when
 * the panel narrows.
 */
export const ResultsPanel: React.FC = () => {
    const { isAdmin, roomState, setCurrentStory, updateStoryEstimate } = useSocket();
    const { message } = AntApp.useApp();
    const { t } = useTranslation();

    const [isManualEditOpen, setIsManualEditOpen] = useState(false);
    const [manualScore, setManualScore] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingEstimate, setPendingEstimate] = useState<number | string | undefined>(undefined);

    const {
        averageText,
        consensusPercentage,
        deviationText,
        hasNumeric,
        isFullConsensus,
        medianText,
        modeVote,
        outliers,
        totalVotes,
        voteCounts,
        votedParticipants,
    } = useEstimationStats(roomState);

    const currentStory = roomState?.stories[roomState.currentStoryIndex ?? 0];
    const roundNumber = currentStory?.rounds.length ?? 0;

    if (!roomState?.votesRevealed) {
        return null;
    }

    if (votedParticipants.length === 0) {
        return (
            <Card>
                <Typography.Text type="secondary">{t('results.noVotes')}</Typography.Text>
            </Card>
        );
    }

    // `averageText` is rounded for display; the stored estimate must stay the
    // number the server validates, not the formatted string.
    const suggestedEstimate = hasNumeric ? Number(averageText) : (modeVote ?? '-');

    const promptSaveEstimate = (customEstimate?: number | string) => {
        setPendingEstimate(customEstimate);
        setIsConfirmOpen(true);
    };

    const confirmSaveEstimate = () => {
        if (!currentStory || !isAdmin) {
            return;
        }

        const finalEstimate =
            pendingEstimate === undefined || pendingEstimate === ''
                ? suggestedEstimate
                : toFinalEstimate(pendingEstimate);

        updateStoryEstimate(currentStory.id, finalEstimate);

        const nextIndex = roomState.currentStoryIndex + 1;
        if (nextIndex < roomState.stories.length) {
            setCurrentStory(nextIndex);
        } else {
            void message.success(t('results.allEstimated'));
        }

        setIsConfirmOpen(false);
        setIsManualEditOpen(false);
    };

    const resetManualScore = () => {
        if (currentStory) {
            updateStoryEstimate(currentStory.id, null);
        }
        setIsManualEditOpen(false);
    };

    return (
        <>
            <Card
                className="results-panel"
                extra={
                    <Flex align="center" gap={8} wrap>
                        {roundNumber > 0 && (
                            <Tag>{t('estimation.round', { round: roundNumber })}</Tag>
                        )}
                        {isFullConsensus && (
                            <Badge status="success" text={t('results.consensus.full')} />
                        )}
                    </Flex>
                }
                title={t('results.title')}
            >
                <Flex gap={16} vertical>
                    {isAdmin && (
                        <Flex gap={8} justify="end" wrap>
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setManualScore(String(suggestedEstimate));
                                    setIsManualEditOpen(true);
                                }}
                            >
                                {t('results.customScore')}
                            </Button>
                            <Button
                                icon={<SaveOutlined />}
                                onClick={() => promptSaveEstimate()}
                                type="primary"
                            >
                                {t('results.accept', {
                                    strategy: hasNumeric
                                        ? t('results.accept.average')
                                        : t('results.accept.mode'),
                                    value: suggestedEstimate,
                                })}
                            </Button>
                        </Flex>
                    )}

                    {/*
                     * `String` renders each statistic verbatim: without a formatter
                     * Ant Design splits `5.0` into integer and decimal spans and
                     * groups thousands, which is wrong for poker estimates.
                     */}
                    <Row gutter={[16, 16]}>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                title={t('results.average')}
                                value={averageText}
                            />
                        </Col>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                title={t('results.median')}
                                value={medianText}
                            />
                        </Col>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                title={t('results.stdev')}
                                value={deviationText}
                            />
                        </Col>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                suffix="%"
                                title={t('results.consensus')}
                                value={consensusPercentage}
                            />
                        </Col>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                title={t('results.topVote')}
                                value={modeVote ?? '-'}
                            />
                        </Col>
                        <Col xs={12} md={8} xl={4}>
                            <Statistic
                                formatter={String}
                                title={t('results.voters')}
                                value={totalVotes}
                            />
                        </Col>
                    </Row>

                    <Flex gap={8} vertical>
                        <Flex align="center" gap={8} wrap>
                            <Typography.Text strong>{t('results.outliers')}</Typography.Text>
                            <Tooltip title={t('results.outliers.hint')}>
                                <Typography.Text type="secondary">
                                    {t('results.outliers.range')}
                                </Typography.Text>
                            </Tooltip>
                        </Flex>
                        {outliers.length === 0 ? (
                            <Typography.Text type="secondary">
                                {t('results.outliers.none')}
                            </Typography.Text>
                        ) : (
                            <Flex gap={4} wrap>
                                {outliers.map((outlier) => (
                                    <Tag key={`${outlier.name}-${outlier.vote}`}>
                                        {`${outlier.name}: ${outlier.vote}`}
                                    </Tag>
                                ))}
                            </Flex>
                        )}
                    </Flex>

                    <Typography.Title level={5} style={{ margin: 0 }}>
                        {t('results.distribution')}
                    </Typography.Title>

                    <Flex gap={8} vertical>
                        {Object.entries(voteCounts).map(([vote, count]) => {
                            const percent = Math.round((count / totalVotes) * 100);

                            return (
                                <Row align="middle" gutter={[8, 8]} key={vote} wrap>
                                    <Col flex="64px">
                                        <Tag>{vote}</Tag>
                                    </Col>
                                    <Col flex="auto">
                                        <Flex gap={8} vertical>
                                            <Flex gap={8} justify="space-between" wrap>
                                                <Typography.Text>
                                                    {t('results.votes', { count })}
                                                </Typography.Text>
                                                <Typography.Text type="secondary">
                                                    {`${percent}%`}
                                                </Typography.Text>
                                            </Flex>
                                            <Progress
                                                aria-label={t('results.share.aria', {
                                                    vote,
                                                })}
                                                percent={percent}
                                                showInfo={false}
                                                size="small"
                                            />
                                        </Flex>
                                    </Col>
                                </Row>
                            );
                        })}
                    </Flex>
                </Flex>
            </Card>

            <Modal
                footer={
                    <Flex gap={8} justify="space-between" wrap>
                        <Button danger onClick={resetManualScore}>
                            {t('results.resetScore')}
                        </Button>
                        <Space>
                            <Button onClick={() => setIsManualEditOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                disabled={!manualScore.trim()}
                                onClick={() => promptSaveEstimate(manualScore.trim())}
                                type="primary"
                            >
                                {t('results.saveNext')}
                            </Button>
                        </Space>
                    </Flex>
                }
                onCancel={() => setIsManualEditOpen(false)}
                open={isManualEditOpen}
                title={t('results.custom.title')}
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">
                        {t('results.custom.body', { title: currentStory?.title ?? '' })}
                    </Typography.Text>

                    <div>
                        <label htmlFor="results-custom-score">{t('results.custom.label')}</label>
                        <Input
                            id="results-custom-score"
                            onChange={(event) => setManualScore(event.target.value)}
                            placeholder={t('results.custom.placeholder')}
                            value={manualScore}
                        />
                    </div>

                    <DeckChipPicker
                        activeValue={manualScore}
                        deck={roomState.activeDeck}
                        onSelect={(value) => setManualScore(String(value))}
                    />
                </Flex>
            </Modal>

            <Modal
                okText={t('results.confirm.ok')}
                onCancel={() => setIsConfirmOpen(false)}
                onOk={confirmSaveEstimate}
                open={isConfirmOpen}
                title={t('results.confirm.title')}
            >
                <Typography.Paragraph>{t('results.confirm.body')}</Typography.Paragraph>
            </Modal>
        </>
    );
};
