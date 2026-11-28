import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { BrandLogo } from './brand-logo';

describe('BrandLogo', () => {
    it('renders a decorative mark at the requested size', () => {
        const { container } = render(<BrandLogo size={48} />);
        const svg = container.querySelector('svg');

        expect(svg).toHaveAttribute('width', '48');
        expect(svg).toHaveAttribute('height', '48');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
    });
});
