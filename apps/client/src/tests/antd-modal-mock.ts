import type { ModalProps } from 'antd';

import React from 'react';

/** The slice of the Ant Design module this wrapper needs. */
interface ModalModule {
    Modal: React.ComponentType<ModalProps>;
}

/**
 * Wraps the real Ant Design module with a Modal that unmounts when closed.
 *
 * The real modal keeps its portal mounted during the leave animation, and jsdom
 * never fires the transition that removes it. Tests that assert the
 * `open={false}` gate would therefore see stale content; this wrapper keeps the
 * production modal behaviour for open dialogs and makes the closed state
 * deterministic.
 *
 * @param actual - The real Ant Design module.
 * @returns The same module with the open-only Modal.
 */
export const withOpenOnlyModal = <T extends ModalModule>(actual: T): T => {
    const MockModal = (props: React.ComponentProps<T['Modal']>) =>
        props.open ? React.createElement(actual.Modal, props) : null;

    return { ...actual, Modal: Object.assign(MockModal, actual.Modal) };
};
