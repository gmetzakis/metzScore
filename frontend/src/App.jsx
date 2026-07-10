import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FavoritesProvider, useFavorites } from './context/FavoritesContext';
import HomePage from './pages/HomePage';
import UpcomingMatchesPage from './pages/UpcomingMatchesPage';
import FavoritesPage from './pages/FavoritesPage';
import MatchDetailPage from './pages/MatchDetailPage';
import AlertsModal from './components/AlertsModal';
import useScoreAlertNotifications from './hooks/useScoreAlertNotifications';
import { apiService } from './services/api';
import './App.css';

function AppContents() {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [allMatches, setAllMatches] = useState([]);
  const { alertIds } = useFavorites();

  const fetchAllMatches = useCallback(async () => {
    try {
      const data = await apiService.getAllFootballMatches();
      setAllMatches(data.matches || []);
    } catch (err) {
      // Ignore fetch failures; the hook will retry on the next interval.
    }
  }, []);

  useEffect(() => {
    fetchAllMatches();
    const interval = setInterval(fetchAllMatches, 5000);
    return () => clearInterval(interval);
  }, [fetchAllMatches]);

  useScoreAlertNotifications(allMatches);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-title-link" aria-label="Go to live matches">
          <h1>MetzScore</h1>
        </Link>
        <button
          className="alerts-launcher"
          onClick={() => setAlertsOpen(true)}
          aria-label="Open alerts list"
          title="Open alerted matches"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.5 19C8.89555 19 7.01237 19 5.61714 19C4.87375 19 4.39116 18.2177 4.72361 17.5528L5.57771 15.8446C5.85542 15.2892 6 14.6774 6 14.0564C6 13.2867 6 12.1434 6 11C6 9 7 5 12 5C17 5 18 9 18 11C18 12.1434 18 13.2867 18 14.0564C18 14.6774 18.1446 15.2892 18.4223 15.8446L19.2764 17.5528C19.6088 18.2177 19.1253 19 18.382 19H14.5M9.5 19C9.5 21 10.5 22 12 22C13.5 22 14.5 21 14.5 19M9.5 19C11.0621 19 14.5 19 14.5 19" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.3}/>
            <path d="M12 5V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3}/>
          </svg> {alertIds.length > 0 && (<span className="alert-count">({alertIds.length})</span>)}
        </button>
      </header>
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
