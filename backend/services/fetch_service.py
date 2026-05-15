import json
import os

import requests # type: ignore
from dotenv import load_dotenv # type: ignore

load_dotenv()

API_URL = os.getenv("API_URL")
DEFAULT_HEADERS_JSON = os.getenv("DEFAULT_HEADERS")

if not API_URL or not DEFAULT_HEADERS_JSON:
    raise ValueError("API_URL and DEFAULT_HEADERS environment variables are required.")

DEFAULT_HEADERS = json.loads(DEFAULT_HEADERS_JSON)


def fetch_api_data():
    """Fetch raw data from Stoiximan API."""
    try:
        response = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise Exception(f"Failed to fetch Stoiximan data: {str(e)}")


def extract_football_matches(raw_data):
    """
    Extract and parse football matches from Stoiximan API response.
    Filters for FOOT sport type and returns clean match data.
    """
    matches = []

    try:
        # Navigate through the API response structure
        if not isinstance(raw_data, dict):
            print(f"Error: raw_data is not a dict, it's a {type(raw_data)}")
            return matches

        # The API structure has top-level keys: sports, zones, leagues, events, markets, selections
        # Events are at the top level
        events_dict = raw_data.get("events", {})

        # Iterate through events
        if isinstance(events_dict, dict):
            for event_id, event in events_dict.items():
                if not isinstance(event, dict):
                    continue
                
                # Get sport ID to filter for football
                sport_id = event.get("sportId")
                
                # Filter for football only (FOOT = Football)
                if sport_id != "FOOT":
                    continue
                
                # Get league info
                league_id = event.get("leagueId")
                league_name = "Unknown League"
                
                # Look up league name from top-level leagues
                leagues_dict = raw_data.get("leagues", {})
                # Convert league_id to string for lookup since dict keys are strings
                if league_id:
                    league_str = str(league_id)
                    if league_str in leagues_dict:
                        league_name = leagues_dict[league_str].get("name", "Unknown League")
                
                match = parse_match_event(event, league_name, raw_data)
                if match:
                    matches.append(match)

    except Exception as e:
        print(f"Error extracting football matches: {str(e)}")
        import traceback
        traceback.print_exc()

    return matches


def parse_match_event(event, league_name, raw_data):
    """Parse individual match event data."""
    try:
        event_id = event.get("id")
        start_time = event.get("startTime")
        home_score = event.get("homeScore", "-")
        away_score = event.get("awayScore", "-")
        event_status = event.get("eventStatus", "")  # 0=Not started, 1=Live, 2=Finished

        # Extract team names from participants
        home_team = "Unknown"
        away_team = "Unknown"
        
        participants = event.get("participants", [])
        if isinstance(participants, list):
            for participant in participants:
                if isinstance(participant, dict):
                    is_home = participant.get("isHome", False)
                    name = participant.get("name", "Unknown")
                    
                    if is_home:
                        home_team = name
                    else:
                        away_team = name

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
