import { useState } from 'react';
import MatchCard from './MatchCard';
import './LeagueGroupedList.css';

// Country name to ISO code mapping (English and Greek names)
const COUNTRY_CODE_BY_NAME = {
  // English - All countries
  'Afghanistan': 'af', 'Albania': 'al', 'Algeria': 'dz', 'Andorra': 'ad',
  'Angola': 'ao', 'Argentina': 'ar', 'Armenia': 'am', 'Australia': 'au',
  'Austria': 'at', 'Azerbaijan': 'az', 'Bahamas': 'bs', 'Bahrain': 'bh',
  'Bangladesh': 'bd', 'Barbados': 'bb', 'Belarus': 'by', 'Belgium': 'be',
  'Belize': 'bz', 'Benin': 'bj', 'Bhutan': 'bt', 'Bolivia': 'bo',
  'Bosnia and Herzegovina': 'ba', 'Botswana': 'bw', 'Brazil': 'br', 'Brunei': 'bn',
  'Bulgaria': 'bg', 'Burkina Faso': 'bf', 'Burundi': 'bi', 'Cabo Verde': 'cv',
  'Cambodia': 'kh', 'Cameroon': 'cm', 'Canada': 'ca', 'Central African Republic': 'cf',
  'Chad': 'td', 'Chile': 'cl', 'China': 'cn', 'Colombia': 'co', 'Comoros': 'km',
  'Congo': 'cg', 'Costa Rica': 'cr', 'Croatia': 'hr', 'Cuba': 'cu', 'Cyprus': 'cy',
  'Czech Republic': 'cz', 'Democratic Republic of the Congo': 'cd', 'Denmark': 'dk',
  'Djibouti': 'dj', 'Dominica': 'dm', 'Dominican Republic': 'do', 'Ecuador': 'ec',
  'Egypt': 'eg', 'El Salvador': 'sv', 'Equatorial Guinea': 'gq', 'Eritrea': 'er',
  'Estonia': 'ee', 'Eswatini': 'sz', 'Ethiopia': 'et', 'Fiji': 'fj', 'Finland': 'fi',
  'France': 'fr', 'Gabon': 'ga', 'Gambia': 'gm', 'Georgia': 'ge', 'Germany': 'de',
  'Ghana': 'gh', 'Greece': 'gr', 'Grenada': 'gd', 'Guatemala': 'gt', 'Guinea': 'gn',
  'Guinea-Bissau': 'gw', 'Guyana': 'gy', 'Haiti': 'ht', 'Honduras': 'hn', 'Hungary': 'hu',
  'Iceland': 'is', 'India': 'in', 'Indonesia': 'id', 'Iran': 'ir', 'Iraq': 'iq',
  'Ireland': 'ie', 'Israel': 'il', 'Italy': 'it', 'Jamaica': 'jm', 'Japan': 'jp',
  'Jordan': 'jo', 'Kazakhstan': 'kz', 'Kenya': 'ke', 'Korea': 'kr', 'Kuwait': 'kw',
  'Kyrgyzstan': 'kg', 'Laos': 'la', 'Latvia': 'lv', 'Lebanon': 'lb', 'Lesotho': 'ls',
  'Liberia': 'lr', 'Libya': 'ly', 'Liechtenstein': 'li', 'Lithuania': 'lt', 'Luxembourg': 'lu',
  'Madagascar': 'mg', 'Malawi': 'mw', 'Malaysia': 'my', 'Maldives': 'mv', 'Mali': 'ml',
  'Malta': 'mt', 'Mauritania': 'mr', 'Mauritius': 'mu', 'Mexico': 'mx', 'Moldova': 'md',
  'Monaco': 'mc', 'Mongolia': 'mn', 'Montenegro': 'me', 'Morocco': 'ma', 'Mozambique': 'mz',
  'Myanmar': 'mm', 'Namibia': 'na', 'Nepal': 'np', 'Netherlands': 'nl', 'New Zealand': 'nz',
  'Nicaragua': 'ni', 'Niger': 'ne', 'Nigeria': 'ng', 'North Macedonia': 'mk', 'Norway': 'no',
  'Oman': 'om', 'Pakistan': 'pk', 'Palestine': 'ps', 'Panama': 'pa', 'Papua New Guinea': 'pg',
  'Paraguay': 'py', 'Peru': 'pe', 'Philippines': 'ph', 'Poland': 'pl', 'Portugal': 'pt',
  'Qatar': 'qa', 'Romania': 'ro', 'Russia': 'ru', 'Rwanda': 'rw', 'Saint Lucia': 'lc',
  'Saint Vincent and the Grenadines': 'vc', 'Samoa': 'ws', 'San Marino': 'sm',
  'Sao Tome and Principe': 'st', 'Saudi Arabia': 'sa', 'Senegal': 'sn', 'Serbia': 'rs',
  'Seychelles': 'sc', 'Sierra Leone': 'sl', 'Singapore': 'sg', 'Slovakia': 'sk',
  'Slovenia': 'si', 'Solomon Islands': 'sb', 'Somalia': 'so', 'South Africa': 'za',
  'South Korea': 'kr', 'South Sudan': 'ss', 'Spain': 'es', 'Sri Lanka': 'lk', 'Sudan': 'sd',
  'Suriname': 'sr', 'Sweden': 'se', 'Switzerland': 'ch', 'Syria': 'sy', 'Taiwan': 'tw',
  'Tajikistan': 'tj', 'Tanzania': 'tz', 'Thailand': 'th', 'Togo': 'tg', 'Tonga': 'to',
  'Trinidad and Tobago': 'tt', 'Tunisia': 'tn', 'Turkey': 'tr', 'Turkmenistan': 'tm',
  'Tuvalu': 'tv', 'Uganda': 'ug', 'Ukraine': 'ua', 'United Arab Emirates': 'ae',
  'United Kingdom': 'gb', 'United States': 'us', 'Uruguay': 'uy', 'Uzbekistan': 'uz',
  'Vanuatu': 'vu', 'Vatican City': 'va', 'Venezuela': 've', 'Vietnam': 'vn', 'Yemen': 'ye',
  'Zambia': 'zm', 'Zimbabwe': 'zw',
  // Greek translations
  'Ελλάδα': 'gr', 'Αγγλία': 'gb', 'Ισπανία': 'es', 'Γερμανία': 'de', 'Ιταλία': 'it',
  'Γαλλία': 'fr', 'Βραζιλία': 'br', 'Αργεντινή': 'ar', 'Μέξικο': 'mx',
  'Πορτογαλία': 'pt', 'Κάτω Χώρες': 'nl', 'Βέλγιο': 'be', 'Σουηδία': 'se',
  'Νορβηγία': 'no', 'Δανία': 'dk', 'Φινλανδία': 'fi', 'Πολωνία': 'pl',
  'Ρωσία': 'ru', 'Τουρκία': 'tr', 'Βολιβία': 'bo', 'Παραγουάη': 'py',
  'Χιλή': 'cl', 'Κολομβία': 'co', 'Ουρουγουάη': 'uy', 'Περού': 'pe',
  'Αυστρία': 'at', 'Ελβετία': 'ch', 'Τσεχία': 'cz', 'Ουκρανία': 'ua',
  'Ρουμανία': 'ro', 'Ουγγρια': 'hu', 'Σερβία': 'rs', 'Σλοβενία': 'si',
  'Σλοβακία': 'sk', 'Βουλγαρία': 'bg', 'Ισραήλ': 'il', 'Αυστραλία': 'au',
  'Ιαπών': 'jp', 'Νότη Κορέα': 'kr', 'Ιράν': 'ir', 'Σαουδική Αραβία': 'sa',
  'Νότη Αφρική': 'za', 'Αίγυπτος': 'eg', 'Μαρόκο': 'ma', 'Τυνήσια': 'tn',
  'Αλγερία': 'dz', 'Καμερούν': 'cm', 'Νιγηρία': 'ng', 'Γκάνα': 'gh',
  'Σενεγάλη': 'sn', 'Ακτή Ελεφάντη': 'ci', 'Νέα Ζηλανδία': 'nz', 'Καναδάς': 'ca',
  'Κίνα': 'cn', 'Ινδία': 'in', 'Ταϊλάνδη': 'th', 'Μαλαισία': 'my', 'Ινδονησία': 'id',
  'Φιλιππίνες': 'ph', 'Βιετνάμ': 'vn', 'Σιγκάπουρη': 'sg', 'Χονγκ Κονγκ': 'hk',
  'Ταϊβάν': 'tw', 'Ιρλανδία': 'ie', 'Λουξεμβούργο': 'lu', 'Ανδόρα': 'ad',
  'Αλβανία': 'al', 'Αρμενία': 'am', 'Αζερμπαϊτζάν': 'az', 'Βελάρυνα': 'by',
  'Βοσνία-Ερζέγγοβινη': 'ba', 'Κύπρος': 'cy', 'Γεωργία': 'ge', 'Καζακστάν': 'kz',
  'Λατβία': 'lv', 'Λιθουανία': 'lt', 'Μάλτα': 'mt', 'Μολδοβία': 'md', 'Μοντενέγρο': 'me',
  'Βόρεια Μακεδονία': 'mk', 'Εσθονία': 'ee', 'Κοσόβο': 'xk', 'ΗΠΑ': 'us',
  'Γουατεμάλα': 'gt', 'Κούβα': 'cu', 'Βενεζουέλα': 've', 'Εκουαδόρ': 'ec',
  'Δαμπάρι': 'do', 'Καρίβες': 'cu', 'Νικαράγουα': 'ni', 'Χονδούρες': 'hn',
  'Τατζικιστάν': 'tz', 'Κένυα': 'ke', 'Λίβυσ': 'ly', 'Σουδάν': 'sd', 'Ιράκ': 'iq',
  'Συρία': 'sy', 'Ιορδανία': 'jo', 'Λεσότο': 'ls', 'Λιβερία': 'lr', 'Γουινέα': 'gn', 'Μαλί': 'ml',
  'Νέα Καληδία': 'nc', 'Ομάν': 'om', 'Κατάρ': 'qa', 'Κουβέιτ': 'ps', 'Μπαχρέιν': 'bh',
  'Αραβία Σάουδη': 'sa',
};

// Get flag URL from country name
const getFlagUrl = (countryName) => {
  const code = COUNTRY_CODE_BY_NAME[countryName];
  if (!code) return null;
  return `https://flagcdn.com/w40/${code}.png`;
};

export default function LeagueGroupedList({ matches }) {
  // Group matches by country first, then by league
  const groupedByCountry = {};
  for (const match of matches) {
    const countryName = match.country_name || 'Unknown';
    const league = match.league || 'Unknown';
    if (!groupedByCountry[countryName]) {
      groupedByCountry[countryName] = {};
    }
    if (!groupedByCountry[countryName][league]) {
      groupedByCountry[countryName][league] = [];
    }
    groupedByCountry[countryName][league].push(match);
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
        const countryLeagues = groupedByCountry[countryName];
        const flagUrl = getFlagUrl(countryName);
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