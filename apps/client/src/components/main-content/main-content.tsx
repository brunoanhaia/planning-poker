import { Button, Col, Layout, Modal, Result, Row } from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { ColorMode } from '../../theme/app-theme';
import { EstimationPanel } from '../estimation-panel/estimation-panel';
import { Home } from '../home/home';
import { Navbar } from '../navbar/navbar';
import { ParticipantsPanel } from '../participants-panel/participants-panel';
import { RoomSettingsModal } from '../room-settings-modal/room-settings-modal';
import { StoryBacklog } from '../story-backlog/story-backlog';

/** Horizontal rhythm between the room panels, in grid columns. */
const PANEL_GUTTER = 16;

/**
 * Horizontal padding of the page content, per breakpoint.
 *
 * Keeping it inside the grid instead of on each panel guarantees the outer edge
 * of the first and last column always lines up with the header above.
 */
const CONTENT_PADDING = { padding: PANEL_GUTTER } as const;

export interface MainContentProps {
    /** Currently rendered colour scheme. */
    colorMode: ColorMode;
    /** Flips the application between the light and dark design tokens. */
    onToggleColorMode: () => void;
}

/**
 * The signed-in shell.
 *
 * Owns the vertical rhythm of the room and the two overlays that are not tied to
 * a single panel: the admin settings modal and the "removed from session" notice.
 */
export const MainContent: React.FC<MainContentProps> = ({ colorMode, onToggleColorMode }) => {
    const { clearKickedMessage, kickedMessage, roomState } = useSocket();
    const [settingsOpen, setSettingsOpen] = useState(false);

    const closeSettings = () => setSettingsOpen(false);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Navbar
                colorMode={colorMode}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleColorMode={onToggleColorMode}
            />

            <Layout.Content style={CONTENT_PADDING}>
                {roomState ? (
                    <Row gutter={[PANEL_GUTTER, PANEL_GUTTER]} align="stretch">
                        <Col xs={24} xl={6}>
                            <ParticipantsPanel />
                        </Col>
                        <Col xs={24} xl={12}>
                            <EstimationPanel />
                        </Col>
                        <Col xs={24} xl={6}>
                            <StoryBacklog />
                        </Col>
                    </Row>
                ) : (
                    <Home />
                )}
            </Layout.Content>

            {roomState && <RoomSettingsModal onClose={closeSettings} open={settingsOpen} />}

            <Modal
                footer={null}
                onCancel={clearKickedMessage}
                open={Boolean(kickedMessage)}
                title="Session Notice"
                width={480}
            >
                <Result
                    extra={
                        <Button onClick={clearKickedMessage} type="primary">
                            OK
                        </Button>
                    }
                    status="warning"
                    subTitle={kickedMessage}
                />
            </Modal>
        </Layout>
    );
};
