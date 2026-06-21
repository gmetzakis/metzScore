import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FavoritesProvider, useFavorites } from './context/FavoritesContext';
import HomePage from './pages/HomePage';
import UpcomingMatchesPage from './pages/UpcomingMatchesPage';
import FavoritesPage from './pages/FavoritesPage';
import MatchDetailPage from './pages/MatchDetailPage';
import AlertsModal from './components/AlertsModal';
import './App.css';

function AppContents() {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alertIds } = useFavorites();

  return (
    <>
      <button
        className="alerts-launcher"
        onClick={() => setAlertsOpen(true)}
        aria-label="Open alerts list"
        title="Open alerted matches"
      >
        🔔 {alertIds.length > 0 ? `(${alertIds.length})` : ''}
      </button>
      <AlertsModal open={alertsOpen} onClose={() => setAlertsOpen(false)} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upcoming-matches" element={<UpcomingMatchesPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/match/:matchId" element={<MatchDetailPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <FavoritesProvider>
        <div className="app">
          <AppContents />
        </div>
      </FavoritesProvider>
    </Router>
  );
}

export default App;
