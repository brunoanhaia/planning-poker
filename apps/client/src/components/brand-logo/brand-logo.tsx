import { theme } from 'antd';
import React from 'react';

/** Default rendered size of the brand mark, in pixels. */
const DEFAULT_LOGO_SIZE = 36;

export interface BrandLogoProps {
    /** Rendered width and height, in pixels. */
    size?: number;
}

/**
 * Planit Poker mark: a playing card with a check on the brand tile.
 *
 * The mark is decorative; the adjacent brand text carries the accessible name.
 * Colours come from the active Ant Design theme, so the tile follows the brand
 * token instead of a hard-coded palette.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = DEFAULT_LOGO_SIZE }) => {
    const { token } = theme.useToken();

    return (
        <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 64 64" width={size}>
            <rect fill={token.colorPrimary} height="64" rx="16" width="64" />
            <g transform="rotate(-8 32 32)">
                <rect fill={token.colorWhite} height="42" rx="6" width="30" x="17" y="11" />
                <path
                    d="M24 33l6 6 11-13"
                    fill="none"
                    stroke={token.colorPrimary}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="6"
                />
            </g>
        </svg>
    );
};
