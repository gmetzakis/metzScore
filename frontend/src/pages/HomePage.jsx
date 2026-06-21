import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import LeagueGroupedList from '../components/LeagueGroupedList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import './HomePage.css';

export default function HomePage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const isInitialLoad = useRef(true);

  const fetchLiveMatches = useCallback(async () => {
    if (isInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await apiService.getLiveFootballMatches();
      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
      if (!isInitialLoad.current) {
        setMatches([]);
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
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveMatches]);

  const filteredMatches = matches.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.home_team || '').toLowerCase().includes(q) ||
      (m.away_team || '').toLowerCase().includes(q) ||
      (m.league || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="home-page">
      <div className="page-navigation">
        <Link to="/" className="nav-link active">
          Live Matches
        </Link>
        <Link to="/upcoming-matches" className="nav-link">
          Upcoming Matches
        </Link>
        <Link to="/favorites" className="nav-link">
          ☆ Favorites
        </Link>
      </div>

      <div className="search-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Search by team or league name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            ✕
          </button>
        )}
      </div>

      <div className="page-content">
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {!loading && !error && (
          <>
            <div className="matches-info">
              <span>
                {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} found
                {search && ` for "${search}"`}
              </span>
            </div>
            <LeagueGroupedList matches={filteredMatches} />
          </>
        )}
      </div>
    </div>
  );
}