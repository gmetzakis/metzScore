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

### Configuration

Use `APP_MODE` as the main switch:

- `APP_MODE=local` is the default for a normal desktop setup.
- `APP_MODE=lan` is for opening the frontend from your phone on the same network.
- `APP_MODE=prod` is for hosted deployment.

The frontend no longer needs a mode flag for local or LAN use; it automatically calls the backend on the current host plus port `8000`.

Production still allows an explicit backend URL override with `VITE_API_BASE_URL` in `frontend/.env`.

Default local setup:

- Set `APP_MODE=local` in `backend/.env`.
- Leave `VITE_API_BASE_URL` unset.

Mobile or LAN setup:

- Set `APP_MODE=lan` in `backend/.env`.
- Run the backend and frontend on `0.0.0.0`.
- Open the frontend using your machine's LAN IP, for example `http://100.119.127.41:5173`.
- Leave `VITE_API_BASE_URL` unset.

Hosted deployment:

- Set `APP_MODE=prod` in `backend/.env` and `frontend/.env`.
- Set `VITE_API_BASE_URL` to the public backend URL, for example `https://api.example.com/api`.
- Set `FRONTEND_ORIGINS` in `backend/.env` to the public frontend URL, for example `https://app.example.com`.

### API Endpoints
- `GET /api/live-matches`: Fetch live match data

## Development
- Backend: Modify `backend/main.py`
- Frontend: Modify `frontend/src/App.jsx`