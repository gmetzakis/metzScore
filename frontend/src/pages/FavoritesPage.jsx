import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import LeagueGroupedList from '../components/LeagueGroupedList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import useScoreAlertNotifications from '../hooks/useScoreAlertNotifications';
import { useFavorites } from '../context/FavoritesContext';
import './FavoritesPage.css';

export default function FavoritesPage() {
  const { favoriteIds, clearAllFavorites, removeFavorites } = useFavorites();
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialLoad = useRef(true);

  const fetchAllMatches = useCallback(async () => {
    if (isInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await apiService.getAllFootballMatches();
      setAllMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
      if (!isInitialLoad.current) {
        setAllMatches([]);
      }
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAllMatches();
    const interval = setInterval(fetchAllMatches, 5000);
    return () => clearInterval(interval);
  }, [fetchAllMatches]);

  const favoriteMatches = useMemo(() => {
    const favSet = new Set(favoriteIds);
    return allMatches.filter(m => favSet.has(m.id));
  }, [allMatches, favoriteIds]);

  useEffect(() => {
    if (!allMatches.length || !favoriteIds.length) return;
    const currentIds = new Set(allMatches.map(m => m.id));
    const missingFavoriteIds = favoriteIds.filter(id => !currentIds.has(id));
    if (missingFavoriteIds.length) {
      removeFavorites(missingFavoriteIds);
    }
  }, [allMatches, favoriteIds, removeFavorites]);

  useScoreAlertNotifications(favoriteMatches);

  const liveCount = favoriteMatches.filter(m => m.status === 'Live').length;
  const upcomingCount = favoriteMatches.filter(m => m.status === 'Not Started').length;
  const finishedCount = favoriteMatches.filter(m => m.status === 'Finished').length;

  return (
    <div className="favorites-page">
      <div className="page-header">
        <h1>MetzScore</h1>
      </div>

      <div className="page-navigation">
        <Link to="/" className="nav-link">
          Live Matches
        </Link>
        <Link to="/upcoming-matches" className="nav-link">
          Upcoming Matches
        </Link>
        <Link to="/favorites" className="nav-link active">
          ☆ Favorites
        </Link>
        <button className="favorites-clear-btn" onClick={clearAllFavorites} disabled={!favoriteIds.length}>
          Clear favorites
        </button>
      </div>

      <div className="page-content">
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {!loading && !error && (
          <>
            {favoriteMatches.length === 0 ? (
              <div className="empty-favorites">
                <p>When you favorite a match, it will appear here.</p>
              </div>
            ) : (
              <>
                <div className="matches-info">
                  <span>
                    {favoriteMatches.length} favorite match{favoriteMatches.length !== 1 ? 'es' : ''} ·
                    <span className="fav-live"> {liveCount} Live</span> ·
                    <span className="fav-upcoming"> {upcomingCount} Upcoming</span> ·
                    <span className="fav-finished"> {finishedCount} Finished</span>
                  </span>
                </div>
                <LeagueGroupedList matches={favoriteMatches} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}