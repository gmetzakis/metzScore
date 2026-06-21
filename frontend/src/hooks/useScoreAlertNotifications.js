import { useEffect, useRef } from 'react';
import { useFavorites } from '../context/FavoritesContext';

function normalizeScore(score) {
  if (score === null || score === undefined || score === '') return '0';
  return String(score);
}

function getNotificationTitle(match) {
  return `Score update: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`;
}

function getNotificationBody(prevScore, match) {
  return `${match.home_team} ${prevScore.home}:${prevScore.away} → ${match.home_team} ${match.home_score}:${match.away_score}`;
}

function sendBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body });
  } catch {
    // ignore failures
  }
}

export default function useScoreAlertNotifications(matches) {
  const { alertIds } = useFavorites();
  const prevScoresRef = useRef(new Map());
  const hasRequestedPermissionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (hasRequestedPermissionRef.current) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    hasRequestedPermissionRef.current = true;
  }, []);

  useEffect(() => {
    if (!matches || !matches.length || !alertIds || !alertIds.length) {
      return;
    }

    const activeAlerts = new Set(alertIds);
    const currentAlertMatchIds = new Set();

    matches.forEach((match) => {
      if (!activeAlerts.has(match.id)) return;
      currentAlertMatchIds.add(match.id);

      const previous = prevScoresRef.current.get(match.id);
      const current = {
        home: normalizeScore(match.home_score),
        away: normalizeScore(match.away_score),
      };

      if (previous && (previous.home !== current.home || previous.away !== current.away)) {
        const title = getNotificationTitle(match);
        const body = getNotificationBody(previous, match);
        sendBrowserNotification(title, body);
      }

      prevScoresRef.current.set(match.id, current);
    });

    for (const trackedId of Array.from(prevScoresRef.current.keys())) {
      if (!currentAlertMatchIds.has(trackedId) && !activeAlerts.has(trackedId)) {
        prevScoresRef.current.delete(trackedId);
      }
    }
  }, [matches, alertIds]);
}
