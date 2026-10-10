import {
    DECK_TYPES,
    DECK_TYPE_LABELS,
    DeckType,
    MAX_CUSTOM_DECK_SIZE,
    MAX_NAME_LENGTH,
    MAX_TITLE_LENGTH,
    MIN_CUSTOM_DECK_SIZE,
    PRESET_DECKS,
} from '@planitpoker/shared';
import { Button, Flex, Input, Select, Typography } from 'antd';
import React, { useState } from 'react';

/** Renders the card list preview for the selected deck. */
const renderDeckPreview = (deckType: DeckType): string => {
    if (deckType === 'custom') {
        return 'Custom deck';
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
                `Enter between ${MIN_CUSTOM_DECK_SIZE} and ${MAX_CUSTOM_DECK_SIZE} cards.`
            );
            return;
        }
        if (
            cards.some((card) =>
                typeof card === 'number' ? !Number.isFinite(card) : card.length > MAX_NAME_LENGTH
            )
        ) {
            setCustomDeckError(`Use finite numbers or labels up to ${MAX_NAME_LENGTH} characters.`);
            return;
        }
        if (new Set(cards.map(String)).size !== cards.length) {
            setCustomDeckError('Custom cards must be unique.');
            return;
        }
        setCustomDeckError('');
        onSubmit(roomTitle.trim(), deckType, cards);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Flex gap={12} vertical>
                <div>
                    <label htmlFor="create-session-title">Session / Project Title (Optional)</label>
                    <Input
                        id="create-session-title"
                        maxLength={MAX_TITLE_LENGTH}
                        onChange={(event) => setRoomTitle(event.target.value)}
                        placeholder="e.g. Sprint 42 Estimation"
                        value={roomTitle}
                    />
                </div>

                <div>
                    <label htmlFor="create-session-deck">Estimation Deck Type</label>
                    <Select<DeckType>
                        id="create-session-deck"
                        onChange={setDeckType}
                        options={DECK_TYPES.map((option) => ({
                            label: DECK_TYPE_LABELS[option],
                            value: option,
                        }))}
                        style={{ width: '100%' }}
                        value={deckType}
                    />
                    <Typography.Paragraph type="secondary">
                        Deck cards preview: {renderDeckPreview(deckType)}
                    </Typography.Paragraph>
                </div>

                {deckType === 'custom' && (
                    <div>
                        <label htmlFor="create-session-custom-deck">
                            Comma-Separated Custom Cards
                        </label>
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
                            placeholder="e.g. 0, 1, 2, 3, 5, 8, ?, ☕"
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
                    Start Session &amp; Generate Room Code
                </Button>
            </Flex>
        </form>
    );
};
