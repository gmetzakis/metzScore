import { useState } from 'react';
import MatchCard from './MatchCard';
import './LeagueGroupedList.css';

// Get flag URL from country code (from Stoiximan API)
const getFlagUrl = (countryCode) => {
  if (!countryCode) return null;
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

  // State for expanded countries and leagues
  const [expandedCountries, setExpandedCountries] = useState({});
  const [expandedLeagues, setExpandedLeagues] = useState({});

  if (matches.length === 0) {
    return (
      <div className="no-matches">
        <p>No matches available at the moment.</p>
      </div>
    );
  }

  const toggleCountry = (countryName) => {
    setExpandedCountries(prev => ({ ...prev, [countryName]: !prev[countryName] }));
  };

  const toggleLeague = (countryName, league) => {
    const key = `${countryName}-${league}`;
    setExpandedLeagues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Sort countries alphabetically
  const sortedCountries = Object.keys(groupedByCountry).sort((a, b) => a.localeCompare(b));

  return (
    <div className="league-grouped-list">
      {sortedCountries.map((countryName) => {
        const countryData = groupedByCountry[countryName];
        const countryLeagues = countryData.leagues;
        const flagUrl = getFlagUrl(countryData.countryCode);
        const fallbackUrl = 'https://www.stoiximan.gr/assets/icons/flags/default.svg?v=2.0.0';
        const sortedLeagues = Object.keys(countryLeagues).sort((a, b) => a.localeCompare(b));
        const isCountryOpen = expandedCountries[countryName];
        
        return (
          <div key={countryName} className={`country-group ${isCountryOpen ? 'expanded' : ''}`}>
            <div className="country-header" onClick={() => toggleCountry(countryName)}>
              {flagUrl && <img className="country-flag" src={flagUrl} onError={(e) => { e.currentTarget.src = fallbackUrl}} alt={`${countryName} flag`} />}
              <span className="country-name-wrapper">
                <span className="country-name">{countryName}</span>
                <span className="country-count">{sortedLeagues.reduce((sum, league) => sum + countryLeagues[league].length, 0)}</span>
              </span>
              <span className={`country-toggle ${isCountryOpen ? 'open' : ''}`}>{isCountryOpen ? '▼' : '▼'}</span>
            </div>
{isCountryOpen && (
  <div className="league-container">
    {sortedLeagues.map((league) => {
      const leagueMatches = countryLeagues[league];
      const isLeagueOpen = expandedLeagues[`${countryName}-${league}`];
      return (
        <div key={league} className="league-group">
          <div className="league-header" onClick={() => toggleLeague(countryName, league)}>
              <span className="league-name-wrapper">
                <span className="league-name">{league}</span>
                <span className="league-count">{leagueMatches.length}</span>
              </span>
              <span className={`league-toggle ${isLeagueOpen ? 'open' : ''}`}>{isLeagueOpen ? '▼' : '▼'}</span>
            </div>
          {isLeagueOpen && (
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
)}
          </div>
        );
      })}
    </div>
  );
}