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
      </div>

      <div className="page-content">
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {!loading && !error && (
          <>
            <div className="matches-info">
              <span>{matches.length} matches found</span>
            </div>
            <MatchList matches={matches} />
          </>
        )}
      </div>
    </div>
  );
}
