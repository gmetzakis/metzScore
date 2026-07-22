# FastAPI deployment notes

This app can run behind Nginx on the VM without affecting the existing Watchlist deployment.

## Recommended setup
- Backend listens on port 8001 on localhost only.
- Nginx exposes it under api.metzscore.me.
- Frontend calls https://api.metzscore.me/api.

## Run locally
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./start.sh
```

## Production env
Create backend/.env with:
```bash
APP_MODE=prod
FRONTEND_ORIGINS=https://metzscore.me,https://www.metzscore.me
```
