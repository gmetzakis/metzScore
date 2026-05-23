import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FavoritesProvider } from './context/FavoritesContext';
import HomePage from './pages/HomePage';
import AllMatchesPage from './pages/AllMatchesPage';
import FavoritesPage from './pages/FavoritesPage';
import MatchDetailPage from './pages/MatchDetailPage';
import './App.css';

function App() {
  return (
    <Router>
      <FavoritesProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/all-matches" element={<AllMatchesPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/match/:matchId" element={<MatchDetailPage />} />
          </Routes>
        </div>
      </FavoritesProvider>
    </Router>
  );
}

export default App;
