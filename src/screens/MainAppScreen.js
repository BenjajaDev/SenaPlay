import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../backend/supabase';
import { getLevelProgress, recordDailyActivity, saveLevelProgress } from '../../backend/userStats';
import AdaptiveModal from '../components/AdaptiveModal';
import AppBottomNav from '../components/AppBottomNav';
import ProfileActionsModal from '../components/ProfileActionsModal';
import LevelsTabScreen from './tabs/LevelsTabScreen';
import DictionaryTabScreen from './tabs/DictionaryTabScreen';
import VideosTabScreen from './tabs/VideosTabScreen';
import GamesTabScreen from './tabs/GamesTabScreen';
import ProgressTabScreen from './tabs/ProgressTabScreen';
import ProfileTabScreen from './tabs/ProfileTabScreen';
import MemoryGameScreen from './games/MemoryGameScreen';
import QuickQuizGameScreen from './games/QuickQuizGameScreen';
import Hand3DGameScreen from './games/Hand3DGameScreen';
import LevelSessionScreen from './levels/LevelSessionScreen';
import { getLevelById } from '../data/levelsConfig';
import { useAppTheme } from '../theme/ThemeProvider';

const DEFAULT_LEVEL_PROGRESS = { unlocked: [1], completed: {} };

export default function MainAppScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState('levels');
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
    if (activeGame === 'hand3d') return 'Juego Mano 3D';
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
            closeLevel();
          }}
        />
      );
    }

    if (activeGame === 'hand3d') return null;
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

  const usesVirtualizedList = activeGame === 'memory';

  return (
    <>
      <SafeAreaView style={styles.screen}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        {!activeGame && !activeLevelId ? (
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View>
              <Text style={styles.headerTitle}>{tabTitle}</Text>
              <Text style={styles.headerSubtitle}>OratioLingo</Text>
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

        {usesVirtualizedList ? (
          <View
            style={[
              styles.contentContainer,
              { flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
            ]}
          >
            {renderContent()}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              activeGame || activeLevelId
                ? { flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }
                : null,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
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
      </SafeAreaView>

      {activeGame === 'hand3d' && (
        <View style={StyleSheet.absoluteFill}>
          <Hand3DGameScreen onBack={closeGame} />
        </View>
      )}
    </>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
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
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
    headerSubtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    profileTrigger: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    contentContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  });
}
