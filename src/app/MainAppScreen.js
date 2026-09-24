import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_FONTS } from '../shared/theme/fonts';
import { supabase } from '../core/supabase/client';
import { getLevelProgress, recordDailyActivity, saveLevelProgress } from '../features/progress/data/progressStorage';
import AdaptiveModal from '../shared/ui/feedback/AdaptiveModal';
import AppBottomNav from './navigation/AppBottomNav';
import LoadingOverlay from '../shared/ui/feedback/LoadingOverlay';
import ProfileActionsModal from '../features/profile/presentation/ProfileActionsModal';
import FadeInView from '../shared/ui/motion/FadeInView';
import LevelsTabScreen from '../features/levels/presentation/LevelsTabScreen';
import DictionaryTabScreen from '../features/dictionary/presentation/DictionaryTabScreen';
import VideosTabScreen from '../features/videos/presentation/VideosTabScreen';
import GamesTabScreen from '../features/games/presentation/GamesTabScreen';
import ProgressTabScreen from '../features/progress/presentation/ProgressTabScreen';
import ProfileTabScreen from '../features/profile/presentation/ProfileTabScreen';
import MemoryGameScreen from '../features/games/presentation/MemoryGameScreen';
import QuickQuizGameScreen from '../features/games/presentation/QuickQuizGameScreen';
import SignPracticeScreen from '../features/camera/presentation/SignPracticeScreen';
import SpellingGameScreen from '../features/camera/presentation/SpellingGameScreen';
import CameraTranslationScreen from '../features/camera/presentation/CameraTranslationScreen';
import DynamicSignMonitorScreen from '../features/camera/presentation/DynamicSignMonitorScreen';
import LevelSessionScreen from '../features/levels/presentation/LevelSessionScreen';
import { useCatalog } from '../features/levels/presentation/CatalogContext';
import { useAppTheme } from '../shared/theme/ThemeProvider';

const DEFAULT_LEVEL_PROGRESS = { unlocked: [1], completed: {} };

// Juegos que usan la cámara: se montan a pantalla completa, fuera del contenedor
// con insets, porque el visor ocupa todo y gestiona sus propios márgenes.
const CAMERA_GAMES = {
  practice: SignPracticeScreen,
  spelling: SpellingGameScreen,
  'camera-translation': CameraTranslationScreen,
  'dynamic-monitor': DynamicSignMonitorScreen,
};

