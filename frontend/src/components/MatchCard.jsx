import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';
import './MatchCard.css';

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(match.id);

  const isLive = match.is_live && match.match_time && match.match_time !== '-';

  // Format time to include seconds for live matches
  const getTimeDisplay = () => {
    if (!isLive) return '';
    // match.match_time should be in MM:SS format from the API
    return match.match_time || '00:00';
  };

  return (
    <div className="match-card" onClick={() => navigate(`/match/${match.id}`)}>
      {/* Time with seconds on the left */}
      <div className="match-time">{getTimeDisplay()}</div>
      
      {/* Vertical separator */}
      <div className="match-separator"></div>
      
      {/* Teams stacked in the middle */}
      <div className="match-teams">
        <div className="match-team home">{match.home_team}</div>
        <div className="match-team away">{match.away_team}</div>
      </div>
      
      {/* Score and favorite on the right */}
      <div className="match-score-fav">
        <div className="match-score">
          <span className="home-score">{match.home_score}</span>
          <span className="score-divider">–</span>
          <span className="away-score">{match.away_score}</span>
        </div>
        <button 
          className={`fav-btn ${fav ? 'fav-on' : 'fav-off'}`}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(match.id); }}
          title={fav ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
}
