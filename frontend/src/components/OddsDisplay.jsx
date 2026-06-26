import './OddsDisplay.css';

export default function OddsDisplay({ odds }) {
  if (!odds || Object.keys(odds).length === 0) {
    return null;
  }

  // Market type → display name
  const marketTypeNames = {
    1: '1X2 (Match Result)',
    9: 'Double Chance',
    10: 'Draw No Bet',
    11: 'Next Goal',
    13: 'Goals Over/Under',
    14: '1st Half Goals Over/Under',
    15: 'Both Teams To Score',
    34: 'Corners Over/Under',
  };

  // Preferred market display order
  const mainMarketTypes = ['9', '15', '10', '11'];

  // Group HCTG markets by base type
  const hctgGroups = {};
  for (const market of Object.values(odds)) {
    if (market.type === 'HCTG' || market.type === 'OUH1' || [13, 14, 34].includes(market.market_type)) {
      const baseType = String(market.market_type);
      if (!hctgGroups[baseType]) hctgGroups[baseType] = { market_type: market.market_type, markets: [] };
      hctgGroups[baseType].markets.push(market);
    }
  }

  const renderStandardMarket = (marketType) => {
    if (!odds[marketType]) return null;

    const market = odds[marketType];
    const marketName = marketTypeNames[market.market_type] || market.market_name;
    const selections = market.selections || [];

    return (
      <div key={marketType} className="odds-market">
        <div className="market-name">{marketName}</div>
        <div className="odds-list">
          {selections.map((selection) => (
            <div key={selection.id} className="odds-item">
              <span className="odds-name">{selection.name}</span>
              <span className="odds-price">{selection.price?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const orderedOverUnderGroups = Object.entries(hctgGroups)
    .sort(([a], [b]) => {
      const order = ['13', '14', '34'];
      return order.indexOf(a) - order.indexOf(b);
    });

  return (
    <div className="odds-display">
      <div className="odds-markets">
        {renderStandardMarket('1')}

        {/* Render all Over/Under markets grouped by type */}
        {orderedOverUnderGroups.map(([baseType, group]) => {
          const marketName = marketTypeNames[group.market_type] || 'Over/Under';

          // Collect all selections from all handicap markets
          const allSelections = group.markets.flatMap(m => m.selections || []);

          if (allSelections.length === 0) return null;

          const rows = buildOURows(allSelections);

          return (
            <div key={baseType} className="odds-market ou-market">
              <div className="market-name">{marketName}</div>
              {rows.length > 0 ? (
                <div className="ou-table">
                  {rows.map((row, idx) => (
                    <div key={idx} className="ou-table-row">
                      <div className="ou-box ou-box--over">
                        <span className="ou-side-label">Over {row.line}</span>
                        <span className="odds-price ou-side">{row.overPrice != null ? row.overPrice.toFixed(2) : '-'}</span>
                      </div>
                      <div className="ou-box ou-box--under">
                        <span className="ou-side-label">Under {row.line}</span>
                        <span className="odds-price ou-side">{row.underPrice != null ? row.underPrice.toFixed(2) : '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="odds-list">
                  {allSelections.map((sel) => (
                    <div key={sel.id} className="odds-item">
                      <span className="odds-name">{sel.name}</span>
                      <span className="odds-price">{sel.price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {mainMarketTypes.map(renderStandardMarket)}
      </div>
    </div>
  );
}

/**
 * Pair Over / Under selections per line/handicap.
 *
 * Raw API field reference:
 *   selection.name   = "Over 4.5"  /  "Under 2.5"   (the full label with line)
 *   selection.fullName = "Over"     /  "Under"        (side token)
 *   selection.handicap = 4.5       (numeric line — THE source of truth)
 *   selection.typeId = 39 (Over side) / 40 (Under side)
 */
function buildOURows(selections) {
  const rows = [];

  // Group selections by their numeric handicap value
  const byHandicap = {};

  for (const sel of selections) {
    if (sel.handicap == null) continue;
    const key = String(sel.handicap);
    if (!byHandicap[key]) byHandicap[key] = {};

    const tid = sel.typeId;
    if (tid === 39 || (sel.name || '').toLowerCase().startsWith('over')) {
      byHandicap[key].over = sel;
    } else if (tid === 40 || (sel.name || '').toLowerCase().startsWith('under')) {
      byHandicap[key].under = sel;
    } else {
      // Fallback: first hit is over, second is under
      if (!('over' in byHandicap[key])) byHandicap[key].over = sel;
      else byHandicap[key].under = sel;
    }
  }

  const sortedKeys = [...Object.keys(byHandicap)].sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  if (sortedKeys.length > 0) {
    for (const key of sortedKeys) {
      const pair = byHandicap[key];
      rows.push({
        line:   key,
        overPrice:  pair.over  ? pair.over.price  : null,
        underPrice: pair.under ? pair.under.price : null,
      });
    }
    return rows;
  }

  // Fallback: try to parse line number from selection name (legacy shape without handicap)
  const overMap = {};
  const underMap = {};
  for (const sel of selections) {
    const name = (sel.name || '').toLowerCase();
    if (!name) continue;

    const overNum  = name.match(/over\s+([\d.,]+)/);
    const underNum = name.match(/under\s+([\d.,]+)/);

    if (overNum)  overMap[overNum[1]]  = overMap[overNum[1]]  || sel.price;
    if (underNum) underMap[underNum[1]] = underMap[underNum[1]] || sel.price;
  }

  const allKeys = new Set([...Object.keys(overMap), ...Object.keys(underMap)]);
  if (allKeys.size > 0) {
    for (const key of [...allKeys].sort((a, b) => parseFloat(a.replace(/,/g, '.')) - parseFloat(b.replace(/,/g, '.')))) {
      rows.push({
        line:   key,
        overPrice:  overMap[key]  || null,
        underPrice: underMap[key] || null,
      });
    }
    return rows;
  }

  return rows;
}