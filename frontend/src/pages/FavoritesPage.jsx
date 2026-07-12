import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import LeagueGroupedList from '../components/LeagueGroupedList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import './FavoritesPage.css';

export default function FavoritesPage() {
  const { favoriteIds, clearAllFavorites, removeFavorites } = useFavorites();
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [bulkAction, setBulkAction] = useState({ id: 0, type: null });
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

  const safeFavoriteIds = Array.isArray(favoriteIds) ? favoriteIds : [];

  const favoriteMatches = useMemo(() => {
    const favSet = new Set(safeFavoriteIds);
    return allMatches.filter(m => 
      favSet.has(m.id) &&
      m.home_team && m.home_team.toLowerCase() !== 'unknown' &&
      m.away_team && m.away_team.toLowerCase() !== 'unknown'
    );
  }, [allMatches, safeFavoriteIds]);

  useEffect(() => {
    if (!allMatches.length || !safeFavoriteIds.length) return;
    const currentIds = new Set(allMatches.map(m => m.id));
    const missingFavoriteIds = safeFavoriteIds.filter(id => !currentIds.has(id));
    if (missingFavoriteIds.length) {
      removeFavorites(missingFavoriteIds);
    }
  }, [allMatches, safeFavoriteIds, removeFavorites]);

  const liveCount = favoriteMatches.filter(m => m.status === 'Live').length;
  const upcomingCount = favoriteMatches.filter(m => m.status === 'Not Started').length;
  const finishedCount = favoriteMatches.filter(m => m.status === 'Finished').length;

  return (
    <div className="favorites-page">
      <div className="page-navigation">
        <Link to="/" className="nav-link">
          <img src="/mobile_icons/live-svgrepo-com.svg" alt="" className="nav-icon" />
          <span className="nav-label">Live Matches</span>
        </Link>
        <Link to="/upcoming-matches" className="nav-link">
          <img src="/mobile_icons/schedule-svgrepo-com.svg" alt="" className="nav-icon" />
          <span className="nav-label">Upcoming</span>
        </Link>
        <Link to="/favorites" className="nav-link active">
          <img src="/mobile_icons/star-svgrepo-com.svg" alt="" className="nav-icon" />
          <span className="nav-label">Favorites</span>
        </Link>
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
                    {favoriteMatches.length} match{favoriteMatches.length !== 1 ? 'es' : ''} ·
                    <span className="fav-live"> {liveCount} Live</span> ·
                    <span className="fav-upcoming"> {upcomingCount} Upcoming</span>
                  </span>
                  <button
                    className="favorites-toggle-btn"
                    onClick={() => {
                      const nextType = allExpanded ? 'collapse' : 'expand';
                      setAllExpanded((prev) => !prev);
                      setBulkAction((prev) => ({ id: prev.id + 1, type: nextType }));
                    }}
                  >
                    {allExpanded ? 'Collapse all' : 'Expand all'}
                  </button>
                </div>
                <button className="favorites-clear-btn" onClick={clearAllFavorites} disabled={!favoriteIds.length}>
                  Clear favorites
                </button>
                <LeagueGroupedList matches={favoriteMatches} bulkAction={bulkAction} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}