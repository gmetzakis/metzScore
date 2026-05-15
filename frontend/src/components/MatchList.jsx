import MatchCard from './MatchCard';
import './MatchList.css';

export default function MatchList({ matches }) {
  if (!matches || matches.length === 0) {
    return (
      <div className="no-matches">
        <p>No matches available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="match-list">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
