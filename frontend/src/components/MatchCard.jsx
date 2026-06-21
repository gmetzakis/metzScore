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
  const { isFavorite, isAlert, getAlertMode, toggleFavorite, toggleAlert, setAlertMode } = useFavorites();
  const fav = isFavorite(match.id);
  const alert = isAlert(match.id);
  const alertMode = getAlertMode(match.id);
  const [showAlertConfig, setShowAlertConfig] = useState(false);

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
        <div className="alert-button-wrapper">
          <button 
            className={`action-btn alert-btn ${alert ? 'alert-on' : 'alert-off'}`}
            onClick={(e) => { e.stopPropagation(); toggleAlert(match.id); }}
            title={alert ? 'Disable alerts for this match' : 'Enable alerts for this match'}
            aria-label={alert ? 'Disable alerts for this match' : 'Enable alerts for this match'}
          >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 19C8.89555 19 7.01237 19 5.61714 19C4.87375 19 4.39116 18.2177 4.72361 17.5528L5.57771 15.8446C5.85542 15.2892 6 14.6774 6 14.0564C6 13.2867 6 12.1434 6 11C6 9 7 5 12 5C17 5 18 9 18 11C18 12.1434 18 13.2867 18 14.0564C18 14.6774 18.1446 15.2892 18.4223 15.8446L19.2764 17.5528C19.6088 18.2177 19.1253 19 18.382 19H14.5M9.5 19C9.5 21 10.5 22 12 22C13.5 22 14.5 21 14.5 19M9.5 19C11.0621 19 14.5 19 14.5 19" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.3}/>
              <path d="M12 5V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3}/>
            </svg>
          </button>
          {alert && (
            <>
              <button
                className="alert-config-toggle"
                onClick={(e) => { e.stopPropagation(); setShowAlertConfig(prev => !prev); }}
                title="Customize this match alert"
                aria-label="Customize this match alert"
              >
                ⚙
              </button>
              {showAlertConfig && (
                <div className="alert-config-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="alert-config-label">Alert type</div>
                  <button
                    type="button"
                    className={`alert-config-option ${alertMode === 'all' ? 'active' : ''}`}
                    onClick={() => { setAlertMode(match.id, 'all'); setShowAlertConfig(false); }}
                  >
                    All goals
                  </button>
                  <button
                    type="button"
                    className={`alert-config-option ${alertMode === 'home' ? 'active' : ''}`}
                    onClick={() => { setAlertMode(match.id, 'home'); setShowAlertConfig(false); }}
                  >
                    Home goals only
                  </button>
                  <button
                    type="button"
                    className={`alert-config-option ${alertMode === 'away' ? 'active' : ''}`}
                    onClick={() => { setAlertMode(match.id, 'away'); setShowAlertConfig(false); }}
                  >
                    Away goals only
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <button 
          className={`action-btn fav-btn ${fav ? 'fav-on' : 'fav-off'}`}
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
