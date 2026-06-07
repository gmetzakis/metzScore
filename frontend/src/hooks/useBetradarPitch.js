import { useState, useEffect, useRef } from 'react';

function parseEvent(event) {
  if (!event || event.disabled) return null;

  switch (event.type) {
    case 'possession':
      return { kind: 'possession', team: event.team };

    case 'matchsituation':
      return { kind: 'matchsituation', situation: event.situation, team: event.team };

    case 'ballcoordinates': {
      const coords = event.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      // coords format: [x, y] or [x1, y1, x2, y2] — all values 0–100
      const ballPos = { x: coords[0], y: coords[1] };
      const ballEnd = coords.length >= 4 ? { x: coords[2], y: coords[3] } : null;
      return { kind: 'ballcoordinates', ballPos, ballEnd };
    }

    default:
      return null;
  }
}

/**
 * Convert a Sportradar events array into the pitch state we care about.
 * We scan from newest to oldest so we always reflect the most recent state.
 */
function parseBetradarEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return null;

  let possession     = null; // 'home' | 'away'
  let situation      = null; // 'dangerous' | 'attack' | 'safe'
  let situationTeam  = null; // 'home' | 'away'
  let ballPos        = null; // { x, y }
  let ballEnd        = null; // { x, y } | null

  // Scan newest-first (events array is oldest-first from the API)
  for (let i = events.length - 1; i >= 0; i--) {
    const parsed = parseEvent(events[i]);
    if (!parsed) continue;

    if (parsed.kind === 'possession' && !possession) {
      possession = parsed.team;
    } else if (parsed.kind === 'matchsituation' && !situation) {
      situation     = parsed.situation;
      situationTeam = parsed.team;
    } else if (parsed.kind === 'ballcoordinates' && !ballPos) {
      ballPos = parsed.ballPos;
      ballEnd = parsed.ballEnd;
    }

    // Early exit once we have everything
    if (possession && situation && ballPos) break;
  }

  // Map the raw Sportradar situation to the three-tier mode our pitch uses
  const pitchSituation =
    situation === 'dangerous' ? 'dangerous'
    : situation === 'attack'  ? 'attack'
    : possession              ? 'possession'
    : null;

  // The team driving the current situation (or the team in possession)
  const pitchTeam = situationTeam || possession || null;

  return {
    situation:     pitchSituation,
    situationTeam: pitchTeam,
    ballPos,
    ballEnd,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useBetradarPitch(matchId)
 *
 * Phase 1 – fetches the Sportradar secondary match ID from the stoiximan stats endpoint.
 * Phase 2 – polls the Sportradar timeline-delta endpoint every second and exposes
 *            a normalised pitch state ready to be passed directly to <LivePitch />.
 *
 * @param {string|number} matchId  The primary match ID used in your app.
 * @returns {{
 *   betradarMatchId: string | null,
 *   pitchState: {
 *     situation:     'dangerous' | 'attack' | 'possession' | null,
 *     situationTeam: 'home' | 'away' | null,
 *     ballPos:       { x: number, y: number } | null,
 *     ballEnd:       { x: number, y: number } | null,
 *   },
 *   isAvailable: boolean,
 *   isLoading:   boolean,
 *   error:       string | null,
 * }}
 */
export default function useBetradarPitch(matchId) {
  const [betradarMatchId, setBetradarMatchId] = useState(null);
  const [pitchState, setPitchState] = useState({
    situation:     null,
    situationTeam: null,
    ballPos:       null,
    ballEnd:       null,
  });
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);

  const pollRef     = useRef(null);
  const errorCount  = useRef(0);
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
        const res = await fetch(`http://localhost:8000/api/football/statsplayer/${matchId}`);
        const data = await res.json();

        if (cancelledRef.current) return;

        const secondaryId = data?.data?.statPlayerModels?.[0]?.matchId;
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

  // ── Phase 2: poll the timeline delta once we have the secondary ID ─────────
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
        console.log(events);
        const parsed = parseBetradarEvents(events);

        if (parsed) setPitchState(parsed);

        errorCount.current = 0;
        setError(null);
      } catch (err) {
        if (cancelledRef.current) return;

        errorCount.current++;
        const msg = err.message || 'Sportradar timeline fetch failed';
        setError(msg);

        if (errorCount.current >= MAX_ERRORS) {
          console.warn('[useBetradarPitch] Too many errors, stopping poll.', msg);
          clearInterval(pollRef.current);
          return;
        }
      } finally {
        if (!cancelledRef.current) setIsLoading(false);
      }
    };

    // Fire immediately, then on the interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(pollRef.current);
    };
  }, [betradarMatchId]);

  return { betradarMatchId, pitchState, isAvailable, isLoading, error };
}

