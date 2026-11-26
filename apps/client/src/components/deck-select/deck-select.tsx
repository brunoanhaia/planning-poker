import { DECK_TYPES, DeckType } from '@planitpoker/shared';
import { Input, InputRef, Select, Typography } from 'antd';
import React, { useEffect, useRef } from 'react';

import { deckLabelKey } from '../../i18n/dictionary';
import { useTranslation } from '../../i18n/use-translation';
import { deckPreview } from './deck-select.utils';

export interface DeckSelectProps {
    /** Raw comma separated custom cards. */
    customDeck: string;
    /** Translated validation message, or `null` while the field is valid. */
    customDeckError: null | string;
    /** DOM id of the custom-cards field; the error message derives from it. */
    customDeckId: string;
    /** Label of the custom-cards field. */
    customLabel: string;
    /** DOM id of the deck picker. */
    deckId: string;
    /** Currently selected deck. */
    deckType: DeckType;
    /** Label of the deck picker. */
    label: string;
    /** Called with the raw custom-deck text on every edit. */
    onCustomDeckChange: (value: string) => void;
    /** Called with the newly selected deck. */
    onDeckTypeChange: (deckType: DeckType) => void;
}

/**
 * Deck picker shared by the create-session form and the in-room setup screen.
 *
 * It is fully controlled: callers own the selected deck, the custom-deck draft
 * and the validation message, because those differ between the two flows.
 */
export const DeckSelect: React.FC<DeckSelectProps> = ({
    customDeck,
    customDeckError,
    customDeckId,
    customLabel,
    deckId,
    deckType,
    label,
    onCustomDeckChange,
    onDeckTypeChange,
}) => {
    const { t } = useTranslation();
    const errorId = `${customDeckId}-error`;
    const customDeckInputRef = useRef<InputRef>(null);

    // The parent sets the error after a submit; focus the field so keyboard and
    // screen-reader users land on the value that needs fixing.
    useEffect(() => {
        if (customDeckError) {
            customDeckInputRef.current?.focus();
        }
    }, [customDeckError]);

    return (
        <>
            <div>
                <label htmlFor={deckId}>{label}</label>
                <Select<DeckType>
                    id={deckId}
                    onChange={onDeckTypeChange}
                    // Five decks do not need a virtual window, and the window is
                    // what kept the last three out of the accessibility tree: a
                    // screen reader announced a two-option listbox. Rendering all
                    // of them also keeps `role="option"` queryable in tests.
                    virtual={false}
                    options={DECK_TYPES.map((option) => ({
                        label: t(deckLabelKey(option)),
                        value: option,
                    }))}
                    style={{ width: '100%' }}
                    value={deckType}
                />
                <Typography.Paragraph type="secondary">
                    {t('create.deck.preview', {
                        cards: deckPreview(deckType, t('create.deck.custom')),
                    })}
                </Typography.Paragraph>
            </div>

            {deckType === 'custom' && (
                <div>
                    <label htmlFor={customDeckId}>{customLabel}</label>
                    <Input
                        aria-describedby={customDeckError ? errorId : undefined}
                        aria-invalid={Boolean(customDeckError)}
                        id={customDeckId}
                        onChange={(event) => onCustomDeckChange(event.target.value)}
                        placeholder={t('create.customDeck.placeholder')}
                        ref={customDeckInputRef}
                        status={customDeckError ? 'error' : undefined}
                        value={customDeck}
                    />
                    {/* The live region stays mounted: a region inserted with
                        its content already inside is often skipped by screen
                        readers, so only the message is conditional. */}
                    <Typography.Text id={errorId} role="alert" type="danger">
                        {customDeckError ?? ''}
                    </Typography.Text>
                </div>
            )}
        </>
    );
};
