import json
import os

import requests  # type: ignore
from dotenv import load_dotenv  # type: ignore

load_dotenv()

DEFAULT_HEADERS_JSON = os.getenv("DEFAULT_HEADERS")
DEFAULT_HEADERS = json.loads(DEFAULT_HEADERS_JSON)


def _get_detail_headers() -> dict:
    """Headers that unlock the per-match detail endpoint.
    The two extra headers below were identified via Postman capture.
    Everything else comes from the .env DEFAULT_HEADERS block.
    """
    return {
        **DEFAULT_HEADERS,
        "x-language": "2",
        "x-operator": "2",
    }


def _get_raw_data() -> dict:
    """Fetch the live overview (matches list, all markets, all selections)."""
    resp = requests.get(
        os.getenv("API_URL"),
        headers=DEFAULT_HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def _get_match_detail_raw(event_id: int) -> dict:
    """Fetch the per-match detail endpoint.
    https://www.stoiximan.gr/danae-webapi/api/live/events/{event_id}/latest
    Requires x-language + x-operator headers (unlocked in Postman).
    Returns the full response body containing 'event', 'markets' and 'selections'.
    """
    url = (
        f"https://www.stoiximan.gr/danae-webapi/api/live/events/"
        f"{event_id}/latest"
    )
    resp = requests.get(url, headers=_get_detail_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_match_detail(event_id: int) -> dict | None:
    """Return the full detail payload for a single match.
    Calls the per-match detail endpoint so incidents, statistics,
    incidentFilters and markets are all present.
    """
    raw = _get_match_detail_raw(event_id)

    # Detail endpoint wraps data at 'event' key (singular)
    base_event = raw.get("event")
    if not isinstance(base_event, dict):
        return None

    events_wrapper = raw.get("events", {})
    event = events_wrapper.get(str(event_id)) or base_event
    if not isinstance(event, dict):
        return None

    markets_dict   = raw.get("markets", {})     or {}
    selections_dict = raw.get("selections", {}) or {}

    leagues = _get_raw_data().get("leagues", {})
    zone_id = event.get("zoneId")
    league_id = event.get("leagueId")
    league  = leagues.get(str(league_id), {}) if league_id else {}
    zone    = raw.get("zones", {}).get(str(zone_id), {}) if zone_id else {}

    participants = event.get("participants", [])
    home = next((p for p in participants if p.get("isHome")), {})
    away = next((p for p in participants if not p.get("isHome")), {})

    live_data = event.get("liveData", {})
    score     = live_data.get("score", {})
    clock     = live_data.get("clock", {})
    results   = live_data.get("results", {})

    incidents       = event.get("incidents", []) or []
    incident_filters = event.get("incidentFilters", []) or []
    statistics      = event.get("statistics", {}) or {}
    roster          = event.get("roster", {}) or {}

    # Parse markets for this match
    odds = {}
    for mid in event.get("marketIdList", []):
        mid_str = str(mid)
        mk = markets_dict.get(mid_str)
        if not isinstance(mk, dict):
            continue
        sel_ids = mk.get("selectionIdList", [])
        sels = []
        for sid in sel_ids:
            s = selections_dict.get(str(sid))
            if isinstance(s, dict):
                sels.append({
                    "id":       sid,
                    "name":     s.get("name"),
                    "fullName": s.get("fullName"),
                    "price":    s.get("price"),
                    "handicap": s.get("handicap"),
                })
        if sels:
            type_id = str(mk.get("typeId"))
            key = type_id
            # For Over/Under markets (HCTG, OUH1, etc.), create unique keys per handicap
            if mk.get("type") in ("HCTG", "OUH1") and mk.get("handicap") is not None:
                key = f"{type_id}_{mk.get('handicap')}"
            odds[key] = {
                "market_id":   mid,
                "market_type": mk.get("typeId"),
                "name":        mk.get("name"),
                "handicap":    mk.get("handicap"),
                "selections":  sels,
            }

    return {
        "match_id":    event_id,
        "is_live":     event.get("isLive", False),
        "will_go_live": event.get("willGoLive", False),
        "status":      "Live" if event.get("isLive") else
                       ("Not Started" if event.get("willGoLive") else "Finished"),
        "start_time":  event.get("startTime"),
        "display_order": event.get("displayOrder"),
        "url":         event.get("url"),
        "betradar_id": event.get("betradarMatchId"),
        "total_markets": event.get("totalMarketsAvailable"),
        "is_pitch_available":       event.get("isPitchAvailable", False),
        "is_stats_available":       event.get("isPrettyTechStatsAvailable", False),
        "league": {
            "id":    league_id,
            "name":  league.get("name", "Unknown League"),
            "url":   event.get("breadcrumbUrls", {}).get("league"),
        },
        "zone": {
            "id":    zone_id,
            "name":  zone.get("name", ""),
            "code":  zone.get("code", ""),
            "url":   event.get("breadcrumbUrls", {}).get("zone"),
        },
        "home_team": {
            "id":   home.get("teamId"),
            "name": home.get("name", "Home"),
        },
        "away_team": {
            "id":   away.get("teamId"),
            "name": away.get("name", "Away"),
        },
        "score": {
            "home": score.get("home", "-"),
            "away": score.get("away", "-"),
            "seconds_since_start": clock.get("secondsSinceStart", 0),
        },
        "results": results,
        "odds":         odds,
        "incidents":    incidents,
        "incident_filters": incident_filters,
        "statistics":   statistics,
        "roster":       roster,
    }
