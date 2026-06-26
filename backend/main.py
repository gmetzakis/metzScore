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

STATSSTREAM_SOURCE_CACHE = {}

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Vite dev servers
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


def get_betradar_match_id(match_id: int):
    try:
        detail = get_match_detail(match_id)
        betradar_id = detail.get("betradar_id") if isinstance(detail, dict) else None
        if betradar_id:
          return int(betradar_id)
    except Exception:
        pass

    stats_data = get_player_stats(match_id)
    stat_models = stats_data.get("data", {}).get("statPlayerModels", [])
    if isinstance(stat_models, list):
        for model in stat_models:
            if isinstance(model, dict) and model.get("matchId"):
                return int(model["matchId"])

    return None

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
    url = (f"https://widgets.fn.sportradar.com/stoiximan/el/Etc:UTC/gismo/match_timelinedelta/{secondary_id}?T=exp=1782552131~acl=/*~data=eyJvIjoiaHR0cHM6Ly93d3cuc3RvaXhpbWFuLmdyIiwiYSI6IjUwMWEwMjAyMTkzZTA0NTU2OWQwOTAyOWU1NWM4OTNjIiwiYWN0Ijoib3JpZ2luY2hlY2siLCJvc3JjIjoib3JpZ2luIn0~hmac=de4c546bb8c900ccd1fb14613579e398025e3c4eac515f74d44da9e14a2cef0a")

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


def _fetch_match_detailsextended(secondary_id: int):
    data = _fetch_match_detailsextended_raw(secondary_id).get("data", {})
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected Sportradar match_detailsextended payload")

    return data


def _get_betradar_season_id(secondary_id: int):
    payload = get_match_events_betradar(secondary_id)
    doc = payload.get('doc', []) if isinstance(payload, dict) else []
    if not isinstance(doc, list) or not doc:
        return None

    data = doc[0].get('data', {}) if isinstance(doc[0], dict) else {}
    if not isinstance(data, dict):
        return None

    match = data.get('match', {})
    if not isinstance(match, dict):
        return None

    season_id = match.get('_seasonid')
    return int(season_id) if season_id else None


def _build_match_standings_payload(match_id=None, secondary_id=None, allow_report_fallback=False):
    if match_id is not None:
        try:
            primary_payload = _fetch_match_standings_primary(match_id)
            rows = _extract_standings_rows(primary_payload)
            if rows:
                return {
                    "source": "statsstream/standings",
                    "match_id": match_id,
                    "data": rows,
                }
        except Exception:
            pass

        if not allow_report_fallback:
            return None

    if secondary_id is None and match_id is not None:
        try:
            secondary_id = get_betradar_match_id(match_id)
        except Exception:
            secondary_id = None

    if secondary_id is None:
        return None

    try:
        season_id = _get_betradar_season_id(secondary_id)
        if season_id is None:
            return None

        season_tables_payload = _fetch_match_standings_season_tables_raw(season_id)
        rows = _extract_standings_rows(season_tables_payload)
        if rows:
            return {
                "source": "stats_season_tables",
                "fallback": "report",
                "betradar_match_id": secondary_id,
                "season_id": season_id,
                "data": rows,
            }
    except Exception:
        return None

    return None


def _stat_value(values, key):
    entry = values.get(key, {})
    if not isinstance(entry, dict):
        return None, None

    pair = entry.get("value", {})
    if not isinstance(pair, dict):
        return None, None

    return pair.get("home"), pair.get("away")


def _to_number(value):
    if isinstance(value, (int, float)):
        return value

    if isinstance(value, str):
        try:
            number = float(value)
            return int(number) if number.is_integer() else number
        except ValueError:
            return value

    return value


def _standings_row_value(row, *keys):
    for key in keys:
        value = row.get(key)
        if value not in (None, ''):
            return value
    return None


def _clean_standings_name(name):
    if not name:
        return None
    cleaned = str(name).strip()
    if cleaned.startswith('|') and cleaned.endswith('|') and len(cleaned) > 1:
        cleaned = cleaned[1:-1]
    return cleaned


