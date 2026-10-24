import { Story } from '@planitpoker/shared';
import { Empty, Flex, Typography } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { RoundCard } from '../round-card/round-card';

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
