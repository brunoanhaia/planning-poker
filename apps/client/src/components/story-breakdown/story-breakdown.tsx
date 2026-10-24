import { Story, VotingRound } from '@planitpoker/shared';
import { Card, Empty, Flex, Modal, Space, Statistic, Tag, Typography } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { computeVoteStats, formatStatValue } from '../../utils/estimation-stats';

/** Decimals shown for the mean and the median of a round. */
const DECIMALS_MEAN = 1;

/** Decimals shown for the standard deviation of a round. */
const DECIMALS_DEVIATION = 2;

/** One revealed round of a story, with its statistics and the cards behind them. */
const RoundCard: React.FC<{ index: number; round: VotingRound }> = ({ index, round }) => {
    const { language, t } = useTranslation();
    const stats = computeVoteStats(
        round.votes.map((vote) => ({ name: vote.name, vote: vote.vote }))
    );
    const time = new Date(round.revealedAt).toLocaleTimeString(language, {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <Card
            extra={
                <Typography.Text type="secondary">
                    {t('summary.revealed', { time })}
                </Typography.Text>
            }
            size="small"
            title={t('summary.round', { round: index + 1 })}
        >
            <Flex gap={12} vertical>
                <Flex gap={16} wrap>
                    <Statistic
                        formatter={String}
                        title={t('results.average')}
                        value={formatStatValue(stats.average, DECIMALS_MEAN)}
                    />
                    <Statistic
                        formatter={String}
                        title={t('results.median')}
                        value={formatStatValue(stats.median, DECIMALS_MEAN)}
                    />
                    <Statistic
                        formatter={String}
                        title={t('results.stdev')}
                        value={formatStatValue(stats.standardDeviation, DECIMALS_DEVIATION)}
                    />
                    <Statistic
                        formatter={String}
                        suffix="%"
                        title={t('results.consensus')}
                        value={stats.consensusPercentage}
                    />
                </Flex>

                <Space orientation="vertical" size={4}>
                    <Typography.Text strong>{t('results.outliers')}</Typography.Text>
                    {stats.outliers.length === 0 ? (
                        <Typography.Text type="secondary">
                            {t('results.outliers.none')}
                        </Typography.Text>
                    ) : (
                        <Flex gap={4} wrap>
                            {stats.outliers.map((outlier) => (
                                <Tag key={`${outlier.name}-${outlier.vote}`}>
                                    {`${outlier.name}: ${outlier.vote}`}
                                </Tag>
                            ))}
                        </Flex>
                    )}
                </Space>

                <Flex gap={4} wrap>
                    {round.votes.map((vote) => (
                        <Tag key={vote.participantId}>{`${vote.name}: ${vote.vote}`}</Tag>
                    ))}
                </Flex>
            </Flex>
        </Card>
    );
};

/**
 * Round-by-round breakdown of a single story.
 *
 * Every round is a revealed snapshot, so this never exposes a card that the
 * room has not already seen.
 */
export const StoryBreakdown: React.FC<{ story: Story }> = ({ story }) => {
    const { t } = useTranslation();

    if (story.rounds.length === 0) {
        return <Empty description={t('summary.noRounds')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
        <Flex gap={12} vertical>
            <Flex gap={8} wrap>
                <Typography.Text strong>{t('summary.final')}:</Typography.Text>
                <Typography.Text>
                    {story.finalEstimate === null || story.finalEstimate === undefined
                        ? '—'
                        : String(story.finalEstimate)}
                </Typography.Text>
                <Typography.Text type="secondary">
                    {t('summary.rounds')}: {story.rounds.length}
                </Typography.Text>
            </Flex>

            {story.rounds.map((round, index) => (
                <RoundCard index={index} key={round.id} round={round} />
            ))}
        </Flex>
    );
};

/** Modal wrapper around {@link StoryBreakdown}. */
export const StoryBreakdownModal: React.FC<{ onClose: () => void; story: null | Story }> = ({
    onClose,
    story,
}) => {
    const { t } = useTranslation();

    if (!story) {
        return null;
    }

    return (
        <Modal
            footer={null}
            onCancel={onClose}
            open={Boolean(story)}
            title={t('breakdown.title', { title: story.title })}
            width={720}
        >
            <StoryBreakdown story={story} />
        </Modal>
    );
};
