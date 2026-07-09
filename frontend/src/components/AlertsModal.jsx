import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import './AlertsModal.css';

export default function AlertsModal({ open, onClose }) {
  const { alertIds, removeAlert, clearAllAlerts, getAlertMode, setAlertMode } = useFavorites();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    apiService.getAllFootballMatches()
      .then((data) => {
        setMatches(data.matches || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load alert matches');
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setOpenMenuId(null);
    }
  }, [open]);

  const alertMatches = alertIds.map((id) => {
    const match = matches.find((m) => m.id === id);
    return {
      ...(match || { id, home_team: 'Unknown', away_team: 'Match' }),
      alertMode: getAlertMode(id),
    };
  });

  const modeLabel = (mode) => {
    if (mode === 'home') return 'Home goals only';
    if (mode === 'away') return 'Away goals only';
    return 'All goals';
  };

  if (!open) return null;

  return (
    <div className="alerts-modal-backdrop" onClick={onClose}>
      <div className="alerts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alerts-modal-header">
          <h2>Alerts</h2>
          <button className="alerts-modal-close" onClick={onClose} aria-label="Close alerts panel">✕</button>
        </div>

        <div className="alerts-modal-actions">
          <button
            className="alerts-modal-clear"
            onClick={clearAllAlerts}
            disabled={!alertIds.length}
          >
            Clear all alerts
          </button>
        </div>

        <div className="alerts-modal-body">
          {loading ? (
            <div className="alerts-modal-empty">Loading alert matches…</div>
          ) : error ? (
            <div className="alerts-modal-error">{error}</div>
          ) : alertMatches.length === 0 ? (
            <div className="alerts-modal-empty">No alert-enabled matches.</div>
          ) : (
            <ul className="alerts-modal-list">
              {alertMatches.map((match) => (
                <li key={match.id} className="alerts-modal-item">
                  <div className="alerts-modal-item-main">
                    <div className="alerts-modal-item-label">
                      {match.home_team} vs {match.away_team}
                    </div>
                    <div className="alerts-modal-item-meta">
                      {modeLabel(match.alertMode)}
                    </div>
                  </div>
                  <div className="alerts-modal-item-actions">
                    <button
                      className="alerts-modal-settings"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(prev => prev === match.id ? null : match.id);
                      }}
                      aria-label={`Change alert type for ${match.home_team} vs ${match.away_team}`}
                      title="Change alert type"
                    >
                      ⚙
                    </button>
                    {openMenuId === match.id && (
                      <div className="alerts-modal-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`alerts-modal-option ${match.alertMode === 'all' ? 'active' : ''}`}
                          onClick={() => {
                            setAlertMode(match.id, 'all');
                            setOpenMenuId(null);
                          }}
                        >
                          All goals
                        </button>
                        <button
                          type="button"
                          className={`alerts-modal-option ${match.alertMode === 'home' ? 'active' : ''}`}
                          onClick={() => {
                            setAlertMode(match.id, 'home');
                            setOpenMenuId(null);
                          }}
                        >
                          Home goals only
                        </button>
                        <button
                          type="button"
                          className={`alerts-modal-option ${match.alertMode === 'away' ? 'active' : ''}`}
                          onClick={() => {
                            setAlertMode(match.id, 'away');
                            setOpenMenuId(null);
                          }}
                        >
                          Away goals only
                        </button>
                      </div>
                    )}
                    <button
                      className="alerts-modal-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAlert(match.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
