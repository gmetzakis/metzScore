import "./LivePitch.css";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// WS message parsing helpers (kept for backward-compatibility)
// ---------------------------------------------------------------------------

function parseJson(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function extractPitchData(input) {
  const root = parseJson(input);
  if (!root || typeof root !== "object") return null;

  if (root.ball_position) return root;
  if (root.event_type !== undefined || root.event_data) return root;

  const args = root.arguments;
  if (Array.isArray(args) && args.length > 0) {
    const candidate = parseJson(args[0]);
    if (candidate && (candidate.event_type !== undefined || candidate.ball_position || candidate.event_data)) {
      return candidate;
    }
  }

  const result = root.result;
  if (result) {
    const data = result.data;
    if (data && typeof data === "object") {
      const candidate = parseJson(data);
      if (candidate && (candidate.event_type !== undefined || candidate.ball_position || candidate.event_data)) {
        return candidate;
      }
    }
    const candidate = parseJson(result);
    if (candidate && (candidate.event_type !== undefined || candidate.ball_position || candidate.event_data)) {
      return candidate;
    }
  }

  return null;
}

function resolveEventData(candidate) {
  if (!candidate) return null;
  if (candidate.event_data && typeof candidate.event_data === "object") return candidate.event_data;
  if (candidate.ball_position || candidate.is_dangerous_attack || candidate.is_attack || candidate.is_possession) return candidate;
  return null;
}

function inferDirectionFromPositions(bp, be) {
  if (bp && be && typeof bp.x === "number" && typeof be.x === "number") {
    return be.x >= bp.x ? "home" : "away";
  }
  return null;
}

function normalizeType(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function markerIcon(type) {
  const normalized = normalizeType(type);
  if (normalized === "goal") return <img src="/icons/goal.svg" alt="" />;
  if (normalized === "corner") return <img src="/icons/corner.svg" alt="" />;
  if (normalized === "shotontarget" || normalized === "shotofftarget" || normalized === "shot") return "🎯";
  if (normalized === "goalkeepersave" || normalized === "save") return "🧤";
  if (normalized === "card") return <img src="/icons/yellow.svg" alt="" />;
  if (normalized === "penalty") return <img src="/icons/penalty.svg" alt="" />;
  if (normalized === "substitution") return <img src="/icons/sub.svg" alt="" />;
  if (normalized === "freekick") return "🦶";
  if (normalized === "goalkick") return "🥅";
  if (normalized === "throwin") return "↩";
  if (normalized === "possibleevent" || normalized === "var") return "📺";
  return "•";
}

function markerLabel(type) {
  const normalized = normalizeType(type);
  if (normalized === "goal") return "Goal";
  if (normalized === "corner") return "Corner";
  if (normalized === "shotontarget") return "Shot on target";
  if (normalized === "shotofftarget") return "Shot off target";
  if (normalized === "shot") return "Shot";
  if (normalized === "goalkeepersave" || normalized === "save") return "Save";
  if (normalized === "card") return "Card";
  if (normalized === "penalty") return "Penalty";
  if (normalized === "substitution") return "Substitution";
  if (normalized === "freekick") return "Free kick";
  if (normalized === "goalkick") return "Goal kick";
  if (normalized === "throwin") return "Throw-in";
  if (normalized === "possibleevent" || normalized === "var") return "VAR";
  if (normalized === "foul") return "Foul";
  if (normalized === "attack") return "Attack";
  if (normalized === "dangerousattack") return "Dangerous attack";
  if (normalized === "possession") return "Possession";
  return normalized || "Event";
}

function resolveTeamLabel(marker, homeTeamId, awayTeamId, homeName, awayName) {
  const teamValue = marker?.team;
  if (teamValue == null) return "";

  const teamString = String(teamValue);
  if (String(homeTeamId) === teamString || teamString === "home" || teamString === "0") {
    return homeName || "Home";
  }
  if (String(awayTeamId) === teamString || teamString === "away" || teamString === "1") {
    return awayName || "Away";
  }
  return teamString;
}

function getMarkerMessage(marker) {
  return marker?.message || marker?.event_message || marker?.note || marker?.detail || marker?.description || marker?.text || marker?.title || marker?.label || marker?.short_message || marker?.message_text || marker?.commentary || "";
}

function getMarkerContextLabel(marker) {
  return marker?.name || marker?.type_label || marker?.event_name || marker?.eventType || "";
}

function shouldShowTransientMarker(marker) {
  const normalized = normalizeType(marker?.type);
  return [
    "goal",
    "corner",
    "freekick",
    "freekick",
    "waterbreak",
    "hydration",
    "hydrationbreak",
    "drinkbreak",
    "stoppage",
    "stoppagetime",
    "delay",
    "matchdelay",
    "throwin",
    "goalkick",
    "shot",
    "shotontarget",
    "shotofftarget",
    "save",
    "goalkeepersave",
    "card",
    "penalty",
    "substitution",
    "foul",
    "possibleevent",
    "var",
  ].includes(normalized);
}

function isMessageStyleMarker(marker) {
  return Boolean(getMarkerMessage(marker) || getMarkerContextLabel(marker));
}

function getMarkerTone(type) {
  const normalized = normalizeType(type);
  if (normalized === "goal") return "goal";
  if (normalized === "corner") return "corner";
  if (normalized === "card") return "card";
  if (normalized === "shotontarget" || normalized === "shotofftarget" || normalized === "shot") return "shot";
  if (normalized === "goalkeepersave" || normalized === "save") return "save";
  if (normalized === "penalty") return "penalty";
  if (normalized === "substitution") return "substitution";
  return normalized || "event";
}

function formatMarkerTime(marker) {
  if (marker?.time) return marker.time;
  if (marker?.seconds == null) return "";
  const mins = Math.floor(marker.seconds / 60);
  const secs = marker.seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getFloatingPlacement(point) {
  const x = Number(point?.x ?? 50);
  const y = Number(point?.y ?? 50);

  const horizontal = x < 35 ? "right" : x > 65 ? "left" : "center";
  const vertical = y < 30 ? "bottom" : y > 70 ? "top" : "middle";

  return { horizontal, vertical };
}

function getModeLabel(mode) {
  if (mode === "dangerous") return "Dangerous attack";
  if (mode === "attack") return "Attack";
  if (mode === "possession") return "Possession";
  return markerLabel(mode);
}

function safePathPoints(points) {
  return Array.isArray(points)
    ? points.filter(point => point && typeof point.x === "number" && typeof point.y === "number")
    : [];
}

function getLatestMarkerKey(marker) {
  return marker?.key || marker?.id || `${marker?.type || ""}-${marker?.seconds ?? ""}-${marker?.x ?? ""}-${marker?.y ?? ""}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * <LivePitch />
 *
 * Renders a live football pitch with ball position and situation overlays.
 *
 * BETRADAR path (preferred) – pass pre-parsed props from useBetradarPitch:
 *   situation      'dangerous' | 'attack' | 'possession' | null
 *   situationTeam  'home' | 'away' | null
 *   ballPos        { x: number, y: number } | null   (values in 0-100%)
 *   ballEnd        { x: number, y: number } | null
 *   isAvailable    boolean – show "no data" message when false
 *
 * LEGACY WebSocket path – pass raw messages / event objects:
 *   messages       string[]  – array of raw WS message strings
 *   event          object    – single parsed WS event
 *
 * homeTeamId / awayTeamId are kept for any team-specific colour logic.
 */
export default function LivePitch({
  // Betradar / direct state props
  situation:     propSituation,
  situationTeam: propTeam,
  ballPos:       propBallPos,
  ballEnd:       propBallEnd,
  markers:       propMarkers,
  attackPath:    propAttackPath,
  latestMarker:  propLatestMarker,
  isAvailable = true,
  homeName,
  awayName,

  // Legacy WS props
  event,
  messages,
  homeTeamId,
  awayTeamId,
}) {
  // Internal state driven by WS messages (used only when Betradar props are absent)
  const [wsBallPos,  setWsBallPos]  = useState(null);
  const [wsBallEnd,  setWsBallEnd]  = useState(null);
  const [wsMode,     setWsMode]     = useState(null);
  const [wsTeam,     setWsTeam]     = useState(null);
  const [visibleMarker, setVisibleMarker] = useState(null);

  const timerRef      = useRef(null);
  const markerTimerRef = useRef(null);
  const processedRef  = useRef("");
  const markerKeyRef  = useRef("");

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const clearMarkerTimer = () => {
    if (markerTimerRef.current) { clearTimeout(markerTimerRef.current); markerTimerRef.current = null; }
  };

  // Process a single WS-style event data object
  const handleWsData = (data) => {
    if (!data) return;
    const ed = resolveEventData(data);
    if (!ed) return;

    const bp = ed.ball_position;
    const be = ed.ball_position_end;
    if (bp?.x != null) setWsBallPos({ x: bp.x, y: bp.y });
    if (be?.x != null) setWsBallEnd({ x: be.x, y: be.y });

    const hasMode = ed.is_dangerous_attack || ed.is_attack || ed.is_possession;
    if (hasMode) {
      const m = ed.is_dangerous_attack ? "dangerous" : ed.is_attack ? "attack" : "possession";
      setWsMode(m);
      const dir = inferDirectionFromPositions(bp, be);
      if (dir) setWsTeam(dir);

      clearTimer();
      timerRef.current = setTimeout(() => {
        setWsMode(null);
        setWsBallEnd(null);
      }, 3000);
    }
  };

  // Watch incoming WS messages array
  useEffect(() => {
    if (!messages?.length) return;
    const latest = messages[messages.length - 1];
    if (!latest) return;
    const key = typeof latest === "string" ? latest : JSON.stringify(latest);
    if (key === processedRef.current) return;
    processedRef.current = key;
    handleWsData(extractPitchData(latest));
  }, [messages]);

  // Watch single WS event object
  useEffect(() => {
    if (!event) return;
    handleWsData(extractPitchData(event));
  }, [event]);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => () => clearMarkerTimer(), []);

  // ── Resolved display values ────────────────────────────────────────────────
  // Betradar direct props take priority over WS-parsed state
  const useBetradar =
    propSituation !== undefined ||
    propTeam !== undefined ||
    propBallPos !== undefined ||
    propBallEnd !== undefined ||
    propMarkers !== undefined ||
    propAttackPath !== undefined ||
    propLatestMarker !== undefined;

  const mode     = useBetradar ? propSituation    : wsMode;
  const team     = useBetradar ? propTeam         : wsTeam;
  const ballPos  = useBetradar ? propBallPos       : wsBallPos;
  const ballEndP = useBetradar ? propBallEnd       : wsBallEnd;
  const markers  = useBetradar && Array.isArray(propMarkers) ? propMarkers : [];
  const attackPath = useBetradar && Array.isArray(propAttackPath) ? safePathPoints(propAttackPath) : [];
  const latestMarker = useBetradar ? propLatestMarker : null;
  const latestMarkerCandidate = useBetradar
    ? latestMarker || markers[markers.length - 1] || null
    : latestMarker || null;

  useEffect(() => {
    if (!latestMarkerCandidate) return;
    if (!shouldShowTransientMarker(latestMarkerCandidate) && !isMessageStyleMarker(latestMarkerCandidate)) return;

    const key = getLatestMarkerKey(latestMarkerCandidate);
    if (key === markerKeyRef.current) return;
    markerKeyRef.current = key;
    setVisibleMarker(latestMarkerCandidate);

    clearMarkerTimer();
    markerTimerRef.current = setTimeout(() => {
      setVisibleMarker(null);
    }, 4500);
  }, [latestMarkerCandidate]);

  // Infer direction from ball coordinates if team is not available
  const dir = team || inferDirectionFromPositions(ballPos, ballEndP) || "home";
  const hasTimeline = Boolean(mode || ballPos || attackPath.length || visibleMarker);

  // ── Rendering ──────────────────────────────────────────────────────────────
  const showNotAvailable = !isAvailable;
  const showIdle         = isAvailable && !hasTimeline;
  const liveFocusPoint    = ballPos || { x: dir === "away" ? 18 : 82, y: 50 };
  const livePlacement     = getFloatingPlacement(liveFocusPoint);
  const attackFrontXRaw = ballPos && typeof ballPos.x === "number"
    ? ballPos.x
    : dir === "home" ? 66.67 : 33.33;
  const attackFrontX = Math.max(10, Math.min(90, attackFrontXRaw));
  const dangerousFrontX = attackFrontX;

  return (
    <div className="pitch-wrapper">
      <div className="pitch">
        {/* Field structure */}
        <div className="half-line" />
        <div className="center-circle" />
        <div className="penalty-area penalty-area--left" />
        <div className="penalty-area penalty-area--right" />
        <div className="goal-area goal-area--left" />
        <div className="goal-area goal-area--right" />
        <div className="center-dot" />

        {/* Ball movement path */}
        {attackPath.length > 1 && (
          <svg className="pitch-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              className="pitch-path-line"
              points={attackPath.map(point => `${point.x},${point.y}`).join(" ")}
            />
            {attackPath.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                className={`pitch-path-node ${index === attackPath.length - 1 ? "pitch-path-node--latest" : ""}`}
                cx={point.x}
                cy={point.y}
                r={index === attackPath.length - 1 ? 1.2 : 0.7}
              />
            ))}
          </svg>
        )}

        {/* Situation overlays */}
        {mode === "possession" && (
          <div className={`overlay possession ${dir === "away" ? "away" : "home"}`} />
        )}

        {mode === "attack" && (
          <div
            className={`overlay attack ${dir === "away" ? "away" : "home"}`}
            style={{ "--attack-front": `${attackFrontX}%` }}
          >
            <div className="attack-shadow" aria-hidden="true" />
            <div className="attack-overlay-info" aria-live="polite">
              <span className="attack-overlay-title">{getModeLabel(mode)}</span>
              <span className="attack-overlay-team">{dir === "home" ? (homeName || "Home") : (awayName || "Away")}</span>
            </div>
          </div>
        )}

        {mode === "dangerous" && (
          <div
            className={`overlay dangerous ${dir === "away" ? "away" : "home"}`}
            style={{ "--danger-front": `${dangerousFrontX}%` }}
          >
            <div className="dangerous-shadow" aria-hidden="true" />
            <div className="dangerous-overlay-info" aria-live="polite">
              <span className="dangerous-overlay-title">{getModeLabel(mode)}</span>
              <span className="dangerous-overlay-team">{dir === "home" ? (homeName || "Home") : (awayName || "Away")}</span>
            </div>
          </div>
        )}

        {/* Ball */}
        {ballPos && (
          <div
            className="ball"
            style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
          />
        )}

        {/* Ball target ghost */}
        {ballEndP && mode && (
          <div
            className="ball-end"
            style={{ left: `${ballEndP.x}%`, top: `${ballEndP.y}%` }}
          />
        )}

        {/* Live situation badge */}
        {mode && mode !== "attack" && mode !== "dangerous" && (
          <div
            className={`pitch-event pitch-event--live pitch-event--${mode} pitch-event--${livePlacement.horizontal} pitch-event--${livePlacement.vertical}`}
            style={{ left: `${liveFocusPoint.x}%`, top: `${liveFocusPoint.y}%` }}
          >
            <span className="pitch-event-shadow pitch-event-shadow--live" aria-hidden="true" />
            <span className="pitch-event-core" aria-hidden="true" />
            <div className="pitch-event-card pitch-event-card--live">
              <span className="pitch-event-accent" aria-hidden="true" />
              <div className="pitch-event-text">
                <div className="pitch-event-title-row">
                  <span className="pitch-event-title">{getModeLabel(mode)}</span>
                </div>
                <div className="pitch-event-team">{dir === "home" ? (homeName || "Home") : (awayName || "Away")}</div>
              </div>
            </div>
          </div>
        )}

        {/* Event marker */}
        {visibleMarker && (
          <div
            className={`pitch-event pitch-event--${getMarkerTone(visibleMarker.type)} pitch-event--${getFloatingPlacement(visibleMarker).horizontal} pitch-event--${getFloatingPlacement(visibleMarker).vertical} pitch-event--latest`}
            style={{ left: `${visibleMarker.x}%`, top: `${visibleMarker.y}%` }}
            title={`${getMarkerContextLabel(visibleMarker) || markerLabel(visibleMarker.type)}${resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName) ? `: ${resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName)}` : ""}${getMarkerMessage(visibleMarker) ? ` - ${getMarkerMessage(visibleMarker)}` : ""}`}
            aria-label={`${getMarkerContextLabel(visibleMarker) || markerLabel(visibleMarker.type)}${resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName) ? ` ${resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName)}` : ""}${getMarkerMessage(visibleMarker) ? ` ${getMarkerMessage(visibleMarker)}` : ""}`}
          >
            <span className={`pitch-event-shadow pitch-event-shadow--${getMarkerTone(visibleMarker.type)}`} aria-hidden="true" />
            <span className="pitch-event-core" aria-hidden="true" />
            <span className={`pitch-event-icon pitch-event-icon--${getMarkerTone(visibleMarker.type)}`} aria-hidden="true">
              {markerIcon(visibleMarker.type)}
            </span>
            <div className="pitch-event-card">
              <span className="pitch-event-accent" aria-hidden="true" />
              <div className="pitch-event-text">
                <div className="pitch-event-title-row">
                  <span className="pitch-event-title">{getMarkerContextLabel(visibleMarker) || markerLabel(visibleMarker.type)}</span>
                  {formatMarkerTime(visibleMarker) && <span className="pitch-event-time">{formatMarkerTime(visibleMarker)}</span>}
                </div>
                {resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName) && <div className="pitch-event-team">{resolveTeamLabel(visibleMarker, homeTeamId, awayTeamId, homeName, awayName)}</div>}
                {getMarkerMessage(visibleMarker) && <div className="pitch-event-message">{getMarkerMessage(visibleMarker)}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Status overlays */}
        {showNotAvailable && (
          <div className="pitch-overlay-message">
            <span className="pitch-msg-icon">📡</span>
            <span className="pitch-msg-text">Live pitch data unavailable</span>
          </div>
        )}

        {showIdle && (
          <div className="pitch-overlay-message pitch-overlay-message--idle">
            <span className="pitch-msg-icon"><img src="/icons/goal.svg" alt="" /></span>
            <span className="pitch-msg-text">Waiting for live data…</span>
          </div>
        )}

      </div>
    </div>
  );
}