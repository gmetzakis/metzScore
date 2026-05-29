import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';
import './MatchCard.css';
import OddsDisplay from './OddsDisplay';

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [showOdds, setShowOdds] = useState(false);
  const fav = isFavorite(match.id);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Live':
        return 'live';
      case 'Finished':
        return 'finished';
      default:
        return 'upcoming';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'TBA';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const isLive = match.is_live && match.match_time && match.match_time !== '-';

  return (
    <div className="match-card" onClick={() => navigate(`/match/${match.id}`)}>
      {/* Status indicator */}
      <span className={`match-status ${getStatusColor(match.status)}`}>
        {match.status}
      </span>

      {/* Favorite button */}
      <button
        className={`fav-btn ${fav ? 'fav-on' : 'fav-off'}`}
        onClick={(e) => { e.stopPropagation(); toggleFavorite(match.id); }}
        title={fav ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      >
        {fav ? '★' : '☆'}
      </button>

      {/* League/Competition */}
      <span className="match-league">{match.league}</span>

      {/* Time */}
      <span className="match-time">
        {isLive ? (
          <>
            <span className="live-indicator" aria-label="Live"></span>
            {match.match_time}
          </>
        ) : (
          formatTime(match.start_time)
        )}
      </span>

      {/* Teams and Score */}
      <div className="teams-score">
        <span className="team-name home-team">{match.home_team}</span>
        <span className="score">{match.home_score}</span>
        <span className="score-divider">–</span>
        <span className="score">{match.away_score}</span>
        <span className="team-name away-team">{match.away_team}</span>
      </div>
    </div>
  );
}
