import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 1000;
const MAX_ERRORS       = 5;

// Notable event types that should trigger a toast on the pitch.
// Uses _doctype / type values actually observed in the API.
const NOTABLE_TYPES = new Set([
  'corner',
  'throwin',
  'freekick',
  'goalkick',
  'shot',
  'shotontarget',
  'shotofftarget',
  'goalkeepersave',
  'save',
  'card',
  'possibleevent',
  'var',
  'penalty',
  'goal',
  'substitution',
  'foul',
  'attack',
  'dangerousattack',
  'possession',
]);

function normalizeType(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readPoint(value) {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const [x, y] = value;
    if (typeof x === 'number' && typeof y === 'number') {
      return { x, y };
    }
  }

  if (typeof value === 'object') {
    const x = typeof value.X === 'number' ? value.X : value.x;
    const y = typeof value.Y === 'number' ? value.Y : value.y;
    if (typeof x === 'number' && typeof y === 'number') {
      return { x, y };
    }
  }

  return null;
}

function readPath(coords) {
  if (!Array.isArray(coords)) return [];

  if (
    coords.length >= 4 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number' &&
    typeof coords[2] === 'number' &&
    typeof coords[3] === 'number'
  ) {
    return [
      { x: coords[0], y: coords[1] },
      { x: coords[2], y: coords[3] },
    ];
  }

  return coords.map(readPoint).filter(Boolean);
}

function extractEventText(event) {
  return event?.description || event?.name || event?.title || event?.player?.name || null;
}

function buildMarkerKey(marker) {
  return [
    marker.id || '',
    marker.type || '',
    marker.time || '',
    marker.seconds || '',
    marker.x ?? '',
    marker.y ?? '',
    marker.playerName || '',
    marker.name || '',
  ].join('|');
}

function normalizeNumericId(value) {
  if (value == null) return null;
  const asString = String(value).trim();
  return /^\d+$/.test(asString) ? asString : null;
}

