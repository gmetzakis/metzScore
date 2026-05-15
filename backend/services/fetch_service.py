import json
import os

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL")
DEFAULT_HEADERS_JSON = os.getenv("DEFAULT_HEADERS")

if not API_URL or not DEFAULT_HEADERS_JSON:
    raise ValueError("API_URL and DEFAULT_HEADERS environment variables are required.")

DEFAULT_HEADERS = json.loads(DEFAULT_HEADERS_JSON)


def fetch_api_data():
    """Fetch raw data from  API."""
    try:
        response = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise Exception(f"Failed to fetch  data: {str(e)}")


def extract_football_matches(raw_data):
    """
    Extract and parse football matches from  API response.
    Filters for FOOT sport type and returns clean match data.
    """
    matches = []

    try:
        # Navigate through the API response structure
        if not isinstance(raw_data, dict):
            return matches

        #  API structure: zones contain sports, sports contain leagues, leagues contain events
        zones = raw_data.get("Zones", [])

        for zone in zones:
            if not isinstance(zone, dict):
                continue

            sports = zone.get("Sports", [])

            for sport in sports:
                # Filter for football only (FOOT = Football)
                if sport.get("SportId") != "FOOT":
                    continue

                leagues = sport.get("Leagues", [])

                for league in leagues:
                    if not isinstance(league, dict):
                        continue

                    league_name = league.get("LeagueName", "Unknown League")
                    events = league.get("Events", [])

                    for event in events:
                        if not isinstance(event, dict):
                            continue

                        match = parse_match_event(event, league_name)
                        if match:
                            matches.append(match)

    except Exception as e:
        print(f"Error extracting football matches: {str(e)}")

    return matches


def parse_match_event(event, league_name):
    """Parse individual match event data."""
    try:
        event_id = event.get("EventId")
        start_time = event.get("StartTime")
        home_team = event.get("HomeTeam", "")
        away_team = event.get("AwayTeam", "")
        home_score = event.get("HomeScore", "-")
        away_score = event.get("AwayScore", "-")
        event_status = event.get("EventStatus", "")  # 0=Not started, 1=Live, 2=Finished

        return {
            "id": event_id,
            "league": league_name,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": get_match_status(event_status),
            "start_time": start_time,
            "raw_status": event_status,
        }
    except Exception as e:
        print(f"Error parsing match event: {str(e)}")
        return None


def get_match_status(event_status):
    """Convert event status code to human-readable status."""
    status_map = {"0": "Not Started", "1": "Live", "2": "Finished"}
    return status_map.get(str(event_status), "Unknown")


def get_live_football_matches():
    """Get only live football matches."""
    all_matches = get_all_football_matches()
    return [match for match in all_matches if match["raw_status"] == "1"]


def get_all_football_matches():
    """Get all football matches regardless of status."""
    raw_data = fetch_api_data()
    return extract_football_matches(raw_data)
