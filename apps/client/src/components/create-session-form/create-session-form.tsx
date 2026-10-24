import {
    DECK_TYPES,
    DeckType,
    MAX_CUSTOM_DECK_SIZE,
    MAX_NAME_LENGTH,
    MAX_TITLE_LENGTH,
    MIN_CUSTOM_DECK_SIZE,
    PRESET_DECKS,
} from '@planitpoker/shared';
import { Button, Flex, Input, Select, Typography } from 'antd';
import React, { useState } from 'react';

import { deckLabelKey } from '../../i18n/dictionary';
import { useTranslation } from '../../i18n/use-translation';

/** Renders the card list preview for the selected deck. */
const renderDeckPreview = (deckType: DeckType, customLabel: string): string => {
    if (deckType === 'custom') {
        return customLabel;
    }
    return PRESET_DECKS[deckType].join(', ');
};

export interface CreateSessionFormProps {
    /** Disables the submit button until a display name has been captured. */
    disabled: boolean;
    /** Called with the trimmed session title (possibly empty) and the selected deck, including custom cards when selected. */
    onSubmit: (title: string, deckType: DeckType, customDeck?: (number | string)[]) => void;
}

/**
 * Step 2 of the "create a room" flow: the optional session title and the deck.
 */
export const CreateSessionForm: React.FC<CreateSessionFormProps> = ({ disabled, onSubmit }) => {
    const { t } = useTranslation();
    const [roomTitle, setRoomTitle] = useState('');
    const [deckType, setDeckType] = useState<DeckType>('fibonacci');
    const [customDeck, setCustomDeck] = useState('');
    const [customDeckError, setCustomDeckError] = useState('');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (deckType !== 'custom') {
            onSubmit(roomTitle.trim(), deckType);
            return;
        }

        const cards = customDeck
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => (Number.isNaN(Number(entry)) ? entry : Number(entry)));
        if (cards.length < MIN_CUSTOM_DECK_SIZE || cards.length > MAX_CUSTOM_DECK_SIZE) {
            setCustomDeckError(
                t('create.error.count', { max: MAX_CUSTOM_DECK_SIZE, min: MIN_CUSTOM_DECK_SIZE })
            );
            return;
        }
        if (
            cards.some((card) =>
                typeof card === 'number' ? !Number.isFinite(card) : card.length > MAX_NAME_LENGTH
            )
        ) {
            setCustomDeckError(t('create.error.label', { max: MAX_NAME_LENGTH }));
            return;
        }
        if (new Set(cards.map(String)).size !== cards.length) {
            setCustomDeckError(t('create.error.duplicate'));
            return;
        }
        setCustomDeckError('');
        onSubmit(roomTitle.trim(), deckType, cards);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Flex gap={12} vertical>
                <div>
                    <label htmlFor="create-session-title">{t('create.title')}</label>
                    <Input
                        id="create-session-title"
                        maxLength={MAX_TITLE_LENGTH}
                        onChange={(event) => setRoomTitle(event.target.value)}
                        placeholder={t('create.title.placeholder')}
                        value={roomTitle}
                    />
                </div>

                <div>
                    <label htmlFor="create-session-deck">{t('create.deck')}</label>
                    <Select<DeckType>
                        id="create-session-deck"
                        onChange={setDeckType}
                        options={DECK_TYPES.map((option) => ({
                            label: t(deckLabelKey(option)),
                            value: option,
                        }))}
                        style={{ width: '100%' }}
                        value={deckType}
                    />
                    <Typography.Paragraph type="secondary">
                        {t('create.deck.preview', {
                            cards: renderDeckPreview(deckType, t('create.deck.custom')),
                        })}
                    </Typography.Paragraph>
                </div>

                {deckType === 'custom' && (
                    <div>
                        <label htmlFor="create-session-custom-deck">{t('create.customDeck')}</label>
                        <Input
                            aria-describedby={
                                customDeckError ? 'create-session-custom-deck-error' : undefined
                            }
                            aria-invalid={Boolean(customDeckError)}
                            id="create-session-custom-deck"
                            onChange={(event) => {
                                setCustomDeck(event.target.value);
                                setCustomDeckError('');
                            }}
                            placeholder={t('create.customDeck.placeholder')}
                            value={customDeck}
                        />
                        {customDeckError && (
                            <Typography.Text
                                id="create-session-custom-deck-error"
                                role="alert"
                                type="danger"
                            >
                                {customDeckError}
                            </Typography.Text>
                        )}
                    </div>
                )}

                <Button block disabled={disabled} htmlType="submit" size="large" type="primary">
                    {t('create.submit')}
                </Button>
            </Flex>
        </form>
    );
};
