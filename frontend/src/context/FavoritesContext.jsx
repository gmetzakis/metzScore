import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const FavoritesContext = createContext(null);

const STORAGE_KEY = 'metzScore-favorites';
const ALERTS_STORAGE_KEY = 'metzScore-alerts';
const ALERT_MODES_STORAGE_KEY = 'metzScore-alert-modes';

export function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [alertIds, setAlertIds] = useState(() => {
    try {
      const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [alertModes, setAlertModes] = useState(() => {
    try {
      const stored = localStorage.getItem(ALERT_MODES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch { /* ignore */ }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alertIds));
    } catch { /* ignore */ }
  }, [alertIds]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERT_MODES_STORAGE_KEY, JSON.stringify(alertModes));
    } catch { /* ignore */ }
  }, [alertModes]);

  useEffect(() => {
    if (alertIds.length === 0) return;
    setFavoriteIds(prev => {
      const missing = alertIds.filter(id => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [alertIds]);

  const isFavorite = useCallback((matchId) => favoriteIds.includes(matchId), [favoriteIds]);
  const isAlert = useCallback((matchId) => alertIds.includes(matchId), [alertIds]);
  const getAlertMode = useCallback((matchId) => alertModes[String(matchId)] || 'all', [alertModes]);

  const toggleFavorite = useCallback((matchId) => {
    setFavoriteIds(prev => {
      if (prev.includes(matchId)) {
        setAlertIds(prevAlerts => prevAlerts.filter(id => id !== matchId));
        return prev.filter(id => id !== matchId);
      }
      return [...prev, matchId];
    });
  }, []);

  const toggleAlert = useCallback((matchId) => {
    setAlertIds(prev => {
      const hasAlert = prev.includes(matchId);
      if (hasAlert) {
        return prev.filter(id => id !== matchId);
      }
      setFavoriteIds(prevFavs => prevFavs.includes(matchId) ? prevFavs : [...prevFavs, matchId]);
      return [...prev, matchId];
    });
  }, []);

  const setAlertMode = useCallback((matchId, mode) => {
    setAlertModes(prev => ({ ...prev, [String(matchId)]: mode }));
  }, []);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, alertIds, alertModes, isFavorite, isAlert, getAlertMode, toggleFavorite, toggleAlert, setAlertMode }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
