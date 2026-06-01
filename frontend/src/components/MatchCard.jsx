import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';
import './MatchCard.css';

function formatEpochTime(epochMs) {
  if (!epochMs) return 'TBD';
  return new Date(epochMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(match.id);

  const isLive = match.is_live && match.match_time && match.match_time !== '-';

  // Format time to include seconds for live matches, or show kickoff time for upcoming
  const getTimeDisplay = () => {
     if (!isLive) return formatEpochTime(match.start_time);
    // match.match_time should be in MM:SS format from the API
    return match.match_time || '00:00';
  };

  return (
    <div className="match-card" onClick={() => navigate(`/match/${match.id}`)}>
      {/* Time with seconds on the left or kickoff time for upcoming */}
      <div className={`match-time ${!isLive ? 'not-started' : ''}`}>{getTimeDisplay()}</div>
      
      {/* Vertical separator */}
      <div className="match-separator"></div>
      
      {/* Teams stacked in the middle */}
      <div className="match-teams">
        <div className="match-team home">{match.home_team}</div>
        <div className="match-team away">{match.away_team}</div>
      </div>
      
      {/* Score container with scores stacked and button to the right - hide for upcoming matches */}
      <div className="score-container" >
        <div className={`score-column ${!isLive ? 'hidden' : ''}`} >
          <div className="match-score home">{match.home_score}</div>
          <div className="match-score away">{match.away_score}</div>
        </div>
        <div className="match-separator"></div>
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
