import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import React, { useMemo, useState } from 'react';

import { MainContent } from '../components/main-content/main-content';
import { SocketProvider } from '../context/socket-context/socket-provider';
import { ColorMode, getAppTheme, readStoredColorMode, storeColorMode } from '../theme/app-theme';

/**
 * The application root.
 *
 * Owns the two global concerns — the Ant Design design-token scheme and the
 * live socket session — so every screen below receives a themed, connected tree.
 */
export const App: React.FC = () => {
    const [colorMode, setColorMode] = useState<ColorMode>(readStoredColorMode);

    const toggleColorMode = () => {
        setColorMode((previous) => {
            const next: ColorMode = previous === 'dark' ? 'light' : 'dark';
            storeColorMode(next);
            return next;
        });
    };

    const appTheme = useMemo(() => getAppTheme(colorMode), [colorMode]);

    return (
        <ConfigProvider locale={enUS} theme={appTheme}>
            <AntApp>
                <SocketProvider>
                    <MainContent colorMode={colorMode} onToggleColorMode={toggleColorMode} />
                </SocketProvider>
            </AntApp>
        </ConfigProvider>
    );
};

export default App;
