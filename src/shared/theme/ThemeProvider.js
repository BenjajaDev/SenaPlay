import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { setUserFontScale } from './applyPoppinsGlobally';
import { getThemeByMode } from './palette';

const THEME_STORAGE_KEY = 'senaplay.theme.mode.v1';
const FONT_SCALE_STORAGE_KEY = 'senaplay.theme.fontScale.v1';

/** Tamaños de letra que ofrece Perfil → Preferencias. */
export const FONT_SCALES = Object.freeze([
  { key: 'small', label: 'Pequeña', scale: 0.9 },
  { key: 'normal', label: 'Normal', scale: 1 },
  { key: 'large', label: 'Grande', scale: 1.15 },
  { key: 'xlarge', label: 'Muy grande', scale: 1.3 },
]);

const scaleFor = (key) => FONT_SCALES.find((item) => item.key === key)?.scale ?? 1;

const ThemeContext = createContext({
  ...getThemeByMode('light'),
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
  isDark: false,
  fontScaleKey: 'normal',
  fontScale: 1,
  setFontScale: () => {},
});

export function AppThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preferredMode, setPreferredMode] = useState(null);
  const [fontScaleKey, setFontScaleKey] = useState('normal');

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const [storedMode, storedScale] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY),
        ]);
        if (!isMounted) return;
        if (storedMode === 'light' || storedMode === 'dark') setPreferredMode(storedMode);
        if (FONT_SCALES.some((item) => item.key === storedScale)) setFontScaleKey(storedScale);
      } catch {
        /* sin almacenamiento: se usan los valores por defecto */
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedMode = preferredMode || systemScheme || 'light';
  const baseTheme = useMemo(() => getThemeByMode(resolvedMode), [resolvedMode]);
  const fontScale = scaleFor(fontScaleKey);

  const value = useMemo(() => {
    // Antes de que se re-renderice el árbol: el Text global lee este valor.
    setUserFontScale(fontScale);

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

    const setFontScale = async (key) => {
      if (!FONT_SCALES.some((item) => item.key === key)) return;
      setFontScaleKey(key);
      try {
        await AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, key);
      } catch {
        /* se aplica igual en esta sesión */
      }
    };

    return {
      ...baseTheme,
      mode: resolvedMode,
      isDark: resolvedMode === 'dark',
      setMode,
      toggleMode,
      fontScaleKey,
      fontScale,
      setFontScale,
    };
  }, [baseTheme, resolvedMode, fontScaleKey, fontScale]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
