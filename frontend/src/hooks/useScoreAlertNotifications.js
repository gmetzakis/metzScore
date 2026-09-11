import { useEffect, useRef } from 'react';
import { useFavorites } from '../context/FavoritesContext';

function normalizeScore(score) {
  if (score === null || score === undefined || score === '') return '0';
  return String(score);
}

function formatGoalMinute(matchTime) {
  if (matchTime === null || matchTime === undefined || matchTime === '') return 'Live';
  const value = String(matchTime).trim();
  if (value.includes('+')) {
    const [baseRaw, extraRaw] = value.split('+');
    const base = parseInt(baseRaw, 10);
    const extra = parseInt(extraRaw, 10);
    if (!Number.isNaN(base) && !Number.isNaN(extra)) {
      return `${base}+${extra}'`;
    }
  }
  if (value.includes(':')) {
    const [minsRaw, secsRaw] = value.split(':');
    const mins = parseInt(minsRaw, 10);
    const secs = parseInt(secsRaw, 10);
    if (!Number.isNaN(mins) && !Number.isNaN(secs)) {
      return `${secs > 0 ? mins + 1 : mins}'`;
    }
  }
  const numeric = parseInt(value, 10);
  if (!Number.isNaN(numeric)) {
    return `${numeric}'`;
  }
  return 'Live';
}

function getNotificationTitle(match) {
  const minute = formatGoalMinute(match.match_time);
  return `${minute} Goal`;
}

function getNotificationBody(previous, match) {
  const minute = formatGoalMinute(match.match_time);
  return `${minute} — ${match.home_team} ${previous.home}:${previous.away} → ${match.home_team} ${match.home_score}:${match.away_score} ${match.away_team}`;
}

function sendBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notificationIcon = '/icons/logo2.png';
  const notificationOptions = {
    body,
    tag: 'metzscore',
    renotify: true,
    icon: notificationIcon,
    badge: notificationIcon,
  };

  try {
    // Prefer showing via a registered service worker on mobile (Android Chrome)
    // because some mobile browsers restrict direct Notification usage.
    if ('serviceWorker' in navigator) {
      // Try existing registration first
      try {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg && reg.showNotification) {
            reg.showNotification(title, notificationOptions);
            return;
          }
          // If no registration, try registering one on-the-fly
          navigator.serviceWorker.register('/sw.js').then((newReg) => {
            if (newReg && newReg.showNotification) {
              newReg.showNotification(title, notificationOptions);
            }
          }).catch(() => {
            // fallback to in-page notification if registration fails
            try { new Notification(title, { ...notificationOptions, icon: notificationIcon, badge: notificationIcon }); } catch {}
          });
        }).catch(() => {
          try { new Notification(title, { ...notificationOptions, icon: notificationIcon, badge: notificationIcon }); } catch {}
        });
        return;
      } catch {
        // fallthrough to direct Notification below
      }
    }

    new Notification(title, { ...notificationOptions, icon: notificationIcon, badge: notificationIcon });
  } catch {
    // ignore failures
  }
}

export default function useScoreAlertNotifications(matches) {
  const { alertIds, alertModes, removeAlerts } = useFavorites();
  const prevScoresRef = useRef(new Map());
  const hasRequestedPermissionRef = useRef(false);
  const hasRegisteredSWRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (hasRequestedPermissionRef.current) return;

    const tryRegisterSW = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        // register only once
        if (!hasRegisteredSWRef.current) {
          await navigator.serviceWorker.register('/sw.js');
          hasRegisteredSWRef.current = true;
        }
      } catch {
        // ignore registration failures
      }
    };

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          tryRegisterSW();
        }
      }).catch(() => {});
    } else if (Notification.permission === 'granted') {
      tryRegisterSW();
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
        
        // const homeDiff = Number(current.home) - Number(previous.home);
        // const awayDiff = Number(current.away) - Number(previous.away);
        // if (homeDiff > 0 || awayDiff > 0) {
        //   const mode = alertModes[String(match.id)] || 'all';
        //   const shouldNotify =
        //     mode === 'all' ||
        //     (mode === 'home' && homeDiff > 0) ||
        //     (mode === 'away' && awayDiff > 0);

        //   if (shouldNotify) {
        //     const title = getNotificationTitle(match);
        //     const body = getNotificationBody(previous, match);
        //     sendBrowserNotification(title, body);
        //   }
        // }



        const mode = alertModes[String(match.id)] || 'all';
        const shouldNotify =
          mode === 'all' ||
          (mode === 'home' && previous.home !== current.home) ||
          (mode === 'away' && previous.away !== current.away);

        if (shouldNotify) {
          const minute = formatGoalMinute(match.match_time);
          if (mode === 'all') {
            if (previous.home < current.home || previous.away < current.away) {
              // Score has increased
              const title = current.home > previous.home ? `Goal: ${match.home_team}` : `Goal: ${match.away_team}`;
              const body = current.home > previous.home ? `${match.home_team} [${match.home_score}]-${match.away_score} ${match.away_team}` : `${match.home_team} ${match.home_score}-[${match.away_score}] ${match.away_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }

            if (previous.home > current.home || previous.away > current.away) {
              // Score has decreased
              const title = current.home < previous.home ? `Cancelled Goal: ${match.home_team}` : `Cancelled Goal: ${match.away_team}`;
              const body = current.home < previous.home ? `${match.home_team} [${match.home_score}]-${match.away_score} ${match.away_team}` : `${match.home_team} ${match.home_score}-[${match.away_score}] ${match.away_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }
          }

          else if (mode === 'home') {
            if (previous.home < current.home) {
              const title = `Goal: ${match.home_team}`;
              //const body = `${match.home_team}: ${previous.home} → ${match.home_score}`;
              const body = `Goal no. ${match.home_score} for ${match.home_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }
            else if (previous.home > current.home) {
              const title = `Cancelled Goal: ${match.home_team}`;
              //const body = `${match.home_team}: ${previous.home} → ${match.home_score}`;
              const body = `Cancelled Goal no. ${previous.home} for ${match.home_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }
          }

          else if (mode === 'away') {
            if (previous.away < current.away) {
              const title = `Goal: ${match.away_team}`;
              //const body = `${match.away_team}: ${previous.away} → ${match.away_score}`;
              const body = `Goal no. ${match.away_score} for ${match.away_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }
            else if (previous.away > current.away) {
              const title = `Cancelled Goal: ${match.away_team}`;
              //const body = `${match.away_team}: ${previous.away} → ${match.away_team}`;
              const body = `Cancelled Goal no. ${previous.away} for ${match.away_team}`;
              sendBrowserNotification(`${minute} ${title}`, body);
            }
          }
        }
      }

      prevScoresRef.current.set(match.id, current);
    });

    for (const trackedId of Array.from(prevScoresRef.current.keys())) {
      if (!currentAlertMatchIds.has(trackedId) && !activeAlerts.has(trackedId)) {
        prevScoresRef.current.delete(trackedId);
      }
    }

    if (alertIds.length && activeAlerts.size && currentAlertMatchIds.size !== alertIds.length) {
      const missingAlerts = alertIds.filter((id) => !currentAlertMatchIds.has(id));
      if (missingAlerts.length) {
        removeAlerts(missingAlerts);
      }
    }
  }, [matches, alertIds, alertModes, removeAlerts]);
}
