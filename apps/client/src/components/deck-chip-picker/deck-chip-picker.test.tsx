import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { DeckChipPicker } from './deck-chip-picker';

describe('DeckChipPicker', () => {
    it('labels the group and every card button for screen readers', () => {
        render(<DeckChipPicker activeValue="5" deck={[1, 5, '?']} onSelect={() => undefined} />);

        expect(screen.getByRole('group', { name: 'Estimation cards' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Select estimate 5' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: 'Select estimate ?' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });
});
