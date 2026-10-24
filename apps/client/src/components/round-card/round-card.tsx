import { VotingRound } from '@planitpoker/shared';
import { Card, Flex, Space, Statistic, Tag, Typography } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { computeVoteStats, formatStatValue } from '../../utils/estimation-stats';

/** Decimals shown for the mean and the median of a round. */
const DECIMALS_MEAN = 1;

/** Decimals shown for the standard deviation of a round. */
const DECIMALS_DEVIATION = 2;

/**
 * One revealed round of a story, with its statistics and the cards behind them.
 *
 * Every value shown here was already revealed to the room, so the card lists
 * anything the participants themselves could see.
 */
export const RoundCard: React.FC<{ index: number; round: VotingRound }> = ({ index, round }) => {
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
