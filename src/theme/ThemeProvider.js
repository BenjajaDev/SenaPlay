import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getThemeByMode } from './palette';

const THEME_STORAGE_KEY = 'oratiolingo.theme.mode.v1';

const ThemeContext = createContext({
  ...getThemeByMode('light'),
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
  isDark: false,
});

export function AppThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preferredMode, setPreferredMode] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreferredMode = async () => {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (!isMounted) {
        return;
      }

      if (stored === 'light' || stored === 'dark') {
        setPreferredMode(stored);
      }
    };

    loadPreferredMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedMode = preferredMode || systemScheme || 'light';
  const baseTheme = useMemo(() => getThemeByMode(resolvedMode), [resolvedMode]);

  const value = useMemo(() => {
    const setMode = async (nextMode) => {
      if (nextMode !== 'light' && nextMode !== 'dark') {
        return;
      }
      setPreferredMode(nextMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    };

    const toggleMode = async () => {
      const nextMode = resolvedMode === 'dark' ? 'light' : 'dark';
      await setMode(nextMode);
    };

    return {
      ...baseTheme,
      mode: resolvedMode,
      isDark: resolvedMode === 'dark',
      setMode,
      toggleMode,
    };
  }, [baseTheme, resolvedMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
