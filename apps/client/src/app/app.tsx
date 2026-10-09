import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import React, { useEffect, useMemo, useState } from 'react';

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

    // The updater itself stays pure: persisting happens once per committed
    // change, which also survives StrictMode's double invocation.
    useEffect(() => {
        storeColorMode(colorMode);
    }, [colorMode]);

    const toggleColorMode = () => {
        setColorMode((previous) => (previous === 'dark' ? 'light' : 'dark'));
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
