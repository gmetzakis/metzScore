import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MatchList from '../components/MatchList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import './HomePage.css';

export default function HomePage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLiveMatches();
  }, []);

  const fetchLiveMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getLiveFootballMatches();
      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="page-header">
        <h1>⚽ Live Football Matches</h1>
        <p>Real-time updates from matches in progress</p>
      </div>

      <div className="page-navigation">
        <Link to="/" className="nav-link active">
          Live Matches
        </Link>
        <Link to="/all-matches" className="nav-link">
          All Matches
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
            <MatchList matches={filteredMatches} />
          </>
        )}
      </div>
    </div>
  );
}
