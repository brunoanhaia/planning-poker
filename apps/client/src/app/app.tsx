import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import ptBR from 'antd/locale/pt_BR';
import React, { useEffect, useMemo, useState } from 'react';

import { MainContent } from '../components/main-content/main-content';
import { SocketProvider } from '../context/socket-context/socket-provider';
import { I18nProvider, useTranslation } from '../i18n';
import { ColorMode, getAppTheme, readStoredColorMode, storeColorMode } from '../theme/app-theme';

/** Ant Design locale packages, one per interface language. */
const ANT_LOCALES = { en: enUS, 'pt-BR': ptBR, es: esES } as const;

/**
 * The translated shell: Ant Design is configured in the active language, so its
 * own strings (pagination, empty states, date pickers) follow the interface.
 */
const ThemedShell: React.FC<{ children: React.ReactNode; colorMode: ColorMode }> = ({
    children,
    colorMode,
}) => {
    const { language } = useTranslation();
    const appTheme = useMemo(() => getAppTheme(colorMode), [colorMode]);

    return (
        <ConfigProvider locale={ANT_LOCALES[language]} theme={appTheme}>
            <AntApp>{children}</AntApp>
        </ConfigProvider>
    );
};

/**
 * The application root.
 *
 * Owns the design-token scheme and hands the language to the provider, which
 * persists it; the socket session sits inside both so any error it reports is
 * already translated.
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

    return (
        <I18nProvider>
            <ThemedShell colorMode={colorMode}>
                <SocketProvider>
                    <MainContent colorMode={colorMode} onToggleColorMode={toggleColorMode} />
                </SocketProvider>
            </ThemedShell>
        </I18nProvider>
    );
};

export default App;
