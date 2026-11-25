import { CardValue } from '@planitpoker/shared';
import { Button, Flex } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';

export interface DeckChipPickerProps {
    /** Value currently drafted in the surrounding form, as text. */
    activeValue: string;
    /** The room's active deck, offered as one button per card. */
    deck: CardValue[];
    /** Called with the picked card value. */
    onSelect: (value: CardValue) => void;
}

/**
 * Lets an admin pick a story estimate straight from the room's own deck.
 *
 * Buttons wrap rather than overflow, so the picker stays usable in a narrow
 * dialog. Both the group and each button are labelled: the visible card text is
 * the value alone, which does not tell a screen-reader user what the button is
 * for.
 */
export const DeckChipPicker: React.FC<DeckChipPickerProps> = ({ activeValue, deck, onSelect }) => {
    const { t } = useTranslation();

    return (
        <Flex aria-label={t('deck.aria.cards')} gap={8} role="group" wrap>
            {deck.map((value) => (
                <Button
                    aria-label={t('deck.aria.select', { value })}
                    aria-pressed={activeValue === String(value)}
                    key={String(value)}
                    onClick={() => onSelect(value)}
                    size="small"
                    type={activeValue === String(value) ? 'primary' : 'default'}
                >
                    {value}
                </Button>
            ))}
        </Flex>
    );
};