def _normalize_standings_row(row):
    if not isinstance(row, dict):
        return None

    display_name = _standings_row_value(row, 'translated_name', 'translatedName')
    if not display_name:
        display_name = _clean_standings_name(_standings_row_value(row, 'name'))

    if not display_name:
        return None

    played = _to_number(_standings_row_value(row, 'matches_played', 'played', 'matchesPlayed'))
    wins = _to_number(_standings_row_value(row, 'matches_won', 'wins', 'matchesWon'))
    draws = _to_number(_standings_row_value(row, 'matches_draw', 'draws', 'matchesDraw'))
    losses = _to_number(_standings_row_value(row, 'matches_lost', 'losses', 'matchesLost'))
    goals_for = _to_number(_standings_row_value(row, 'total_score_for', 'goals_for', 'goalsFor', 'gf'))
    goals_against = _to_number(_standings_row_value(row, 'total_score_against', 'goals_against', 'goalsAgainst', 'ga'))
    points = _to_number(_standings_row_value(row, 'points', 'pts'))
    rank = _to_number(_standings_row_value(row, 'rank', 'position', 'pos', 'place'))
    goal_diff = _standings_row_value(row, 'goal_diff', 'goalDifference', 'gd')
    if goal_diff in (None, '') and isinstance(goals_for, (int, float)) and isinstance(goals_against, (int, float)):
        goal_diff = goals_for - goals_against

    normalized = {
        'rank': rank,
        'team': display_name,
        'raw_name': _standings_row_value(row, 'name'),
        'played': played,
        'wins': wins,
        'draws': draws,
        'losses': losses,
        'goals_for': goals_for,
        'goals_against': goals_against,
        'goal_diff': _to_number(goal_diff),
        'points': points,
        'is_live': bool(row.get('is_live')),
        'rank_status_id': row.get('rank_status_id'),
    }

    if all(value in (None, '') for value in normalized.values() if value is not False):
        return None

    return normalized


def _normalize_season_table_row(row):
    if not isinstance(row, dict):
        return None

    team = row.get('team', {})
    if not isinstance(team, dict):
        return None

    team_name = team.get('mediumname') or team.get('name') or team.get('abbr')
    if not team_name:
        return None

    excluded_names = {'Σύνολο', 'Εντός έδρας', 'Εκτός έδρας', 'Αναλυτικά', 'Σύντομο'}
    if str(team_name).strip() in excluded_names:
        return None

    played = _to_number(row.get('total'))
    wins = _to_number(row.get('winTotal'))
    draws = _to_number(row.get('drawTotal'))
    losses = _to_number(row.get('lossTotal'))
    goals_for = _to_number(row.get('goalsForTotal'))
    goals_against = _to_number(row.get('goalsAgainstTotal'))
    points = _to_number(row.get('pointsTotal'))
    rank = _to_number(row.get('pos') or row.get('sortPositionTotal'))
    goal_diff = _to_number(row.get('goalDiffTotal'))

    if goal_diff in (None, '') and isinstance(goals_for, (int, float)) and isinstance(goals_against, (int, float)):
        goal_diff = goals_for - goals_against

    normalized = {
        'rank': rank,
        'team': _clean_standings_name(team_name),
        'raw_name': team.get('name'),
        'played': played,
        'wins': wins,
        'draws': draws,
        'losses': losses,
        'goals_for': goals_for,
        'goals_against': goals_against,
        'goal_diff': goal_diff,
        'points': points,
        'is_live': bool(row.get('is_live')),
        'rank_status_id': row.get('rank_status_id'),
    }

    if all(value in (None, '') for value in normalized.values() if value is not False):
        return None

    return normalized


def _extract_standings_rows(node):
    if isinstance(node, dict):
        payloads = []

        data = node.get('data')
        if isinstance(data, dict):
            payloads.append(data)

        doc = node.get('doc')
        if isinstance(doc, list):
            for entry in doc:
                entry_data = entry.get('data') if isinstance(entry, dict) else None
                if isinstance(entry_data, dict):
                    payloads.append(entry_data)

        for payload in payloads:
            tables = payload.get('tables')
            if isinstance(tables, list):
                for table in tables:
                    tablerows = table.get('tablerows') if isinstance(table, dict) else None
                    if isinstance(tablerows, list):
                        rows = [_normalize_season_table_row(item) for item in tablerows]
                        rows = [row for row in rows if row is not None]
                        if rows:
                            return rows

            phases = payload.get('phases')
            if isinstance(phases, list):
                for phase in phases:
                    groups = phase.get('groups') if isinstance(phase, dict) else None
                    if not isinstance(groups, list):
                        continue
                    for group in groups:
                        standings = group.get('standings') if isinstance(group, dict) else None
                        if isinstance(standings, list):
                            rows = [_normalize_standings_row(item) for item in standings]
                            rows = [row for row in rows if row is not None]
                            if rows:
                                return rows

        for key in ('standings', 'standing', 'table', 'tables', 'ranking', 'rankings'):
            if key in node:
                rows = _extract_standings_rows(node[key])
                if rows:
                    return rows

        for value in node.values():
            rows = _extract_standings_rows(value)
            if rows:
                return rows

    if isinstance(node, list):
        normalized_rows = []
        for item in node:
            row = _normalize_standings_row(item)
            if row is not None:
                normalized_rows.append(row)

        if len(normalized_rows) >= 2:
            return normalized_rows

        for item in node:
            rows = _extract_standings_rows(item)
            if rows:
                return rows

    return None


