import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
    it('shows the active language without opening the menu', () => {
        render(<LanguageSwitcher />);

        const button = screen.getByRole('button', {
            name: 'Change language, current EN (English)',
        });
        expect(button).toHaveTextContent('EN');
    });
});
