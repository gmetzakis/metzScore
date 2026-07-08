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
  'injury',
  'injuries',
  'stoppagetime',
  'extratime',
  'stoppage',
  'possessionevent',
  'attack',
  'dangerousattack',
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

function readStatusText(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value && typeof value === 'object') {
    const keys = ['status', 'name', 'label', 'text', 'description', 'phase', 'title'];
    for (const key of keys) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return value[key].trim();
      }
    }
  }

  return null;
}

function readStatusId(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    const candidate = value._id ?? value.id ?? value.statusId;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractTimelineStatus(data) {
  const statusCandidates = [
    data?.doc?.[0]?.data?.status,
    data?.doc?.[0]?.status,
    data?.doc?.[0]?.data?.match?.status,
    data?.data?.status,
    data?.data?.match?.status,
    data?.result?.status,
    data?.result?.match?.status,
    data?.status,
  ];

  let statusText = null;
  let statusId = null;

  for (const candidate of statusCandidates) {
    if (statusId == null) {
      const id = readStatusId(candidate);
      if (id != null) statusId = id;
    }

    if (!statusText) {
      const text = readStatusText(candidate);
      if (text) statusText = text;
    }

    if (statusText && statusId != null) break;
  }

  const matchStatusCandidates = [
    data?.doc?.[0]?.data?.match?.matchstatus,
    data?.doc?.[0]?.data?.matchstatus,
    data?.data?.match?.matchstatus,
    data?.data?.matchstatus,
    data?.result?.match?.matchstatus,
    data?.result?.matchstatus,
    data?.matchstatus,
  ];

  let matchStatus = null;
  for (const candidate of matchStatusCandidates) {
    const text = readStatusText(candidate);
    if (text) {
      matchStatus = text;
      break;
    }
  }

  if (!statusText && statusId == null && !matchStatus) {
    return null;
  }

  return {
    text: statusText,
    id: statusId,
    matchStatus,
  };
}

function classifyTimelineStatusName(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const lower = text.toLocaleLowerCase('el-GR');

  if (lower === 'ημίχρονο') {
    return 'halftime';
  }

  if (lower === 'δεν ξεκίνησε') {
    return 'notstarted';
  }

  if (lower.includes('1ο ημίχρονο') || lower.includes('1o ημίχρονο')) {
    return 'live';
  }

  if (lower.includes('2ο ημίχρονο') || lower.includes('2o ημίχρονο')) {
    return 'live';
  }

  const ascii = normalizeType(text);
  if (!ascii) return null;

  if (ascii === 'halftime' || ascii === 'half' || ascii === 'halftimebreak') {
    return 'halftime';
  }

  if (ascii === 'notstarted' || ascii === 'notstartedyet' || ascii.startsWith('notstarted')) {
    return 'notstarted';
  }

  if (ascii === '1sthalf' || ascii === '2ndhalf' || ascii.includes('firsthalf') || ascii.includes('secondhalf')) {
    return 'live';
  }

  return null;
}

function isPitchStatusOverlay(statusInfo) {
  if (!statusInfo) return false;

  const statusKind = classifyTimelineStatusName(statusInfo.text);
  if (statusKind === 'halftime' || statusKind === 'notstarted') {
    return true;
  }

  if (statusKind === 'live') {
    return false;
  }

  if (statusInfo.id === 31) {
    return true;
  }

  const normalized = normalizeType(statusInfo.text);
  if (!normalized) return false;

  if (normalized === 'half' || normalized === 'halftime' || normalized === 'halftimebreak') {
    return true;
  }

  if (normalized === 'notstarted' || normalized === 'notstartedyet' || normalized.startsWith('notstarted')) {
    return true;
  }

  return false;
}

function buildStatusMarker(statusInfo) {
  const statusKind = classifyTimelineStatusName(statusInfo?.text);
  const statusText = statusInfo?.text || (statusInfo?.id === 31 ? 'Half-time' : 'Not started yet');
  const normalized = normalizeType(statusText);
  const matchStatus = normalizeType(statusInfo?.matchStatus);

  const isHalfTime = statusKind === 'halftime' || (statusKind == null && (statusInfo?.id === 31 || normalized === 'half' || normalized === 'halftime' || normalized === 'halftimebreak'));
  const isNotStarted = statusKind === 'notstarted' || (!isHalfTime && statusKind == null && (normalized === 'notstarted' || normalized === 'notstartedyet' || normalized.startsWith('notstarted') || matchStatus === 'notstarted'));
  const type = isNotStarted ? 'notstarted' : 'halftime';

  return {
    id: `status:${normalized || 'unknown'}`,
    key: `status:${normalized || 'unknown'}`,
    type,
    team: null,
    description: statusText,
    name: statusText,
    time: null,
    seconds: null,
    x: null,
    y: null,
    playerName: null,
  };
}

function isPossessionType(value) {
  const normalized = normalizeType(value);
  return normalized === 'possession' || normalized === 'possessionevent' || normalized === 'possesionevent';
}

function getEventOrderValue(event) {
  const uts = Number(event?.uts);
  if (Number.isFinite(uts)) return uts;

  const seconds = Number(event?.seconds);
  if (Number.isFinite(seconds)) return seconds;

  return -1;
}

function sortEventsForPlayback(events) {
  return [...events]
    .map((event, index) => ({ event, index, order: getEventOrderValue(event) }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(item => item.event);
}

function parseBetradarEvents(events = []) {
  if (!Array.isArray(events) || !events.length) return null;

  const orderedEvents = sortEventsForPlayback(events);

  let situation     = null;
  let situationTeam = null;
  let situationOrder = -1;
  let ballPos       = null;
  let ballEnd       = null;
  let attackPath    = [];
  let latestMarker  = null;
  let latestMarkerOrder = -1;
  const markers     = [];

  for (const e of orderedEvents) {
    if (!e || e.disabled) continue;

    // Use _doctype as authoritative type; fall back to type field.
    const doctype = normalizeType(e._doctype || e.type);
    const eventOrder = getEventOrderValue(e);

    // ── Match situation (primary source of ball pos + game state) ────────
    if (doctype === 'matchsituation') {
      if (eventOrder >= situationOrder) {
        situation     = e.situation || situation;   // 'dangerous' | 'attack' | 'safe'
        situationTeam = e.team      || null;
        situationOrder = eventOrder;
      }

      if (typeof e.X === 'number' && typeof e.Y === 'number') {
        ballPos = { x: e.X, y: e.Y };
      }
    }

    if (isPossessionType(doctype)) {
      if (eventOrder >= situationOrder) {
        situation = 'possession';
        situationTeam = e.team || situationTeam;
        situationOrder = eventOrder;
      }
      continue;
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

      if (eventOrder >= latestMarkerOrder) {
        latestMarker = marker;
        latestMarkerOrder = eventOrder;
      }
    }
  }

  if (latestMarkerOrder < situationOrder) {
    latestMarker = null;
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

        const statusInfo = extractTimelineStatus(data);
        const statusMarker = isPitchStatusOverlay(statusInfo)
          ? buildStatusMarker(statusInfo)
          : null;

        const parsed = parseBetradarEvents(events);

        const freshMarkers = parsed
          ? (parsed.markers || []).filter(marker => {
            const key = marker.key || buildMarkerKey(marker);
            if (seenMarkersRef.current.has(key)) return false;
            seenMarkersRef.current.add(key);
            return true;
          })
          : [];

        setPitchState(prev => ({
          situation:     parsed?.situation     ?? prev.situation,
          situationTeam: parsed?.situationTeam ?? prev.situationTeam,
          ballPos:       parsed?.ballPos       ?? prev.ballPos,
          ballEnd:       parsed?.ballEnd       ?? prev.ballEnd,
          attackPath:    parsed?.attackPath?.length ? parsed.attackPath : prev.attackPath,
          latestMarker:  statusMarker ?? parsed?.latestMarker ?? null,
          markers:       freshMarkers.length ? [...prev.markers, ...freshMarkers].slice(-80) : prev.markers,
        }));

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