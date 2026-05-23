import { useState } from 'react';
import MatchCard from './MatchCard';
import './LeagueGroupedList.css';

// Country name to flag mapping (English and Greek names)
const COUNTRY_FLAGS_BY_NAME = {
  // English - All countries A-Z
  'Afghanistan': '🇦🇫', 'Albania': '🇦🇱', 'Algeria': '🇩🇿', 'Andorra': '🇦🇩',
  'Angola': '🇦🇴', 'Antigua and Barbuda': '🇦🇬', 'Argentina': '🇦🇷', 'Armenia': '🇦🇲',
  'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Azerbaijan': '🇦🇿',
  'Bahamas': '🇧🇸', 'Bahrain': '🇧🇷', 'Bangladesh': '🇧🇩', 'Barbados': '🇧🇧',
  'Belarus': '🇧🇾', 'Belgium': '🇧🇪', 'Belize': '🇧🇿', 'Benin': '🇧🇯',
  'Bhutan': '🇧🇹', 'Bolivia': '🇧🇴', "Bosnia and Herzegovina": '🇧🇦', 'Botswana': '🇧🇼',
  'Brazil': '🇧🇷', 'Brunei': '🇧🇳', 'Bulgaria': '🇧🇬', 'Burkina Faso': '🇧🇫', 'Burundi': '🇧🇮',
  'Côte d\'Ivoire': '🇨🇮', 'Cambodia': '🇰🇭', 'Cameroon': '🇨🇲', 'Canada': '🇨🇦',
  'Central African Republic': '🇨🇫', 'Chad': '🇹🇩', 'Chile': '🇨🇱', 'China': '🇨🇳',
  'Colombia': '🇨🇴', 'Comoros': '🇰🇲', 'Congo': '🇨🇬', 'Costa Rica': '🇨🇷',
  'Croatia': '🇭🇷', 'Cuba': '🇨🇺', 'Cyprus': '🇨🇾', 'Czech Republic': '🇨🇿',
  'Democratic Republic of the Congo': '🇨🇩', 'Denmark': '🇩🇰', 'Djibouti': '🇩🇯',
  'Dominica': '🇩🇲', 'Dominican Republic': '🇩🇴', 'Ecuador': '🇪🇨', 'Egypt': '🇪🇬',
  'El Salvador': '🇸🇻', 'Equatorial Guinea': '🇬🇶', 'Eritrea': '🇪🇷', 'Estonia': '🇪🇪',
  'Eswatini': '🇸🇿', 'Ethiopia': '🇪🇹',
  'Fiji': '🇫🇯', 'Finland': '🇫🇮', 'France': '🇫🇷',
  'Gabon': '🇬🇦', 'Gambia': '🇬🇲', 'Georgia': '🇬🇪', 'Germany': '🇩🇪', 'Ghana': '🇬🇭',
  'Greece': '🇬🇷', 'Grenada': '🇬🇩', 'Guatemala': '🇬🇹', 'Guinea': '🇬🇳', 'Guinea-Bissau': '🇬🇼', 'Guyana': '🇬🇾',
  'Haiti': '🇭🇹', 'Honduras': '🇭🇳', 'Hungary': '🇭🇺',
  'Iceland': '🇮🇸', 'India': '🇮🇳', 'Indonesia': '🇮🇩', 'Iran': '🇮🇷', 'Iraq': '🇮🇶',
  'Ireland': '🇮🇪', 'Israel': '🇮🇱', 'Italy': '🇮🇹',
  'Jamaica': '🇯🇲', 'Japan': '🇯🇵', 'Jordan': '🇯🇴',
  'Kazakhstan': '🇰🇿', 'Kenya': '🇰🇪', 'Kiribati': '🇰🇮', 'Korea': '🇰🇷', 'Kosovo': '🇽🇰', 'Kuwait': '🇰🇼',
  'Kyrgyzstan': '🇰🇬',
  'Laos': '🇱🇦', 'Latvia': '🇱🇻', 'Lebanon': '🇱🇧', 'Lesotho': '🇱🇸', 'Liberia': '🇱🇷', 'Libya': '🇱🇾',
  'Liechtenstein': '🇱🇮', 'Lithuania': '🇱🇹', 'Luxembourg': '🇱🇺',
  'Madagascar': '🇲🇬', 'Malawi': '🇲🇼', 'Malaysia': '🇲🇾', 'Maldives': '🇲🇻', 'Mali': '🇲🇱', 'Malta': '🇲🇹',
  'Marshall Islands': '🇲🇭', 'Mauritania': '🇲🇷', 'Mauritius': '🇲🇺', 'Mexico': '🇲🇽', 'Micronesia': '🇫🇲',
  'Moldova': '🇲🇩', 'Monaco': '🇲🇨', 'Mongolia': '🇲🇳', 'Montenegro': '🇲🇪', 'Morocco': '🇲🇦', 'Mozambique': '🇲🇿', 'Myanmar': '🇲🇲',
  'Namibia': '🇳🇦', 'Nauru': '🇳🇷', 'Nepal': '🇳🇵', 'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿', 'Nicaragua': '🇳🇮', 'Niger': '🇳🇷', 'Nigeria': '🇳🇬', 'North Macedonia': '🇲🇰', 'Norway': '🇳🇴',
  'Oman': '🇴🇲',
  'Pakistan': '🇵🇰', 'Palau': '🇵🇼', 'Palestine': '🇵🇸', 'Panama': '🇵🇦', 'Papua New Guinea': '🇵🇬', 'Paraguay': '🇵🇾', 'Peru': '🇵🇪', 'Philippines': '🇵🇭', 'Poland': '🇵🇱', 'Portugal': '🇵🇹',
  'Qatar': '🇶🇦',
  'Romania': '🇷🇴', 'Russia': '🇷🇺', 'Rwanda': '🇷🇼',
  'Saint Kitts and Nevis': '🇰🇳', 'Saint Lucia': '🇱🇨', 'Saint Vincent and the Grenadines': '🇻🇨', 'Samoa': '🇼🇸', 'San Marino': '🇸🇲', 'Sao Tome and Principe': '🇸🇹', 'Saudi Arabia': '🇸🇦', 'Senegal': '🇸🇳', 'Serbia': '🇷🇸', 'Seychelles': '🇸🇨', 'Sierra Leone': '🇸🇱', 'Singapore': '🇸🇬', 'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Solomon Islands': '🇸🇧', 'Somalia': '🇸🇴', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'South Sudan': '🇸🇸', 'Spain': '🇪🇸', 'Sri Lanka': '🇱🇰', 'Sudan': '🇸🇩', 'Suriname': '🇸🇷', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Syria': '🇸🇾',
  'Tajikistan': '🇹🇯', 'Tanzania': '🇹🇿', 'Thailand': '🇹🇭', 'Timor-Leste': '🇹🇱', 'Togo': '🇹🇬', 'Tonga': '🇹🇴', 'Trinidad and Tobago': '🇹🇹', 'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Turkmenistan': '🇹🇲', 'Tuvalu': '🇹🇻',
  'Uganda': '🇺🇬', 'Ukraine': '🇺🇦', 'United Arab Emirates': '🇦🇪', 'United Kingdom': '🇬🇧', 'United States': '🇺🇸', 'Uruguay': '🇺🇾', 'Uzbekistan': '🇺🇿',
  'Vanuatu': '🇻🇺', 'Vatican City': '🇻🇦', 'Venezuela': '🇻🇪', 'Vietnam': '🇻🇳',
  'Yemen': '🇾🇪',
  'Zambia': '🇿🇲', 'Zimbabwe': '🇿🇿',
  // Greek translations
  'Ελλάδα': '🇬🇷', 'Αγγλία': '🇬🇧', 'Ισπανία': '🇪🇸', 'Γερμανία': '🇩🇪', 'Ιταλία': '🇮🇹',
  'Γαλλία': '🇫🇷', 'Βραζιλία': '🇧🇷', 'Αργεντινή': '🇦🇷', 'Μέξικο': '🇲🇽',
  'Πορτογαλία': '🇵🇹', 'Κάτω Χώρες': '🇳🇱', 'Βέλγιο': '🇧🇪', 'Σουηδία': '🇸🇪',
  'Νορβηγία': '🇳🇴', 'Δανία': '🇩🇰', 'Φινλανδία': '🇫🇮', 'Πολωνία': '🇵🇱',
  'Ρωσία': '🇷🇺', 'Τουρκία': '🇹🇷', 'Βολιβία': '🇧🇴', 'Παραγουάη': '🇵🇾',
  'Χιλή': '🇨🇱', 'Κολομβία': '🇨🇴', 'Ουρουγουάη': '🇺🇾', 'Περού': '🇵🇪',
  'Αυστρία': '🇦🇹', 'Ελβετία': '🇨🇭', 'Τσεχία': '🇨🇿', 'Ουκρανία': '🇺🇦',
  'Ρουμανία': '🇷🇴', 'Ουγγρια': '🇭🇺', 'Σερβία': '🇷🇸', 'Σλοβενία': '🇸🇮',
  'Σλοβακία': '🇸🇰', 'Βουλγαρία': '🇧🇬', 'Ισραήλ': '🇮🇱',
  'Αυστραλία': '🇦🇺', 'Ιαπών': '🇯🇵', 'Νότη Κορέα': '🇰🇷', 'Ιράν': '🇮🇷',
  'Σαουδική Αραβία': '🇸🇦', 'Νότη Αφρική': '🇿🇦', 'Αίγυπτος': '🇪🇬',
  'Μαρόκο': '🇲🇦', 'Τυνήσια': '🇹🇳', 'Αλγερία': '🇩🇿', 'Καμερούν': '🇨🇲',
  'Νιγηρία': '🇳🇬', 'Γκάνα': '🇬🇭', 'Σενεγάλη': '🇸🇳', 'Ακτή Ελεφάντη': '🇨🇮',
  'Νέα Ζηλανδία': '🇳🇿', 'Καναδάς': '🇨🇦', 'Κίνα': '🇨🇳', 'Ινδία': '🇮🇳',
  'Ταϊλάνδη': '🇹🇭', 'Μαλαισία': '🇲🇾', 'Ινδονησία': '🇮🇩', 'Φιλιππίνες': '🇵🇭',
  'Βιετνάμ': '🇻🇳', 'Σιγκάπουρη': '🇸🇬', 'Χονγκ Κονγκ': '🇭🇰', 'Ταϊβάν': '🇹🇼',
  'Ιρλανδία': '🇮🇪', 'Λουξεμβούργο': '🇱🇺', 'Ανδόρα': '🇦🇩',
  'Αλβανία': '🇦🇱', 'Αρμενία': '🇦🇲', 'Αζερμπαϊτζάν': '🇦🇿', 'Βελάρυνα': '🇧🇾',
  'Βοσνία-Ερζέγγοβινη': '🇧🇦', 'Κύπρος': '🇨🇾', 'Γεωργία': '🇬🇪',
  'Καζακστάν': '🇰🇿', 'Λατβία': '🇱🇻', 'Λιθουανία': '🇱🇹', 'Μάλτα': '🇲🇹',
  'Μολδοβία': '🇲🇩', 'Μοντενέγρο': '🇲🇪', 'Βόρεια Μακεδονία': '🇲🇰',
  'Εσθονία': '🇪🇪', 'Κοσόβο': '🇽🇰',
  'ΗΠΑ': '🇺🇸', 'Γουατεμάλα': '🇬🇹', 'Κούβα': '🇨🇺', 'Βενεζουέλα': '🇻🇪', 'Εκουαδόρ': '🇪🇨',
};

