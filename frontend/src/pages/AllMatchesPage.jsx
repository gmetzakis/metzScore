import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import LeagueGroupedList from '../components/LeagueGroupedList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import './AllMatchesPage.css';

export default function AllMatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const isInitialLoad = useRef(true);

  const fetchAllMatches = useCallback(async () => {
    if (isInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await apiService.getAllFootballMatches();
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
    fetchAllMatches();
    const interval = setInterval(fetchAllMatches, 5000);
    return () => clearInterval(interval);
  }, [fetchAllMatches]);

  const filteredMatches = useMemo(() => {
    let list = matches.filter(m => m.status === 'Not Started');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.home_team || '').toLowerCase().includes(q) ||
        (m.away_team || '').toLowerCase().includes(q) ||
        (m.league || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [matches, search]);



  return (
    <div className="upcoming-matches-page">
      <div className="page-header">
        <h1>⚽ Upcoming Football Matches</h1>
        <p>Browse all upcoming matches</p>
      </div>

      <div className="page-navigation">
        <Link to="/" className="nav-link">
          Live Matches
        </Link>
        <Link to="/upcoming-matches" className="nav-link active">
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
                {search && ` matching "${search}"`}
              </span>
            </div>
            <LeagueGroupedList matches={filteredMatches} />
          </>
        )}
      </div>
    </div>
  );
}