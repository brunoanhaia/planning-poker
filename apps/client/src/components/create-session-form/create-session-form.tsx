import { DeckType, MAX_TITLE_LENGTH } from '@planitpoker/shared';
import { Button, Flex, Input } from 'antd';
import React, { useState } from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { DeckSelect } from '../deck-select/deck-select';
import { parseCustomDeck, validateCustomDeck } from '../deck-select/deck-select.utils';

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
    const [customDeckError, setCustomDeckError] = useState<null | string>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (deckType !== 'custom') {
            onSubmit(roomTitle.trim(), deckType);
            return;
        }

        const cards = parseCustomDeck(customDeck);
        const error = validateCustomDeck(cards);
        if (error) {
            setCustomDeckError(t(error.key, error.params));
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

                <DeckSelect
                    customDeck={customDeck}
                    customDeckError={customDeckError}
                    customDeckId="create-session-custom-deck"
                    customLabel={t('create.customDeck')}
                    deckId="create-session-deck"
                    deckType={deckType}
                    label={t('create.deck')}
                    onCustomDeckChange={(value) => {
                        setCustomDeck(value);
                        setCustomDeckError(null);
                    }}
                    onDeckTypeChange={setDeckType}
                />

                <Button block disabled={disabled} htmlType="submit" size="large" type="primary">
                    {t('create.submit')}
                </Button>
            </Flex>
        </form>
    );
};