export default function LeagueGroupedList({ matches }) {
  // Group matches by league
  const groupedMatches = {};
  for (const match of matches) {
    const league = match.league || 'Unknown';
    if (!groupedMatches[league]) {
      groupedMatches[league] = [];
    }
    groupedMatches[league].push(match);
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

  const toggleLeague = (league) => {
    setExpanded(prev => ({ ...prev, [league]: !prev[league] }));
  };

  // Get country info from first match in league
  const getCountryInfo = (leagueMatches) => {
    const countryName = leagueMatches[0]?.country_name;
    return countryName || null;
  };

  return (
    <div className="league-grouped-list">
      {Object.entries(groupedMatches).map(([league, leagueMatches]) => {
        const isOpen = expanded[league];
        const countryName = getCountryInfo(leagueMatches);
        const flag = countryName && COUNTRY_FLAGS_BY_NAME[countryName] ? COUNTRY_FLAGS_BY_NAME[countryName] : null;
        return (
          <div key={league} className="league-group">
            <div
              className="league-header"
              onClick={() => toggleLeague(league)}
            >
              {flag && <span className="league-flag">{flag}</span>}
              <span className="league-name">{league}</span>
              {countryName && (
                <span className="league-country">
                  {flag && <span className="country-flag-inline">{flag}</span>}
                  {countryName}
                </span>
              )}
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
}