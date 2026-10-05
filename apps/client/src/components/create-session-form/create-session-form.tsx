import {
    DECK_TYPES,
    DECK_TYPE_LABELS,
    DeckType,
    MAX_TITLE_LENGTH,
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
    /** Called with the trimmed session title, which may be empty. */
    onSubmit: (title: string) => void;
}

/**
 * Step 2 of the "create a room" flow: the optional session title and the deck.
 */
export const CreateSessionForm: React.FC<CreateSessionFormProps> = ({ disabled, onSubmit }) => {
    const [roomTitle, setRoomTitle] = useState('');
    const [deckType, setDeckType] = useState<DeckType>('fibonacci');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit(roomTitle.trim());
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

                <Button block disabled={disabled} htmlType="submit" size="large" type="primary">
                    Start Session &amp; Generate Room Code
                </Button>
            </Flex>
        </form>
    );
};