export default function MainAppScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { getLevelById } = useCatalog();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState('levels');
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingLevel, setIsSavingLevel] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({ visible: false, context: 'auth-error', message: '' });

  const [user, setUser] = useState(null);
  const [levelProgress, setLevelProgress] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [editTrigger, setEditTrigger] = useState(0);

  const progressLoaded = useRef(false);

  // Load user on mount
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data?.user) return;
      setUser(data.user);
    });
    return () => { mounted = false; };
  }, []);

  // Load user-specific data when user is available
  useEffect(() => {
    if (!user?.id) return;

    progressLoaded.current = false;
    let mounted = true;

    const init = async () => {
      const [progress, stats] = await Promise.all([
        getLevelProgress(user.id),
        recordDailyActivity(user.id),
      ]);
      if (!mounted) return;
      progressLoaded.current = true;
      setLevelProgress(progress);
      setUserStats(stats);
    };

    init();
    return () => { mounted = false; };
  }, [user?.id]);

  // Save level progress whenever it changes (user-specific, only after initial load)
  useEffect(() => {
    if (!user?.id || !progressLoaded.current || levelProgress === null) return;
    saveLevelProgress(user.id, levelProgress);
  }, [levelProgress, user?.id]);

  const refreshUser = useCallback(async (userOverride) => {
    if (userOverride) {
      setUser(userOverride);
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  }, []);

  const tabTitle = useMemo(() => {
    if (activeLevelId) return `Nivel ${activeLevelId}`;
    if (activeGame === 'memory') return 'Juego Memoria';
    if (activeGame === 'quiz') return 'Juego Quiz';
    if (activeGame === 'practice') return 'Práctica de señas';
    if (activeGame === 'spelling') return 'Deletreo';
    if (activeGame === 'camera-translation') return 'Traducción en vivo';
    if (activeTab === 'dictionary') return 'Diccionario';
    if (activeTab === 'videos') return 'Videos';
    if (activeTab === 'games') return 'Juegos';
    if (activeTab === 'progress') return 'Progreso';
    if (activeTab === 'profile') return 'Perfil';
    return 'Niveles';
  }, [activeGame, activeLevelId, activeTab]);

  const openLevel = (levelId) => setActiveLevelId(levelId);
  const closeLevel = () => setActiveLevelId(null);
  const openGame = (gameId) => setActiveGame(gameId);
  const closeGame = () => setActiveGame(null);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        setFeedbackModal({ visible: true, context: 'auth-error', message: error.message });
        return;
      }
      setIsProfileModalVisible(false);
      if (onLogout) onLogout();
    } catch {
      setFeedbackModal({
        visible: true,
        context: 'auth-error',
        message: 'No se pudo cerrar sesion. Intentalo de nuevo.',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const effectiveLevelProgress = levelProgress ?? DEFAULT_LEVEL_PROGRESS;

  const renderContent = () => {
    if (activeLevelId) {
      const level = getLevelById(activeLevelId);
      if (!level) return null;

      return (
        <LevelSessionScreen
          level={level}
          onBack={closeLevel}
          onComplete={({ levelId, score, hits, fails }) => {
            const nextLevelId = levelId + 1;
            setLevelProgress((prev) => {
              const base = prev ?? DEFAULT_LEVEL_PROGRESS;
              const unlockedSet = new Set(base.unlocked || [1]);
              unlockedSet.add(levelId);
              if (getLevelById(nextLevelId)?.available) {
                unlockedSet.add(nextLevelId);
              }
              return {
                unlocked: Array.from(unlockedSet).sort((a, b) => a - b),
                completed: { ...base.completed, [levelId]: { score, hits, fails } },
              };
            });
            // Breve modal de carga como transición mientras se guarda el
            // progreso (el guardado real es reactivo, ver el useEffect de
            // saveLevelProgress) — evita que el salto de vuelta a Niveles
            // se sienta instantáneo/abrupto.
            setIsSavingLevel(true);
            setTimeout(() => {
              setIsSavingLevel(false);
              closeLevel();
            }, 650);
          }}
        />
      );
    }

    if (CAMERA_GAMES[activeGame]) return null; // se montan aparte, a pantalla completa
    if (activeGame === 'memory') return <MemoryGameScreen onBack={closeGame} />;
    if (activeGame === 'quiz') return <QuickQuizGameScreen onBack={closeGame} />;
    if (activeTab === 'dictionary') return <DictionaryTabScreen />;
    if (activeTab === 'videos') return <VideosTabScreen />;
    if (activeTab === 'games') return <GamesTabScreen onOpenGame={openGame} />;
    if (activeTab === 'progress') {
      return (
        <ProgressTabScreen
          levelProgress={effectiveLevelProgress}
          userStats={userStats}
        />
      );
    }
    if (activeTab === 'profile') {
      return (
        <ProfileTabScreen
          user={user}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          onRefreshUser={refreshUser}
          editTrigger={editTrigger}
        />
      );
    }
    return <LevelsTabScreen levelProgress={effectiveLevelProgress} onOpenLevel={openLevel} />;
  };

  // Los niveles manejan su propio scroll interno (el encabezado, la barra de
  // progreso y el botón de verificar/continuar quedan fijos) para que nunca
  // haga falta desplazar la pantalla completa para llegar al botón.
  const usesFixedLayout = activeGame === 'memory' || Boolean(activeLevelId);
  // El diccionario también arma su propio scroll: es una lista virtualizada
  // (FlatList) porque carga fotos reales y así solo se decodifican las que
  // están a la vista. Anidarla dentro del ScrollView general rompería esa
  // virtualización (y React Native avisa de "VirtualizedLists should never
  // be nested").
  const isDictionaryTab = activeTab === 'dictionary' && !activeGame && !activeLevelId;
  // Identifica QUÉ se está mostrando; FadeInView se remonta (y re-anima)
  // cada vez que esto cambia, dando una transición sutil al cambiar de
  // pestaña, abrir un juego o entrar/salir de un nivel.
  const contentKey = activeLevelId ? `level-${activeLevelId}` : activeGame || activeTab;

  return (
    <>
      {/* View plano, NO SafeAreaView: el de react-native solo actúa en iOS y ahí
          duplicaba el inset superior (se sumaba al paddingTop manual del header),
          dejando el contenido descolgado. Los insets se aplican una sola vez, a
          mano, en el header / el contenido / la barra inferior. */}
      <View style={styles.screen}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        {!activeGame && !activeLevelId ? (
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View>
              <Text style={styles.headerTitle}>{tabTitle}</Text>
              <Text style={styles.headerSubtitle}>SeñaPlay</Text>
            </View>

            <Pressable
              style={styles.profileTrigger}
              onPress={() => setIsProfileModalVisible((prev) => !prev)}
              hitSlop={10}
            >
              <Ionicons name="person-circle-outline" size={34} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {usesFixedLayout ? (
          <View
            style={[
              styles.contentContainer,
              { flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
            ]}
          >
            <FadeInView key={contentKey} style={styles.fadeFlex}>
              {renderContent()}
            </FadeInView>
          </View>
        ) : isDictionaryTab ? (
          <View style={[styles.contentContainer, { flex: 1, paddingBottom: 0 }]}>
            <FadeInView key={contentKey} style={styles.fadeFlex}>
              {renderContent()}
            </FadeInView>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              activeGame ? { flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 } : null,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <FadeInView key={contentKey}>{renderContent()}</FadeInView>
          </ScrollView>
        )}

        {!activeGame && !activeLevelId ? (
          <AppBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
        ) : null}

        <ProfileActionsModal
          visible={isProfileModalVisible && !activeGame && !activeLevelId}
          onClose={() => setIsProfileModalVisible(false)}
          onEditProfile={() => {
            setActiveTab('profile');
            setIsProfileModalVisible(false);
            setEditTrigger((prev) => prev + 1);
          }}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />

        <AdaptiveModal
          visible={feedbackModal.visible}
          context={feedbackModal.context}
          message={feedbackModal.message}
          onPrimaryPress={() => setFeedbackModal((prev) => ({ ...prev, visible: false }))}
          onRequestClose={() => setFeedbackModal((prev) => ({ ...prev, visible: false }))}
        />

        <LoadingOverlay visible={isSavingLevel} label="Guardando tu progreso..." />
      </View>

      {CAMERA_GAMES[activeGame]
        ? (() => {
            const CameraGame = CAMERA_GAMES[activeGame];
            return (
              <View style={StyleSheet.absoluteFill}>
                <CameraGame onBack={closeGame} />
              </View>
            );
          })()
        : null}
    </>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    fadeFlex: { flex: 1 },
    header: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 18,
      paddingBottom: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontFamily: APP_FONTS.extraBold,
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontFamily: APP_FONTS.bold,
      fontSize: 13,
      color: theme.colors.primary,
      marginTop: 2,
    },
    profileTrigger: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    contentContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  });
}