def _fetch_match_standings_primary(match_id: int):
    url = f"https://www.stoiximan.gr/api/statsstream/{match_id}/standings/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.stoiximan.gr/live-scores/",
        "Origin": "https://www.stoiximan.gr",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "x-language": "2",
        "x-operator": "2",
    }

    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.json()


def _fetch_match_detailsextended_raw(secondary_id: int):
    url = (
        f"https://sh.fn.sportradar.com/stoiximan/el/Etc:UTC/gismo/match_detailsextended/{secondary_id}"
        "?T=exp=1782495362~acl=/*~data=eyJvIjoiaHR0cHM6Ly9zdGF0c2h1Yi5zcG9ydHJhZGFyLmNvbSIsImEiOiJzdG9peGltYW4iLCJhY3QiOiJvcmlnaW5jaGVjayIsIm9zcmMiOiJob3N0aGVhZGVyIn0~hmac=c41664e9883e7a1e793d3df5ed8991b4b045dafc33f7dc598279e2efc6454fad"
    )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"https://statshub.sportradar.com/stoiximan/el/match/{secondary_id}/report",
        "Origin": "https://statshub.sportradar.com",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }

    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()
    payload = resp.json()
    doc = payload.get("doc", [])
    if not doc:
        raise RuntimeError("Empty Sportradar match_detailsextended response")

    raw_doc = doc[0]
    if not isinstance(raw_doc, dict):
        raise RuntimeError("Unexpected Sportradar match_detailsextended payload")

    return raw_doc


def _fetch_match_standings_season_tables_raw(season_id: int):
    url = (
        f"https://sh.fn.sportradar.com/stoiximan/el/Etc:UTC/gismo/stats_season_tables/{season_id}//"
        "?T=exp=1782564482~acl=/*~data=eyJvIjoiaHR0cHM6Ly9zdGF0c2h1Yi5zcG9ydHJhZGFyLmNvbSIsImEiOiJzdG9peGltYW4iLCJhY3QiOiJvcmlnaW5jaGVjayIsIm9zcmMiOiJob3N0aGVhZGVyIn0~hmac=8a06be01d49a9fefcaaace0a6c683c219b1cd0abcfdd1e29fc5cc79561954a64"
    )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"https://statshub.sportradar.com/stoiximan/el/match/{season_id}/report",
        "Origin": "https://statshub.sportradar.com",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }

    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()
    payload = resp.json()

    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected Sportradar stats_season_tables payload")

    return payload


