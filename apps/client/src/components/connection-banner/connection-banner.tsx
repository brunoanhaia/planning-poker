import { Alert, Button } from 'antd';
import React from 'react';

import { ConnectionStatus } from '../../context/socket-context/socket-context';
import { useSocket } from '../../context/socket-context/use-socket';
import { TranslationKey } from '../../i18n/dictionary';
import { useTranslation } from '../../i18n/use-translation';

/** Copy shown for every non-connected transport state. */
const MESSAGE_KEYS: Record<Exclude<ConnectionStatus, 'connected'>, TranslationKey> = {
    connecting: 'connection.connecting',
    offline: 'connection.offline',
    reconnecting: 'connection.reconnecting',
    waking: 'connection.waking',
};

/** Alert severity per transport state. */
const ALERT_TYPES = {
    connecting: 'info',
    offline: 'error',
    reconnecting: 'warning',
    waking: 'warning',
} as const;

/** Vertical rhythm below the banner, in pixels. */
const BANNER_MARGIN_BLOCK_END = 16;

/** Keeps a live-region message out of the layout while leaving it readable to assistive tech. */
const VISUALLY_HIDDEN = {
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    left: 0,
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    whiteSpace: 'nowrap',
    width: 1,
} as const;

/**
 * Reports the transport state above the screen it affects.
 *
 * The polite live-region host stays mounted for the whole session: the visible
 * warning disappears once connected, but the connected message remains in the
 * region so the transition itself is announced. The retry action appears only
 * after the first grace period, because a connection that is still opening does
 * not need one yet.
 */
export const ConnectionBanner: React.FC = () => {
    const { connectionStatus, pendingEntry, retryConnection } = useSocket();
    const { t } = useTranslation();

    return (
        <div aria-atomic="true" aria-live="polite" role="status">
            {connectionStatus === 'connected' ? (
                <span style={VISUALLY_HIDDEN}>{t('connection.connected')}</span>
            ) : (
                <Alert
                    action={
                        connectionStatus !== 'connecting' ? (
                            <Button onClick={retryConnection} size="small">
                                {t('connection.retry')}
                            </Button>
                        ) : undefined
                    }
                    description={pendingEntry ? t('connection.queued') : undefined}
                    showIcon
                    style={{ marginBlockEnd: BANNER_MARGIN_BLOCK_END }}
                    title={t(MESSAGE_KEYS[connectionStatus])}
                    type={ALERT_TYPES[connectionStatus]}
                />
            )}
        </div>
    );
};
