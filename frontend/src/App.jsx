import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/live-matches')
      if (!response.ok) throw new Error('Failed to fetch matches')
      const data = await response.json()
      setMatches(data) // Assuming data is an array or object with matches
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="App">
      <h1>Sports Notifications</h1>
      {loading && <p>Loading live matches...</p>}
      {error && <p>Error: {error}</p>}
      <div>
        {matches.length > 0 ? (
          matches.map((match, index) => (
            <div key={index}>
              <p>{match.home} vs {match.away} - Score: {match.score}</p>
            </div>
          ))
        ) : (
          !loading && <p>No live matches available.</p>
        )}
      </div>
    </div>
  )
}

export default App
