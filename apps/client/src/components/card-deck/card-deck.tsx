import { EyeOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Typography } from 'antd';
import React from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';

/**
 * The voting deck.
 *
 * Cards wrap onto new lines instead of overflowing, so every estimate stays
 * clickable at 320px. Spectators get a notice with the one action that applies
 * to them rather than an unusable deck.
 */
export const CardDeck: React.FC = () => {
    const { currentUserId, roomState, submitVote, toggleSpectator } = useSocket();
    const { t } = useTranslation();

    if (!roomState) {
        return null;
    }

    const currentUser = roomState.participants.find((p) => p.id === currentUserId);

    if (currentUser?.isSpectator) {
        return (
            <Alert
                action={
                    <Button icon={<EyeOutlined />} onClick={toggleSpectator} type="primary">
                        {t('deck.switchToVoter')}
                    </Button>
                }
                description={t('deck.observer.desc')}
                showIcon
                title={t('deck.observer.title')}
                type="info"
            />
        );
    }

    return (
        <Flex gap={8} vertical>
            <Typography.Text type="secondary">{t('deck.select')}</Typography.Text>
            <Flex gap={8} role="group" aria-label={t('deck.aria.cards')} wrap>
                {roomState.activeDeck.map((value) => {
                    const isSelected = currentUser?.vote === value;

                    return (
                        <Button
                            aria-label={t('deck.aria.select', { value })}
                            aria-pressed={isSelected}
                            key={String(value)}
                            onClick={() => submitVote(value)}
                            type={isSelected ? 'primary' : 'default'}
                        >
                            {value}
                        </Button>
                    );
                })}
            </Flex>
        </Flex>
    );
};
