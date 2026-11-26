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

/**
 * Reports the transport state above the screen it affects.
 *
 * The notice stays mounted as an `aria-live="polite"` region while the socket
 * is not connected, so a reconnect or a cold start is announced instead of the
 * form looking frozen. The retry action appears only after the first grace
 * period, because a connection that is still opening does not need one yet.
 */
export const ConnectionBanner: React.FC = () => {
    const { connectionStatus, pendingEntry, retryConnection } = useSocket();
    const { t } = useTranslation();

    if (connectionStatus === 'connected') {
        return null;
    }

    const showRetry = connectionStatus !== 'connecting';
    return (
        <Alert
            action={
                showRetry ? (
                    <Button onClick={retryConnection} size="small">
                        {t('connection.retry')}
                    </Button>
                ) : undefined
            }
            aria-live="polite"
            description={pendingEntry ? t('connection.queued') : undefined}
            showIcon
            style={{ marginBlockEnd: BANNER_MARGIN_BLOCK_END }}
            title={t(MESSAGE_KEYS[connectionStatus])}
            type={ALERT_TYPES[connectionStatus]}
        />
    );
};
