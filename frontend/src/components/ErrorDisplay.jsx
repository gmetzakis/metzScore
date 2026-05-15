import './ErrorDisplay.css';

export default function ErrorDisplay({ error }) {
  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{error || 'Failed to load matches. Please try again later.'}</p>
    </div>
  );
}
