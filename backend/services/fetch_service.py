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
        is_live = event.get("isLive", False)
        
        # Extract scores and time from liveData
        home_score = "-"
        away_score = "-"
        match_time = "-"
        injury_time = 0
        
        live_data = event.get("liveData")
        if isinstance(live_data, dict):
            # Extract scores
            score_data = live_data.get("score")
            if isinstance(score_data, dict):
                home_score = score_data.get("home", "-")
                away_score = score_data.get("away", "-")
            
            # Extract time and format as MM:SS with injury time
            clock_data = live_data.get("clock")
            if isinstance(clock_data, dict):
                seconds_since_start = clock_data.get("secondsSinceStart", 0)
                match_time = format_match_time(seconds_since_start)
            
            # Extract injury time
            results_data = live_data.get("results")
            if isinstance(results_data, dict):
                injury_time = results_data.get("injuryTime", 0)

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

        # Extract odds/markets
        odds = extract_match_odds(event, raw_data)

        return {
            "id": event_id,
            "league": league_name,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": "Live" if is_live else "Not Started",
            "match_time": match_time,
            "injury_time": injury_time,
            "start_time": start_time,
            "is_live": is_live,
            "odds": odds,
        }
    except Exception as e:
        print(f"Error parsing match event: {str(e)}")
        return None


def extract_match_odds(event, raw_data):
    """Extract odds and markets for a match."""
    try:
        odds = {}
        market_id_list = event.get("marketIdList", [])
        markets_dict = raw_data.get("markets", {})
        selections_dict = raw_data.get("selections", {})
        
        if not isinstance(market_id_list, list):
            return odds
        
        # Extract all markets for this event (up to 15 to capture all FOOT types)
        for market_id in market_id_list[:15]:
            market_id_str = str(market_id)
            if market_id_str not in markets_dict:
                continue
            
            market = markets_dict[market_id_str]
            if not isinstance(market, dict):
                continue
            
            market_type = market.get("typeId") or market.get("type")
            market_name = market.get("name", "Market")
            selection_ids = market.get("selectionIdList", [])
            
            # Extract selections for this market
            selections = []
            for sel_id in selection_ids:
                sel_id_str = str(sel_id)
                if sel_id_str in selections_dict:
                    selection = selections_dict[sel_id_str]
                    if isinstance(selection, dict):
                        selections.append({
                            "id": sel_id,
                            "name": selection.get("name"),
                            "fullName": selection.get("fullName"),
                            "price": selection.get("price"),
                            "handicap": selection.get("handicap"),
                        })
            
            # Add to odds dict if we have selections
            if selections:
                odds[str(market_type)] = {
                    "market_id": market_id,
                    "market_name": market_name,
                    "market_type": market_type,
                    "selections": selections,
                }
        
        return odds
    except Exception as e:
        print(f"Error extracting odds: {str(e)}")
        return {}


def format_match_time(seconds_since_start):
    """
    Format match time as MM:SS with injury time handling.
    Converts seconds to minutes:seconds format.
    """
    total_minutes = seconds_since_start // 60
    seconds = seconds_since_start % 60
    
    # Determine if in first half, second half, etc.
    # Standard match: 45 min first half, 45 min second half
    # Extra time: 15 min per period
    
    if total_minutes <= 45:
        # First half
        return f"{total_minutes}:{seconds:02d}"
    elif total_minutes <= 90:
        # Second half
        return f"{total_minutes}:{seconds:02d}"
    elif total_minutes <= 105:
        # First extra time period
        minutes_in_period = total_minutes - 90
        return f"90+{minutes_in_period}:{seconds:02d}"
    else:
        # Second extra time period
        minutes_in_period = total_minutes - 105
        return f"105+{minutes_in_period}:{seconds:02d}"



def get_live_football_matches():
    """Get only live football matches."""
    all_matches = get_all_football_matches()
    return [match for match in all_matches if match.get("is_live", False)]


def get_all_football_matches():
    """Get all football matches regardless of status."""
    raw_data = fetch_api_data()
    return extract_football_matches(raw_data)
