import './OddsDisplay.css';

export default function OddsDisplay({ odds }) {
  if (!odds || Object.keys(odds).length === 0) {
    return null;
  }

  // Map market types to readable names
  const marketTypeNames = {
    1: '1X2 (Match Result)',
    9: 'Double Chance',
    11: 'Half Time Winner',
    13: 'Goals Over/Under',
    14: '1st Half Goals Over/Under',
  };

  // Filter to show main markets only (1X2, Goals O/U, Double Chance)
  const mainMarketTypes = ['1', '13', '9'];

  return (
    <div className="odds-display">
      <div className="odds-header">Odds</div>
      
      <div className="odds-markets">
        {mainMarketTypes.map((marketType) => {
          if (!odds[marketType]) return null;
          
          const market = odds[marketType];
          const marketName = marketTypeNames[market.market_type] || market.market_name;

          return (
            <div key={marketType} className="odds-market">
              <div className="market-name">{marketName}</div>
              
              <div className="odds-list">
                {market.selections.map((selection) => (
                  <div key={selection.id} className="odds-item">
                    <span className="odds-name">{selection.name}</span>
                    <span className="odds-price">{selection.price?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
