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
  'shotontarget',
  'shotofftarget',
  'goalkeepersave',
  'card',
  'possibleevent',   // VAR / possible goal review
  'penalty',
  'goal',
]);

function parseBetradarEvents(events = []) {
  if (!Array.isArray(events) || !events.length) return null;

  let situation     = null;
  let situationTeam = null;
  let ballPos       = null;
  let ballEnd       = null;
  let attackPath    = [];
  let latestMarker  = null;
  const markers     = [];

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!e || e.disabled) continue;

    // Use _doctype as authoritative type; fall back to type field.
    const doctype = e._doctype || e.type;

    // ── Match situation (primary source of ball pos + game state) ────────
    if (!situation && doctype === 'matchsituation') {
      situation     = e.situation || null;   // 'dangerous' | 'attack' | 'safe'
      situationTeam = e.team      || null;

      if (typeof e.X === 'number' && typeof e.Y === 'number') {
        ballPos = { x: e.X, y: e.Y };
      }
    }

    // ── Ball coordinates (companion events — coords[] is always empty,
    //    but X/Y may still be present on some implementations) ──────────
    if (!ballPos && doctype === 'ballcoordinates') {
      const coords = e.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        ballPos = { x: coords[0], y: coords[1] };
        if (coords.length >= 4) ballEnd = { x: coords[2], y: coords[3] };}
      else if (typeof e.X === 'number' && typeof e.Y === 'number') {
        ballPos = { x: e.X, y: e.Y };
      }

      if (Array.isArray(e.coordinates)) {
        attackPath = e.coordinates.map(c => ({ x: c.X, y: c.Y, team: c.team })).filter(c => c.x != null);
        if (attackPath.length > 1) ballEnd = attackPath[attackPath.length - 1];
      }
    }

    // ── Notable events (corner, freekick, card, shot, save, etc.) ────────
    if (NOTABLE_TYPES.has(doctype)) {
      const marker = {
        id:         e._id,
        type:       doctype,
        team:       e.team  || null,
        time:       e.time  ?? null,
        seconds:    e.seconds ?? null,
        x:          typeof e.X === 'number' ? e.X : null,
        y:          typeof e.Y === 'number' ? e.Y : null,
        name:       e.name  || null,
        // Card-specific
        card:       e.card  || null,          // 'yellow' | 'red'
        playerName: e.player?.name || null,
      };

      markers.push(marker);
      if (!latestMarker) latestMarker = marker;  // newest = last in reversed loop
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

  // ── Phase 1: resolve secondary Sportradar match ID ────────────────────────
  useEffect(() => {
    if (!matchId) return;

    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);
    setBetradarMatchId(null);
    setIsAvailable(false);

    const controller = new AbortController();

    (async () => {
      try {
        console.log(`[useBetradarPitch] Fetching secondary ID for match ${matchId}...`);
        const res  = await fetch(`http://localhost:8000/api/football/statsplayer/${matchId}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelledRef.current) return;

        const secondaryId =
          data?.data?.statPlayerModels?.[0]?.matchId ??
          data?.data?.statPlayerModels?.[1]?.matchId ?? null;

        console.log(`[useBetradarPitch] Got secondary ID: ${secondaryId}`);

        if (secondaryId) {
          setBetradarMatchId(String(secondaryId));
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

        const events = data?.doc?.[0]?.data?.events;
        const parsed = parseBetradarEvents(events);

        if (parsed) {
          // MERGE new parsed state with previous — prevents a delta that contains
          // only card/freekick events (no matchsituation) from wiping out the
          // last known ball position and situation.
          setPitchState(prev => ({
            situation:     parsed.situation     ?? prev.situation,
            situationTeam: parsed.situationTeam ?? prev.situationTeam,
            ballPos:       parsed.ballPos       ?? prev.ballPos,
            ballEnd:       parsed.ballEnd       ?? prev.ballEnd,
            attackPath:    parsed.attackPath?.length ? parsed.attackPath : prev.attackPath,
            // Always take the newer marker when one exists
            latestMarker:  parsed.latestMarker  ?? prev.latestMarker,
            markers:       parsed.markers?.length ? parsed.markers : prev.markers,
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