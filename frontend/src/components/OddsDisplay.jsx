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
  const mainMarketTypes = ['1', '13', '9', '15', '14', '10', '34'];

  // Check if a market is an Over/Under type that needs the handi-grouped layout
  const isOverUnderType = (marketType, marketName) => {
    const type = Number(marketType);
    if ([13, 14, 34].includes(type)) return true;
    const name = (marketName || '').toLowerCase();
    return name.includes('over/under') || name.includes('over under');
  };

  return (
    <div className="odds-display">
      <div className="odds-header">Odds</div>

      <div className="odds-markets">
        {mainMarketTypes.map((marketType) => {
          if (!odds[marketType]) return null;

          const market = odds[marketType];
          const marketName = marketTypeNames[market.market_type] || market.market_name;
          const selections = market.selections || [];

          // Over/Under markets render in paired format "Over / X.X / Under"
          if (isOverUnderType(market.market_type, marketName)) {
            return (
              <div key={marketType} className="odds-market ou-market">
                <div className="market-name">{marketName}</div>
                <OverUnderRows selections={selections} />
              </div>
            );
          }

          // Standard market – flat list
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
        })}
      </div>
    </div>
  );
}

// ─── Over/Under row component ─────────────────────────────────────────────────
function OverUnderRows({ selections }) {
  // Attempt to pair selections sharing the same line/handicap label
  const rows = buildOURows(selections);

  if (rows.length === 0) {
    return (
      <div className="odds-list">
        {selections.map((sel) => (
          <div key={sel.id} className="odds-item">
            <span className="odds-name">{sel.name}</span>
            <span className="odds-price">{sel.price?.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="ou-table">
      <div className="ou-table-head">
        <span></span>
        <span>Line</span>
        <span></span>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="ou-table-row">
          <span className="odds-price ou-side">
            {row.overPrice != null ? row.overPrice.toFixed(2) : '-'}
          </span>
          <span className="ou-line">{row.line}</span>
          <span className="odds-price ou-side">
            {row.underPrice != null ? row.underPrice.toFixed(2) : '-'}
          </span>
        </div>
      ))}
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
  const byHandicap = {};   // 4.5 → { over: sel | undefined, under: sel | undefined }

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
