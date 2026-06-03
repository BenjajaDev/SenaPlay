import AsyncStorage from '@react-native-async-storage/async-storage';

const LP_PREFIX = 'oratiolingo.level.progress.v1';
const STATS_PREFIX = 'oratiolingo.stats.v1';

export const getLevelProgressKey = (userId) => `${LP_PREFIX}.${userId}`;
const getStatsKey = (userId) => `${STATS_PREFIX}.${userId}`;

const todayISO = () => new Date().toISOString().split('T')[0];

export async function recordDailyActivity(userId) {
  const key = getStatsKey(userId);
  const today = todayISO();
  try {
    const raw = await AsyncStorage.getItem(key);
    const stats = raw ? JSON.parse(raw) : { streak: 0, lastActiveDate: null, totalDays: 0 };
    if (stats.lastActiveDate === today) return stats;

    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const ydStr = yd.toISOString().split('T')[0];

    const newStreak = stats.lastActiveDate === ydStr ? stats.streak + 1 : 1;
    const updated = {
      streak: newStreak,
      lastActiveDate: today,
      totalDays: (stats.totalDays || 0) + 1,
    };
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return { streak: 1, lastActiveDate: today, totalDays: 1 };
  }
}

export async function getUserStats(userId) {
  const key = getStatsKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : { streak: 0, lastActiveDate: null, totalDays: 0 };
  } catch {
    return { streak: 0, lastActiveDate: null, totalDays: 0 };
  }
}

export async function getLevelProgress(userId) {
  const key = getLevelProgressKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { unlocked: [1], completed: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.unlocked) || typeof parsed.completed !== 'object') {
      return { unlocked: [1], completed: {} };
    }
    return parsed;
  } catch {
    return { unlocked: [1], completed: {} };
  }
}

export async function saveLevelProgress(userId, progress) {
  const key = getLevelProgressKey(userId);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(progress));
  } catch { /* silent */ }
}
