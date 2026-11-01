import { Button, Flex, Modal } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';

export interface SessionSwitchModalProps {
    /** Room this browser is still in, named in the copy and the rejoin action. */
    activeRoomId: string;
    /** Closes the modal without changing anything. */
    onDismiss: () => void;
    /** Ends the stored session and continues with the requested action. */
    onProceed: () => void;
    /** Opens the stored room instead of the requested one. */
    onRejoin: () => void;
    /** Whether the modal is visible. */
    open: boolean;
}

/**
 * Confirmation shown when a second room session would replace the open one.
 *
 * The dialog stays presentational: it never reads storage, so the lobby decides
 * which room is active and what each action does.
 */
export const SessionSwitchModal: React.FC<SessionSwitchModalProps> = ({
    activeRoomId,
    onDismiss,
    onProceed,
    onRejoin,
    open,
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            footer={
                <Flex gap={8} justify="end">
                    <Button onClick={onRejoin}>
                        {t('session.switch.rejoin', { roomId: activeRoomId })}
                    </Button>
                    <Button danger onClick={onProceed} type="primary">
                        {t('session.switch.proceed')}
                    </Button>
                </Flex>
            }
            onCancel={onDismiss}
            open={open}
            title={t('session.switch.title')}
        >
            {t('session.switch.body', { roomId: activeRoomId })}
        </Modal>
    );
};
