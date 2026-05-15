import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MatchList from '../components/MatchList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import { apiService } from '../services/api';
import './AllMatchesPage.css';

export default function AllMatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, live, upcoming, finished

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

  const getFilteredMatches = () => {
    if (filter === 'all') return matches;
    return matches.filter((match) => match.status === filter);
  };

  const filteredMatches = getFilteredMatches();
  const liveCount = matches.filter((m) => m.status === 'Live').length;
  const upcomingCount = matches.filter((m) => m.status === 'Not Started').length;
  const finishedCount = matches.filter((m) => m.status === 'Finished').length;

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
              <span>{filteredMatches.length} matches found</span>
            </div>
            <MatchList matches={filteredMatches} />
          </>
        )}
      </div>
    </div>
  );
}
