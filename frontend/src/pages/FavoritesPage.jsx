import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MatchList from '../components/MatchList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import './FavoritesPage.css';

export default function FavoritesPage() {
  const { favoriteIds } = useFavorites();
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllMatches();
  }, []);

  const fetchAllMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAllFootballMatches();
      setAllMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
      setAllMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const favoriteMatches = useMemo(() => {
    const favSet = new Set(favoriteIds);
    return allMatches.filter(m => favSet.has(m.id));
  }, [allMatches, favoriteIds]);

  const liveCount = favoriteMatches.filter(m => m.status === 'Live').length;
  const upcomingCount = favoriteMatches.filter(m => m.status === 'Not Started').length;
  const finishedCount = favoriteMatches.filter(m => m.status === 'Finished').length;

  return (
    <div className="favorites-page">
      <div className="page-header">
        <h1>⭐ Favorite Matches</h1>
        <p>Matches you've bookmarked</p>
      </div>

      <div className="page-navigation">
        <Link to="/" className="nav-link">
          Live Matches
        </Link>
        <Link to="/all-matches" className="nav-link">
          All Matches
        </Link>
        <Link to="/favorites" className="nav-link active">
          ☆ Favorites
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
                    {favoriteMatches.length} favorite match{favoriteMatches.length !== 1 ? 'es' : ''} ·
                    <span className="fav-live"> {liveCount} Live</span> ·
                    <span className="fav-upcoming"> {upcomingCount} Upcoming</span> ·
                    <span className="fav-finished"> {finishedCount} Finished</span>
                  </span>
                </div>
                <MatchList matches={favoriteMatches} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