function parseBetradarEvents(events = []) {
  if (!Array.isArray(events) || !events.length) return null;

  let situation     = null;
  let situationTeam = null;
  let ballPos       = null;
  let ballEnd       = null;
  let attackPath    = [];
  let latestMarker  = null;
  const markers     = [];

  for (const e of events) {
    if (!e || e.disabled) continue;

    // Use _doctype as authoritative type; fall back to type field.
    const doctype = normalizeType(e._doctype || e.type);

    // ── Match situation (primary source of ball pos + game state) ────────
    if (doctype === 'matchsituation') {
      situation     = e.situation || situation;   // 'dangerous' | 'attack' | 'safe'
      situationTeam = e.team      || null;

      if (typeof e.X === 'number' && typeof e.Y === 'number') {
        ballPos = { x: e.X, y: e.Y };
      }
    }

    // ── Ball coordinates (companion events — coords[] is always empty,
    //    but X/Y may still be present on some implementations) ──────────
    if (doctype === 'ballcoordinates') {
      const path = readPath(e.coordinates);

      if (path.length > 0) {
        ballPos = path[0];
        if (path.length > 1) {
          ballEnd = path[path.length - 1];
        }
        attackPath = path;
      } else if (typeof e.X === 'number' && typeof e.Y === 'number') {
        ballPos = { x: e.X, y: e.Y };
      }

      if (!ballEnd && typeof e.endX === 'number' && typeof e.endY === 'number') {
        ballEnd = { x: e.endX, y: e.endY };
      }
    }

    // ── Notable events (corner, freekick, card, shot, save, etc.) ────────
    if (NOTABLE_TYPES.has(doctype)) {
      const marker = {
        id:         e._id,
        type:       doctype,
        team:       e.team  || null,
        description: extractEventText(e),
        time:       e.time  ?? null,
        seconds:    e.seconds ?? null,
        x:          typeof e.X === 'number' ? e.X : null,
        y:          typeof e.Y === 'number' ? e.Y : null,
        name:       e.name  || null,
        // Card-specific
        card:       e.card  || null,          // 'yellow' | 'red'
        playerName: e.player?.name || null,
      };

      marker.key = buildMarkerKey(marker);
      markers.push(marker);
      latestMarker = marker;
    }
  }

  return {
    situation,
    situationTeam,
    ballPos,
    ballEnd,
    attackPath,
    latestMarker,
    markers,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useBetradarPitch(matchId) {
  const [betradarMatchId, setBetradarMatchId] = useState(null);
  const [pitchState, setPitchState] = useState({
    situation:     null,
    situationTeam: null,
    ballPos:       null,
    ballEnd:       null,
    attackPath:    [],
    latestMarker:  null,
    markers:       [],
  });
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);

  const pollRef      = useRef(null);
  const errorCount   = useRef(0);
  const cancelledRef = useRef(false);
  const seenMarkersRef = useRef(new Set());

  // ── Phase 1: resolve secondary Sportradar match ID ────────────────────────
  useEffect(() => {
    if (!matchId) return;

    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);
    setBetradarMatchId(null);
    setIsAvailable(false);
    seenMarkersRef.current = new Set();

    const controller = new AbortController();

    (async () => {
      try {
        console.log(`[useBetradarPitch] Resolving betradar ID for match ${matchId}...`);

        let detailData = null;
        let statsData = null;

        try {
          const detailRes = await fetch(`http://localhost:8000/api/football/matches/${matchId}`, {
            signal: controller.signal,
          });
          if (detailRes.ok) {
            detailData = await detailRes.json();
          }
        } catch {
          // Fall through to statsplayer fallback.
        }

        try {
          const statsRes = await fetch(`http://localhost:8000/api/football/statsplayer/${matchId}`, {
            signal: controller.signal,
          });
          if (statsRes.ok) {
            statsData = await statsRes.json();
          }
        } catch {
          // Keep the error handling centralized below.
        }

        if (cancelledRef.current) return;

        const detailId = normalizeNumericId(detailData?.betradar_id);

        const statsModels = statsData?.data?.statPlayerModels;
        const statsId = Array.isArray(statsModels)
          ? statsModels
              .map(model => normalizeNumericId(model?.matchId))
              .find(Boolean)
          : null;

        const secondaryId = detailId || statsId;
        const idSource = detailId ? 'match detail' : statsId ? 'statsplayer fallback' : 'none';

        console.log(`[useBetradarPitch] Resolved ID: ${secondaryId} (source: ${idSource})`);

        if (secondaryId) {
          setBetradarMatchId(secondaryId);
          setIsAvailable(true);
        } else {
          setIsAvailable(false);
          setIsLoading(false);
        }
      } catch (err) {
        if (cancelledRef.current || err.name === 'AbortError') return;
        setError(err.message || 'Failed to fetch Betradar match ID');
        setIsAvailable(false);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
      controller.abort();
    };
  }, [matchId]);

  // ── Phase 2: poll the timeline delta ─────────────────────────────────────
  useEffect(() => {
    if (!betradarMatchId) return;

    cancelledRef.current = false;
    errorCount.current   = 0;

    const poll = async () => {
      if (cancelledRef.current) return;

      try {
        const res  = await fetch(`http://localhost:8000/api/football/matchstats/betradar/${betradarMatchId}`);
        const data = await res.json();

        if (cancelledRef.current) return;

        const events =
          data?.doc?.[0]?.data?.events ||
          data?.data?.events ||
          data?.events ||
          data?.result?.events ||
          [];
        const parsed = parseBetradarEvents(events);

        if (parsed) {
          const freshMarkers = (parsed.markers || []).filter(marker => {
            const key = marker.key || buildMarkerKey(marker);
            if (seenMarkersRef.current.has(key)) return false;
            seenMarkersRef.current.add(key);
            return true;
          });

          setPitchState(prev => ({
            situation:     parsed.situation     ?? prev.situation,
            situationTeam: parsed.situationTeam ?? prev.situationTeam,
            ballPos:       parsed.ballPos       ?? prev.ballPos,
            ballEnd:       parsed.ballEnd       ?? prev.ballEnd,
            attackPath:    parsed.attackPath?.length ? parsed.attackPath : prev.attackPath,
            latestMarker:  parsed.latestMarker  ?? prev.latestMarker,
            markers:       freshMarkers.length ? [...prev.markers, ...freshMarkers].slice(-80) : prev.markers,
          }));
        }

        errorCount.current = 0;
        setError(null);
      } catch (err) {
        if (cancelledRef.current) return;
        errorCount.current++;
        const msg = err.message || 'Sportradar timeline fetch failed';
        setError(msg);
        if (errorCount.current >= MAX_ERRORS) {
          console.warn('[useBetradarPitch] Stopping poll after repeated errors:', msg);
          clearInterval(pollRef.current);
        }
      } finally {
        if (!cancelledRef.current) setIsLoading(false);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(pollRef.current);
    };
  }, [betradarMatchId]);

  return { betradarMatchId, pitchState, isAvailable, isLoading, error };
}