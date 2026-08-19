import { CssBaseline, ThemeProvider } from '@mui/material';
import React, { useMemo, useState } from 'react';

import { MainContent } from './components/MainContent';
import { SocketProvider } from './context/SocketContext';
import { getAppTheme } from './theme';

export const App: React.FC = () => {
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('planit_theme');
        return saved ? saved === 'dark' : true;
    });

    const toggleDarkMode = () => {
        setDarkMode((prev) => {
            const next = !prev;
            localStorage.setItem('planit_theme', next ? 'dark' : 'light');
            return next;
        });
    };

    const theme = useMemo(() => getAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SocketProvider>
                <MainContent darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
            </SocketProvider>
        </ThemeProvider>
    );
};

export default App;
