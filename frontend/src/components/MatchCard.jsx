import './MatchCard.css';

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

  return (
    <div className="match-card">
      <div className={`match-status ${getStatusColor(match.status)}`}>
        {match.status}
      </div>
      
      <div className="match-header">
        <span className="match-league">{match.league}</span>
        <span className="match-time">{formatTime(match.start_time)}</span>
      </div>

      <div className="match-body">
        <div className="team home-team">
          <h3>{match.home_team}</h3>
          <div className="score">{match.home_score}</div>
        </div>

        <div className="match-divider">vs</div>

        <div className="team away-team">
          <h3>{match.away_team}</h3>
          <div className="score">{match.away_score}</div>
        </div>
      </div>
    </div>
  );
}