def _build_match_detailsextended_stats_payload(secondary_id: int):
    data = _fetch_match_detailsextended(secondary_id)
    values = data.get("values", {}) if isinstance(data, dict) else {}
    match = data.get("match", {}) if isinstance(data, dict) else {}
    result = match.get("result", {}) if isinstance(match, dict) else {}

    on_home, on_away = _stat_value(values, "125")
    off_home, off_away = _stat_value(values, "126")
    blocked_home, blocked_away = _stat_value(values, "171")

    home_total = {
        "goals": _to_number(result.get("home", 0) or 0),
        "yellow_cards": _to_number(_stat_value(values, "40")[0] or 0),
        "red_cards": _to_number(_stat_value(values, "50")[0] or 0),
        "corners": _to_number(_stat_value(values, "124")[0] or 0),
        "fouls": _to_number(_stat_value(values, "129")[0] or 0),
        "offsides": _to_number(_stat_value(values, "123")[0] or 0),
        "shots_on_target": _to_number(on_home or 0),
        "shots_off_target": _to_number(off_home or 0),
        "shots_blocked": _to_number(blocked_home or 0),
        "total_shots": _to_number((on_home or 0) + (off_home or 0) + (blocked_home or 0)),
        "attacks": _to_number(_stat_value(values, "1126")[0] or 0),
        "dangerous_attacks": _to_number(_stat_value(values, "1029")[0] or 0),
        "possession": _to_number(_stat_value(values, "1030")[0] or 0),
        "goalkeeper_saves": _to_number(_stat_value(values, "127")[0] or 0),
        "penalties": _to_number(_stat_value(values, "161")[0] or 0),
        "throw_ins": _to_number(_stat_value(values, "122")[0] or 0),
        "free_kicks": _to_number(_stat_value(values, "120")[0] or 0),
        "goalkicks": _to_number(_stat_value(values, "121")[0] or 0),
        "substitutions": _to_number(_stat_value(values, "60")[0] or 0),
        "injuries": _to_number(_stat_value(values, "158")[0] or 0),
    }

    away_total = {
        "goals": _to_number(result.get("away", 0) or 0),
        "yellow_cards": _to_number(_stat_value(values, "40")[1] or 0),
        "red_cards": _to_number(_stat_value(values, "50")[1] or 0),
        "corners": _to_number(_stat_value(values, "124")[1] or 0),
        "fouls": _to_number(_stat_value(values, "129")[1] or 0),
        "offsides": _to_number(_stat_value(values, "123")[1] or 0),
        "shots_on_target": _to_number(on_away or 0),
        "shots_off_target": _to_number(off_away or 0),
        "shots_blocked": _to_number(blocked_away or 0),
        "total_shots": _to_number((on_away or 0) + (off_away or 0) + (blocked_away or 0)),
        "attacks": _to_number(_stat_value(values, "1126")[1] or 0),
        "dangerous_attacks": _to_number(_stat_value(values, "1029")[1] or 0),
        "possession": _to_number(_stat_value(values, "1030")[1] or 0),
        "goalkeeper_saves": _to_number(_stat_value(values, "127")[1] or 0),
        "penalties": _to_number(_stat_value(values, "161")[1] or 0),
        "throw_ins": _to_number(_stat_value(values, "122")[1] or 0),
        "free_kicks": _to_number(_stat_value(values, "120")[1] or 0),
        "goalkicks": _to_number(_stat_value(values, "121")[1] or 0),
        "substitutions": _to_number(_stat_value(values, "60")[1] or 0),
        "injuries": _to_number(_stat_value(values, "158")[1] or 0),
    }

    return {
        "source": "match_detailsextended",
        "betradar_match_id": secondary_id,
        "data": {
            "home": {"total": home_total},
            "away": {"total": away_total},
        },
    }


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


def get_statsstream_detailed(match_id: int):
    url = f"https://www.stoiximan.gr/api/statsstream/{match_id}/stats/detailed/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.stoiximan.gr/live-scores/",
        "Origin": "https://www.stoiximan.gr",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "x-language": "2",
        "x-operator": "2",
    }

    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.json()


@app.get("/api/football/statsstream/detailed/{match_id}")
def get_statsstream_detailed_endpoint(
    match_id: int = Path(..., description="Stoiximan match id")
):
    try:
        if STATSSTREAM_SOURCE_CACHE.get(match_id) == "report":
            secondary_id = get_betradar_match_id(match_id)
            if secondary_id is not None:
                data = _build_match_detailsextended_stats_payload(secondary_id)
                standings = _build_match_standings_payload(match_id, secondary_id, allow_report_fallback=True)
                return {
                    "status": "success",
                    "match_id": match_id,
                    "fallback": "report",
                    **({"standings": standings} if standings else {}),
                    **data,
                }

        data = get_statsstream_detailed(match_id)
        STATSSTREAM_SOURCE_CACHE[match_id] = "statsstream"
        standings = _build_match_standings_payload(match_id)
        return {
            "status": "success",
            "match_id": match_id,
            **({"standings": standings} if standings else {}),
            **data,
        }
    except Exception as detail_error:
        try:
            secondary_id = get_betradar_match_id(match_id)
            if secondary_id is None:
                raise RuntimeError(f"Could not resolve Betradar id for match {match_id}")

            data = _build_match_detailsextended_stats_payload(secondary_id)
            STATSSTREAM_SOURCE_CACHE[match_id] = "report"
            standings = _build_match_standings_payload(match_id, secondary_id, allow_report_fallback=True)
            return {
                "status": "success",
                "match_id": match_id,
                "fallback": "report",
                **({"standings": standings} if standings else {}),
                **data,
            }
        except Exception as fallback_error:
            return {
                "status": "error",
                "message": f"{detail_error}; fallback failed: {fallback_error}",
            }


@app.get("/api/football/statsstream/report/{secondary_id}")
def get_statsstream_report_endpoint(
    secondary_id: int = Path(..., description="Betradar match id")
):
    try:
        data = _build_match_detailsextended_stats_payload(secondary_id)
        standings = _build_match_standings_payload(None, secondary_id, allow_report_fallback=True)
        return {
            "status": "success",
            "match_id": secondary_id,
            **({"standings": standings} if standings else {}),
            **data,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }