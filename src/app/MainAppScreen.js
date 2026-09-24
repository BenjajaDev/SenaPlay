import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useServices } from '../core/di/ServicesProvider';
import { APP_EVENTS } from '../core/events/EventBus';
import { useSession } from '../features/auth/presentation/SessionProvider';
import CameraTranslationScreen from '../features/camera/presentation/CameraTranslationScreen';
import DynamicSignMonitorScreen from '../features/camera/presentation/DynamicSignMonitorScreen';
import SignPracticeScreen from '../features/camera/presentation/SignPracticeScreen';
import SpellingGameScreen from '../features/camera/presentation/SpellingGameScreen';
import DictionaryTabScreen from '../features/dictionary/presentation/DictionaryTabScreen';
import GamesTabScreen from '../features/games/presentation/GamesTabScreen';
import MemoryGameScreen from '../features/games/presentation/MemoryGameScreen';
import QuickQuizGameScreen from '../features/games/presentation/QuickQuizGameScreen';
import { useCatalog } from '../features/levels/presentation/CatalogContext';
import LevelSessionScreen from '../features/levels/presentation/LevelSessionScreen';
import LevelsTabScreen from '../features/levels/presentation/LevelsTabScreen';
import ProfileActionsModal from '../features/profile/presentation/ProfileActionsModal';
import ProfileTabScreen from '../features/profile/presentation/ProfileTabScreen';
import ProgressTabScreen from '../features/progress/presentation/ProgressTabScreen';
import useUserProgress from '../features/progress/presentation/useUserProgress';
import AnnouncementBanner from '../features/remoteConfig/presentation/AnnouncementBanner';
import { useRemoteConfig } from '../features/remoteConfig/presentation/RemoteConfigProvider';
import VideosTabScreen from '../features/videos/presentation/VideosTabScreen';
import { AppText, useFeedback } from '../shared/ui';
import FadeInView from '../shared/ui/motion/FadeInView';
import { useAppTheme } from '../shared/theme/ThemeProvider';
import AppBottomNav from './navigation/AppBottomNav';

// Juegos que usan la cámara: se montan a pantalla completa, fuera del contenedor
// con insets, porque el visor ocupa todo y gestiona sus propios márgenes.
const CAMERA_GAMES = {
  practice: SignPracticeScreen,
  spelling: SpellingGameScreen,
  'camera-translation': CameraTranslationScreen,
  'dynamic-monitor': DynamicSignMonitorScreen,
};

const TAB_TITLES = {
  levels: 'Niveles',
  dictionary: 'Diccionario',
  videos: 'Videos',
  games: 'Juegos',
  progress: 'Progreso',
  profile: 'Perfil',
};

/**
 * Shell principal (usuario autenticado): cabecera, contenido de la pestaña
 * activa, juegos/niveles a pantalla completa y barra inferior.
 *
 * Navegación por estado: activeTab / activeGame / activeLevelId. El
 * contenido se monta en FadeInView con una key por destino, lo que da una
 * transición suave al cambiar de pestaña o entrar/salir de un nivel.
 */
export default function MainAppScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { auth, events } = useServices();
  const { user, refreshUser } = useSession();
  const { getLevelById, loading: catalogLoading } = useCatalog();
  const { isEnabled } = useRemoteConfig();
  const { confirm, notify, runBlocking } = useFeedback();
  const { levelProgress, stats, lives, isLoaded: progressLoaded } = useUserProgress(user?.id);

  const [activeTab, setActiveTab] = useState('levels');
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [editTrigger, setEditTrigger] = useState(0);

  // Si una pestaña se desactiva remotamente mientras está abierta, volver a Niveles.
  useEffect(() => {
    if (activeTab === 'videos' && !isEnabled('videos.enabled')) setActiveTab('levels');
  }, [activeTab, isEnabled]);

  const closeLevel = () => setActiveLevelId(null);
  const closeGame = () => setActiveGame(null);

  const openLevel = (levelId) => {
    if (lives.config.mode === 'pool' && lives.available <= 0) {
      notify({
        tone: 'warning',
        title: 'Sin vidas por ahora',
        message: 'Tus vidas se están recargando. Mientras, repasa el diccionario.',
      });
      return;
    }
    setActiveLevelId(levelId);
  };

  const handleLogout = async () => {
    setIsProfileMenuVisible(false);
    try {
      await confirm({
        title: '¿Cerrar sesión?',
        message: 'Tu progreso queda guardado en este dispositivo. Tendrás que ingresar de nuevo.',
        tone: 'danger',
        icon: 'log-out-outline',
        confirmLabel: 'Cerrar sesión',
        onConfirm: async () => {
          const result = await auth.signOut();
          if (!result.ok) throw new Error(result.error);
        },
      });
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo cerrar sesión', message: error.message });
    }
  };

  const handleLevelComplete = async (result) => {
    const nextLevel = getLevelById(result.levelId + 1);
    // Observer: useUserProgress escucha este evento y persiste el avance.
    await runBlocking('Guardando tu progreso…', async () => {
      events.emit(APP_EVENTS.LEVEL_COMPLETED, { result, nextLevel });
    });
    closeLevel();
  };

  const renderContent = () => {
    if (activeLevelId) {
      const level = getLevelById(activeLevelId);
      if (!level) return null;
      return (
        <LevelSessionScreen
          level={level}
          startingLives={lives.available}
          onBack={closeLevel}
          onComplete={handleLevelComplete}
          onLifeLost={() => events.emit(APP_EVENTS.LIFE_LOST, { amount: 1 })}
        />
      );
    }

    if (CAMERA_GAMES[activeGame]) return null; // se montan aparte, a pantalla completa
    if (activeGame === 'memory') return <MemoryGameScreen onBack={closeGame} />;
    if (activeGame === 'quiz') return <QuickQuizGameScreen onBack={closeGame} />;
    if (activeTab === 'dictionary') return <DictionaryTabScreen />;
    if (activeTab === 'videos') return <VideosTabScreen />;
    if (activeTab === 'games') return <GamesTabScreen onOpenGame={setActiveGame} />;
    if (activeTab === 'progress') {
      return <ProgressTabScreen levelProgress={levelProgress} userStats={stats} isLoading={!progressLoaded} />;
    }
    if (activeTab === 'profile') {
      return (
        <ProfileTabScreen user={user} onLogout={handleLogout} onRefreshUser={refreshUser} editTrigger={editTrigger} />
      );
    }
    return (
      <LevelsTabScreen
        levelProgress={levelProgress}
        onOpenLevel={openLevel}
        isLoading={catalogLoading && !progressLoaded}
        lives={lives}
      />
    );
  };

  // Los niveles y la memoria manejan su propio scroll (encabezado y botón
  // de verificar fijos); el diccionario es una FlatList virtualizada que no
  // debe anidarse en el ScrollView general.
  const usesFixedLayout = activeGame === 'memory' || Boolean(activeLevelId);
  const isDictionaryTab = activeTab === 'dictionary' && !activeGame && !activeLevelId;
  const showChrome = !activeGame && !activeLevelId;
  const contentKey = activeLevelId ? `level-${activeLevelId}` : activeGame || activeTab;
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <>
      {/* View plano, NO SafeAreaView: los insets se aplican una sola vez, a
          mano, en el header / el contenido / la barra inferior. */}
      <View style={styles.screen}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        {showChrome ? (
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View>
              <AppText variant="title" accessibilityRole="header">
                {TAB_TITLES[activeTab]}
              </AppText>
              <AppText variant="label" tone="brand">
                SeñaPlay
              </AppText>
            </View>
            <Pressable
              onPress={() => setIsProfileMenuVisible((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú de perfil"
              style={styles.profileTrigger}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <Ionicons name="person-circle-outline" size={36} color={theme.colors.textSecondary} />
              )}
            </Pressable>
          </View>
        ) : null}

        {usesFixedLayout ? (
          <View style={[styles.content, styles.flex, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
            <FadeInView key={contentKey} style={styles.flex}>
              {renderContent()}
            </FadeInView>
          </View>
        ) : isDictionaryTab ? (
          <View style={[styles.content, styles.flex, { paddingBottom: 0 }]}>
            <FadeInView key={contentKey} style={styles.flex}>
              {renderContent()}
            </FadeInView>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              activeGame ? { flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 } : null,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {showChrome ? <AnnouncementBanner /> : null}
            <FadeInView key={contentKey}>{renderContent()}</FadeInView>
          </ScrollView>
        )}

        {showChrome ? <AppBottomNav activeTab={activeTab} onChangeTab={setActiveTab} isEnabled={isEnabled} /> : null}

        <ProfileActionsModal
          visible={isProfileMenuVisible && showChrome}
          onClose={() => setIsProfileMenuVisible(false)}
          onEditProfile={() => {
            setActiveTab('profile');
            setIsProfileMenuVisible(false);
            setEditTrigger((prev) => prev + 1);
          }}
          onLogout={handleLogout}
        />
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
    flex: { flex: 1 },
    header: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.lg + 2,
      paddingBottom: theme.spacing.md + 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    profileTrigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: theme.colors.primary },
    content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md + 2, paddingBottom: theme.spacing.xxl },
  });
}
