// Racha diaria (pura). `today` en formato YYYY-MM-DD en hora LOCAL del
// dispositivo: con UTC, alguien que practica a las 22:00 en Chile (UTC-3/-4)
// quedaba registrado "mañana" y podía perder la racha sin razón.

export const EMPTY_STATS = Object.freeze({ streak: 0, lastActiveDate: null, totalDays: 0, bestStreak: 0 });

export function toLocalISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return toLocalISODate(new Date(y, m - 1, d - 1));
}

export function registerActivity(stats, today) {
  const base = { ...EMPTY_STATS, ...(stats || {}) };
  if (base.lastActiveDate === today) return base;
  const streak = base.lastActiveDate === previousDay(today) ? base.streak + 1 : 1;
  return {
    streak,
    lastActiveDate: today,
    totalDays: (base.totalDays || 0) + 1,
    bestStreak: Math.max(base.bestStreak || 0, streak),
  };
}

/** Racha vigente al mostrarla: si pasó más de un día sin actividad, es 0. */
export function currentStreak(stats, today) {
  if (!stats?.lastActiveDate) return 0;
  if (stats.lastActiveDate === today || stats.lastActiveDate === previousDay(today)) return stats.streak;
  return 0;
}
