import { useState, useEffect, useMemo } from 'react';
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
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAllMatches();
  }, []);

  const fetchAllMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAllFootballMatches();
      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = useMemo(() => {
    let list = matches;
    if (filter === 'Live') list = list.filter(m => m.status === 'Live');
    else if (filter === 'Not Started') list = list.filter(m => m.status === 'Not Started');
    else if (filter === 'Finished') list = list.filter(m => m.status === 'Finished');

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.home_team || '').toLowerCase().includes(q) ||
        (m.away_team || '').toLowerCase().includes(q) ||
        (m.league || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [matches, filter, search]);

  const liveCount = matches.filter(m => m.status === 'Live').length;
  const upcomingCount = matches.filter(m => m.status === 'Not Started').length;
  const finishedCount = matches.filter(m => m.status === 'Finished').length;

  return (
    <div className="all-matches-page">
      <div className="page-header">
        <h1>⚽ All Football Matches</h1>
        <p>Browse all available matches</p>
      </div>

      <div className="page-navigation">
        <Link to="/" className="nav-link">
          Live Matches
        </Link>
        <Link to="/all-matches" className="nav-link active">
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

      <div className="filter-tabs">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({matches.length})
        </button>
        <button
          className={`filter-btn ${filter === 'Live' ? 'active' : ''}`}
          onClick={() => setFilter('Live')}
        >
          Live ({liveCount})
        </button>
        <button
          className={`filter-btn ${filter === 'Not Started' ? 'active' : ''}`}
          onClick={() => setFilter('Not Started')}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          className={`filter-btn ${filter === 'Finished' ? 'active' : ''}`}
          onClick={() => setFilter('Finished')}
        >
          Finished ({finishedCount})
        </button>
      </div>

      <div className="page-content">
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {!loading && !error && (
          <>
            <div className="matches-info">
              <span>
                {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} found
                {filter !== 'all' && ` (${filter})`}
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
