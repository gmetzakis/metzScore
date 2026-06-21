import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import './AlertsModal.css';

export default function AlertsModal({ open, onClose }) {
  const { alertIds, removeAlert, clearAllAlerts } = useFavorites();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const alertMatches = alertIds.map((id) => {
    const match = matches.find((m) => m.id === id);
    return match || { id, home_team: 'Unknown', away_team: 'Match' };
  });

  if (!open) return null;

  return (
    <div className="alerts-modal-backdrop" onClick={onClose}>
      <div className="alerts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alerts-modal-header">
          <h2>Alerted matches</h2>
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
                  <div className="alerts-modal-item-label">
                    {match.home_team} vs {match.away_team}
                  </div>
                  <button
                    className="alerts-modal-remove"
                    onClick={() => removeAlert(match.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
