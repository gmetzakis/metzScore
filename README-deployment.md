# Deployment notes for MetzScore

## Backend
- FastAPI app runs on localhost port 8001.
- Nginx should proxy api.metzscore.me to that port.
- This does not touch the existing Watchlist nginx config.

## Frontend
- Set VITE_API_BASE_URL to https://api.metzscore.me/api in Vercel.

## Service manager
- Systemd unit file: backend/metzscore-api.service
- Nginx config: nginx-metzscore-api.conf
