import { useState } from 'react';
import MatchCard from './MatchCard';
import './LeagueGroupedList.css';

// Get flag URL from country code (from Stoiximan API)
const getFlagUrl = (countryCode) => {
  if (!countryCode) return null;
  // Use Stoiximan SVG flags
  return `https://www.stoiximan.gr/assets/icons/flags/${countryCode}.svg?v=2.0.0`;
};

export default function LeagueGroupedList({ matches }) {
  // Group matches by country first, then by league
  const groupedByCountry = {};
  for (const match of matches) {
    const countryName = match.country_name || 'Unknown';
    const league = match.league || 'Unknown';
    const countryCode = match.country_code;
    if (!groupedByCountry[countryName]) {
      groupedByCountry[countryName] = { countryCode, leagues: {} };
    }
    if (!groupedByCountry[countryName].leagues[league]) {
      groupedByCountry[countryName].leagues[league] = [];
    }
    groupedByCountry[countryName].leagues[league].push(match);
  }

  // All leagues collapsed by default
  const [expanded, setExpanded] = useState({});

  if (matches.length === 0) {
    return (
      <div className="no-matches">
        <p>No matches available at the moment.</p>
      </div>
    );
  }

  const toggleLeague = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Sort countries alphabetically
  const sortedCountries = Object.keys(groupedByCountry).sort((a, b) => a.localeCompare(b));

  return (
    <div className="league-grouped-list">
      {sortedCountries.map((countryName) => {
        const countryData = groupedByCountry[countryName];
        const countryLeagues = countryData.leagues;
        const flagUrl = getFlagUrl(countryData.countryCode);
        const sortedLeagues = Object.keys(countryLeagues).sort((a, b) => a.localeCompare(b));
        
        return (
          <div key={countryName} className="country-group">
            <div className="country-header">
              {flagUrl && <img className="country-flag" src={flagUrl} alt={`${countryName} flag`} />}
              <span className="country-name">{countryName}</span>
            </div>
            {sortedLeagues.map((league) => {
              const leagueMatches = countryLeagues[league];
              const isOpen = expanded[`${countryName}-${league}`];
              return (
                <div key={league} className="league-group">
                  <div
                    className="league-header"
                    onClick={() => toggleLeague(`${countryName}-${league}`)}
                  >
                    <span className="league-name">{league}</span>
                    <span className="league-count">{leagueMatches.length} match{leagueMatches.length !== 1 ? 'es' : ''}</span>
                    <span className="league-toggle">{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div className="league-matches">
                      {leagueMatches.map((match) => (
                        <MatchCard key={match.id} match={match} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}