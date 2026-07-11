import base64
import base64
import hashlib
import json
import os
from threading import Lock

import requests # type: ignore
from Crypto.Cipher import AES # type: ignore
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

SPORTRADAR_CLIENT_ID = "501a0202193e045569d09029e55c893c"
SPORTRADAR_LICENSING_URL = f"https://widgets.sir.sportradar.com/{SPORTRADAR_CLIENT_ID}/licensing"

SPORTRADAR_TOKEN = os.getenv("SPORTRADAR_TOKEN", "")
SPORTRADAR_FEEDS_URL = os.getenv("SPORTRADAR_FEEDS_URL", "https://widgets.fn.sportradar.com")
SPORTRADAR_CLIENT_ALIAS = os.getenv("SPORTRADAR_CLIENT_ALIAS", "stoiximan")
SPORTRADAR_LICENSING_JSON = None
SPORTRADAR_TOKEN_LOCK = Lock()

STATSSTREAM_SOURCE_CACHE = {}


def _get_app_mode():
    return os.getenv("APP_MODE", "local").strip().lower()


def _get_cors_origins():
    mode = _get_app_mode()

    if mode == "prod":
        origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "").split(",") if origin.strip()]
        return origins or ["http://localhost:5173", "http://localhost:5174"]

    if mode == "lan":
        return None

    return ["http://localhost:5173", "http://localhost:5174"]


def _get_cors_origin_regex():
    if _get_app_mode() != "lan":
        return None

    return r"^https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1\d\d|12[0-7])(?:\.\d{1,3}){2})(:\d+)?$"

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins() or [],
    allow_origin_regex=_get_cors_origin_regex(),
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


def _fetch_sportradar_licensing_blob():
    response = requests.get(
        SPORTRADAR_LICENSING_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json,text/plain,*/*",
            "referer": "https://www.stoiximan.gr/",
            "origin": "https://www.stoiximan.gr",
        },
        timeout=15,
    )
    response.raise_for_status()

    try:
        data = response.json()
    except ValueError:
        data = response.text

    if isinstance(data, dict) and "text" in data:
        return data["text"]

    return data


def _evp_bytes_to_key(password: bytes, salt: bytes, key_length: int = 32, iv_length: int = 16):
    derived = b""
    previous = b""

    while len(derived) < key_length + iv_length:
        previous = hashlib.md5(previous + password + salt).digest()
        derived += previous

    return derived[:key_length], derived[key_length:key_length + iv_length]


def _decrypt_sportradar_licensing_blob(encrypted: str, client_id: str):
    raw = base64.b64decode(encrypted)
    salt = b""
    ciphertext = raw

    if raw.startswith(b"Salted__") and len(raw) > 16:
        salt = raw[8:16]
        ciphertext = raw[16:]

    key, iv = _evp_bytes_to_key(client_id.encode("utf-8"), salt)
    decrypted = AES.new(key, AES.MODE_CBC, iv).decrypt(ciphertext)
    padding_length = decrypted[-1]

    if 0 < padding_length <= AES.block_size:
        decrypted = decrypted[:-padding_length]

    return json.loads(decrypted.decode("utf-8"))


def _extract_fishnet_token(lic_json):
    if not isinstance(lic_json, dict) or not lic_json.get("fishnetToken"):
        raise RuntimeError("fishnetToken not found in licensing JSON")

    token_obj = lic_json["fishnetToken"]

    if isinstance(token_obj, str):
        return token_obj

    if isinstance(token_obj, dict) and token_obj.get("token"):
        return token_obj["token"]

    raise RuntimeError("Unexpected fishnetToken format")


def _refresh_sportradar_settings():
    global SPORTRADAR_TOKEN, SPORTRADAR_FEEDS_URL, SPORTRADAR_CLIENT_ALIAS, SPORTRADAR_LICENSING_JSON

    licensing_blob = _fetch_sportradar_licensing_blob()
    licensing_json = _decrypt_sportradar_licensing_blob(licensing_blob, SPORTRADAR_CLIENT_ID)

    token = _extract_fishnet_token(licensing_json)
    SPORTRADAR_TOKEN = token
    SPORTRADAR_FEEDS_URL = licensing_json.get("fishnetFeedsUrl") or SPORTRADAR_FEEDS_URL or "https://widgets.fn.sportradar.com"
    SPORTRADAR_CLIENT_ALIAS = licensing_json.get("fishnetClientAlias") or SPORTRADAR_CLIENT_ALIAS or "stoiximan"
    SPORTRADAR_LICENSING_JSON = licensing_json
    return token


def get_sportradar_token(force_refresh=False):
    with SPORTRADAR_TOKEN_LOCK:
        if force_refresh or not SPORTRADAR_TOKEN:
            try:
                return _refresh_sportradar_settings()
            except Exception:
                if SPORTRADAR_TOKEN:
                    return SPORTRADAR_TOKEN
                raise

    return SPORTRADAR_TOKEN


def _is_unauthorized_feed_response(response):
    if response.status_code in (401, 403):
        return True

    response_text = response.text.lower()
    return "unauthorized feed" in response_text or ("unauthorized" in response_text and "feed" in response_text)


def _request_sportradar_json(url_builder, headers, timeout=20):
    last_error = None

    for attempt in range(2):
        token = get_sportradar_token(force_refresh=attempt == 1)
        response = requests.get(url_builder(token), headers=headers, timeout=timeout)

        if _is_unauthorized_feed_response(response):
            last_error = RuntimeError("Unauthorized feed response")
            continue

        response.raise_for_status()
        return response.json()

    if last_error is not None:
        raise last_error

    raise RuntimeError("Sportradar request failed")


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

def get_match_events_betradar(secondary_id: int):
    headers = {
        "User-Agent": "PostmanRuntime/7.51.1",
        "Accept": "*/*",
        "referer": "https://www.stoiximan.gr/",
        "origin": "https://www.stoiximan.gr"
    }

    return _request_sportradar_json(
        lambda token: f"{SPORTRADAR_FEEDS_URL.rstrip('/')}/{SPORTRADAR_CLIENT_ALIAS}/el/Etc:UTC/gismo/match_timelinedelta/{secondary_id}?T={token}",
        headers,
        timeout=15,
    )


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
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"https://statshub.sportradar.com/stoiximan/el/match/{secondary_id}/report",
        "Origin": "https://statshub.sportradar.com",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }

    payload = _request_sportradar_json(
        lambda token: f"https://sh.fn.sportradar.com/{SPORTRADAR_CLIENT_ALIAS}/el/Etc:UTC/gismo/match_detailsextended/{secondary_id}?T={token}",
        headers,
        timeout=20,
    )
    doc = payload.get("doc", [])
    if not doc:
        raise RuntimeError("Empty Sportradar match_detailsextended response")

    raw_doc = doc[0]
    if not isinstance(raw_doc, dict):
        raise RuntimeError("Unexpected Sportradar match_detailsextended payload")

    return raw_doc


def _fetch_match_standings_season_tables_raw(season_id: int):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"https://statshub.sportradar.com/stoiximan/el/match/{season_id}/report",
        "Origin": "https://statshub.sportradar.com",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }

    payload = _request_sportradar_json(
        lambda token: f"https://sh.fn.sportradar.com/{SPORTRADAR_CLIENT_ALIAS}/el/Etc:UTC/gismo/stats_season_tables/{season_id}//?T={token}",
        headers,
        timeout=20,
    )

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