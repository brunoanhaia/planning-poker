import { DECK_TYPES, DeckType, MAX_TITLE_LENGTH, PRESET_DECKS } from '@planitpoker/shared';
import { Button, Flex, Input, Select, Typography } from 'antd';
import React, { useState } from 'react';

import { deckLabelKey } from '../../i18n/dictionary';
import { useTranslation } from '../../i18n/use-translation';
import {
    CustomDeckError,
    parseCustomDeck,
    translateCustomDeckError,
} from '../../utils/custom-deck';

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
    const [customDeckError, setCustomDeckError] = useState<CustomDeckError | null>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (deckType !== 'custom') {
            onSubmit(roomTitle.trim(), deckType);
            return;
        }

        // The shared parser applies the same rules as the server schema, so a
        // deck that reaches `onSubmit` is one the room will actually accept.
        const { cards, error } = parseCustomDeck(customDeck);
        if (error) {
            setCustomDeckError(error);
            return;
        }
        setCustomDeckError(null);
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
                                setCustomDeckError(null);
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
                                {translateCustomDeckError(customDeckError, t)}
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
