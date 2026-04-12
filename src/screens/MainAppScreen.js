import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LEVEL_PROGRESS_KEY = 'oratiolingo.level.progress.v1';

const DEFAULT_LEVEL_PROGRESS = {
  unlocked: [1],
  completed: {},
};

export default function MainAppScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('levels');
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [levelProgress, setLevelProgress] = useState(DEFAULT_LEVEL_PROGRESS);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    context: 'auth-error',
    message: '',
  });

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) {
        return;
      }
      setUserEmail(data?.user?.email || '');
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLevelProgress = async () => {
      try {
        const raw = await AsyncStorage.getItem(LEVEL_PROGRESS_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.unlocked) || typeof parsed.completed !== 'object') {
          return;
        }

        setLevelProgress(parsed);
      } catch (err) {
        // Keep default if local progress is corrupted.
      }
    };

    loadLevelProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(levelProgress));
  }, [levelProgress]);

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

  const openLevel = (levelId) => {
    setActiveLevelId(levelId);
  };

  const closeLevel = () => {
    setActiveLevelId(null);
  };

  const openGame = (gameId) => {
    setActiveGame(gameId);
  };

  const closeGame = () => {
    setActiveGame(null);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        setFeedbackModal({
          visible: true,
          context: 'auth-error',
          message: error.message,
        });
        return;
      }
      setIsProfileModalVisible(false);
      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      setFeedbackModal({
        visible: true,
        context: 'auth-error',
        message: 'No se pudo cerrar sesion. Intentalo de nuevo.',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const renderContent = () => {
    if (activeLevelId) {
      const level = getLevelById(activeLevelId);
      if (!level) {
        return null;
      }

      return (
        <LevelSessionScreen
          level={level}
          onBack={closeLevel}
          onComplete={({ levelId, score, hits, fails }) => {
            const nextLevelId = levelId + 1;

            setLevelProgress((prev) => {
              const unlockedSet = new Set(prev.unlocked || [1]);
              unlockedSet.add(levelId);
              if (getLevelById(nextLevelId)?.available) {
                unlockedSet.add(nextLevelId);
              }

              return {
                unlocked: Array.from(unlockedSet).sort((a, b) => a - b),
                completed: {
                  ...prev.completed,
                  [levelId]: {
                    score,
                    hits,
                    fails,
                  },
                },
              };
            });

            closeLevel();
          }}
        />
      );
    }

    if (activeGame === 'memory') {
      return <MemoryGameScreen onBack={closeGame} />;
    }
    if (activeGame === 'quiz') {
      return <QuickQuizGameScreen onBack={closeGame} />;
    }
    if (activeGame === 'hand3d') {
      return <Hand3DGameScreen onBack={closeGame} />;
    }
    if (activeTab === 'dictionary') return <DictionaryTabScreen />;
    if (activeTab === 'videos') return <VideosTabScreen />;
    if (activeTab === 'games') return <GamesTabScreen onOpenGame={openGame} />;
    if (activeTab === 'progress') return <ProgressTabScreen />;
    if (activeTab === 'profile') {
      return (
        <ProfileTabScreen
          userEmail={userEmail}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      );
    }
    return <LevelsTabScreen levelProgress={levelProgress} onOpenLevel={openLevel} />;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
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
            <Ionicons name="person-circle-outline" size={34} color="#334155" />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          activeGame || activeLevelId
            ? {
                flexGrow: 1,
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 12,
              }
            : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {!activeGame && !activeLevelId ? <AppBottomNav activeTab={activeTab} onChangeTab={setActiveTab} /> : null}

      <ProfileActionsModal
        visible={isProfileModalVisible && !activeGame && !activeLevelId}
        onClose={() => setIsProfileModalVisible(false)}
        onEditProfile={() => {
          setActiveTab('profile');
          setIsProfileModalVisible(false);
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  profileTrigger: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
});
