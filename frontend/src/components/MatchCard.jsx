import './MatchCard.css';
import OddsDisplay from './OddsDisplay';

export default function MatchCard({ match }) {
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
    <div className="match-card">
      <div className="match-top-row">
        <div className={`match-status ${getStatusColor(match.status)}`}>
          {match.status}
        </div>
        
        {isLive && match.injury_time > 0 && (
          <div className="injury-time">+{match.injury_time}' added time</div>
        )}
      </div>
      
      <div className="match-header">
        <span className="match-league">{match.league}</span>
        <span className="match-time">
          {isLive ? (
            <span className="live-clock">{match.match_time}</span>
          ) : (
            formatTime(match.start_time)
          )}
        </span>
      </div>

      <div className="match-body">
        <div className="team home-team">
          <h3>{match.home_team}</h3>
          <div className="score">{match.home_score}</div>
        </div>

        <div className="match-center">
          <div className="match-divider">vs</div>
          {isLive && <div className="live-indicator">● LIVE</div>}
        </div>

        <div className="team away-team">
          <h3>{match.away_team}</h3>
          <div className="score">{match.away_score}</div>
        </div>
      </div>

      {match.odds && <OddsDisplay odds={match.odds} />}
    </div>
  );
}
