import json
import os

import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.fetch_service import (
    get_all_football_matches,
    get_live_football_matches,
)

load_dotenv()
app = FastAPI(
    title="Sports Notifications API",
    description="Professional sports notifications API with football focus",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Sports Notifications API",
        "version": "1.0.0",
        "endpoints": {
            "football_live": "/api/football/matches/live",
            "football_all": "/api/football/matches/all",
        },
    }


@app.get("/api/football/matches/live")
def get_live_football():
    """Get all live football matches."""
    try:
        matches = get_live_football_matches()
        return {
            "status": "success",
            "sport": "Football",
            "count": len(matches),
            "matches": matches,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500


@app.get("/api/football/matches/all")
def get_all_football():
    """Get all football matches (live and upcoming)."""
    try:
        matches = get_all_football_matches()
        print(matches)
        return {
            "status": "success",
            "sport": "Football",
            "count": len(matches),
            "matches": matches,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500
