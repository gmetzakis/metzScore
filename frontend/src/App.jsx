import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AllMatchesPage from './pages/AllMatchesPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/all-matches" element={<AllMatchesPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App
