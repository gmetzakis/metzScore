# MetzScore - Sports Notifications App

A web application for real-time sports notifications.

## Features
- Live match scores
- Betting odds notifications
- Match insights
- Real-time updates

## Tech Stack
- **Frontend**: React (Vite)
- **Backend**: FastAPI (Python)
- **API**: live scores API

## Setup

### Prerequisites
- Node.js
- Python 3.8+
- pip

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```
3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

### Running the App

1. Start the backend:
   ```
   cd backend
   uvicorn main:app --reload
   ```
   Backend runs on http://localhost:8000

2. Start the frontend:
   ```
   cd frontend
   npm run dev
   ```
   Frontend runs on http://localhost:5173

### API Endpoints
- `GET /api/live-matches`: Fetch live match data

## Development
- Backend: Modify `backend/main.py`
- Frontend: Modify `frontend/src/App.jsx`