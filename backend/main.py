import json
import os

import requests # type: ignore
from dotenv import load_dotenv # type: ignore
from fastapi import FastAPI # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from fastapi.param_functions import Path # type: ignore

from services.fetch_service import (
    get_all_football_matches,
    get_live_football_matches,
)
from services.match_detail_service import get_match_detail

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
            "football_detail": "/api/football/matches/{match_id}",
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
    """Get upcoming football matches (live and upcoming)."""
    try:
        matches = get_all_football_matches()
        #print(matches)
        return {
            "status": "success",
            "sport": "Football",
            "count": len(matches),
            "matches": matches,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500


@app.get("/api/football/matches/{match_id}")
def get_match_detail_endpoint(
    match_id: int = Path(..., description="Event / match id from the list endpoint")
):
    """Return the full detail payload for a single match."""
    try:
        data = get_match_detail(match_id)
        if data is None:
            return {"status": "error", "message": f"Match {match_id} not found"}, 404
        return {"status": "success", **data}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500



def get_player_stats(match_id: int):
    url = (f"https://www.stoiximan.gr/api/liveevent/statsplayer?id={match_id}")

    headers = {
        "User-Agent": "PostmanRuntime/7.51.1",
        "Accept": "*/*"
    }

    resp = requests.get(
        url,
        headers=headers,
        timeout=15
    )
    resp.raise_for_status()
    return resp.json()

@app.get("/api/football/statsplayer/{match_id}")
def get_statsplayer_endpoint(
    match_id: int = Path(..., description="Stoiximan match id")
):
    try:
        data = get_player_stats(match_id)

        return data

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
    

def get_match_events_betradar(secondary_id: int):
    url = (f"https://widgets.fn.sportradar.com/stoiximan/el/Etc:UTC/gismo/match_timelinedelta/{secondary_id}?T=exp=1782128771~acl=/*~data=eyJvIjoiaHR0cHM6Ly93d3cuc3RvaXhpbWFuLmdyIiwiYSI6IjUwMWEwMjAyMTkzZTA0NTU2OWQwOTAyOWU1NWM4OTNjIiwiYWN0Ijoib3JpZ2luY2hlY2siLCJvc3JjIjoib3JpZ2luIn0~hmac=c4ee6ad2a35cea57ea3cf1012bbec97d6710769b4eba9e77aa1d0bc8e2410dfb")

    headers = {
        "User-Agent": "PostmanRuntime/7.51.1",
        "Accept": "*/*",
        "referer": "https://www.stoiximan.gr/",
        "origin": "https://www.stoiximan.gr"
    }

    resp = requests.get(
        url,
        headers=headers,
        timeout=15
    )
    resp.raise_for_status()
    print(resp.json())
    return resp.json()


@app.get("/api/football/matchstats/betradar/{secondary_id}")
def get_statsplayer_endpoint(
    secondary_id: int = Path(..., description="Stoiximan match id")
):
    try:
        data = get_match_events_betradar(secondary_id)

        return data

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }