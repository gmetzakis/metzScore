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
  if (normalized === "goal") return <img src="../../public/icons/goal.svg"/>;
  if (normalized === "corner") return <img src="../../public/icons/corner.svg"/>;
  if (normalized === "shotontarget" || normalized === "shotofftarget" || normalized === "shot") return "🎯";
  if (normalized === "goalkeepersave" || normalized === "save") return "🧤";
  if (normalized === "card") return <img src="../../public/icons/yellow.svg"/>;
  if (normalized === "penalty") return "⛳";
  if (normalized === "substitution") return <img src="../../public/icons/sub.svg"/>;
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

function formatMarkerText(marker) {
  return marker?.description || marker?.name || markerLabel(marker?.type);
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

function getSummaryCounts(markers) {
  const counts = { goals: 0, corners: 0, shots: 0, cards: 0, saves: 0, penalties: 0 };

  for (const marker of markers) {
    const type = normalizeType(marker?.type);
    if (type === "goal") counts.goals += 1;
    else if (type === "corner") counts.corners += 1;
    else if (type === "shot" || type === "shotontarget" || type === "shotofftarget") counts.shots += 1;
    else if (type === "card") counts.cards += 1;
    else if (type === "goalkeepersave" || type === "save") counts.saves += 1;
    else if (type === "penalty") counts.penalties += 1;
  }

  return counts;
}

function formatMarkerTime(marker) {
  if (marker?.time) return marker.time;
  if (marker?.seconds == null) return "";
  const mins = Math.floor(marker.seconds / 60);
  const secs = marker.seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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

  const timerRef      = useRef(null);
  const processedRef  = useRef("");

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
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
  const summaryCounts = getSummaryCounts(markers);

  // Infer direction from ball coordinates if team is not available
  const dir = team || inferDirectionFromPositions(ballPos, ballEndP) || "home";
  const hasTimeline = Boolean(mode || ballPos || attackPath.length || markers.length);

  // ── Rendering ──────────────────────────────────────────────────────────────
  const showNotAvailable = !isAvailable;
  const showIdle         = isAvailable && !hasTimeline;
  const latestMarkerKey   = getLatestMarkerKey(latestMarker);
  const pitchMarkers      = markers.filter(marker => typeof marker?.x === "number" && typeof marker?.y === "number");

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
          <div className={`overlay attack ${dir === "away" ? "away" : "home"}`}>
            <div className="arrows" aria-hidden="true">
              {dir === "away" ? "◀ ◀ ◀" : "▶ ▶ ▶"}
            </div>
          </div>
        )}

        {mode === "dangerous" && (
          <div className={`overlay dangerous ${dir === "away" ? "away" : "home"}`} />
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

        {/* Event markers */}
        {pitchMarkers.map((marker) => {
          const markerKey = getLatestMarkerKey(marker);
          const tone = getMarkerTone(marker.type);
          const isLatest = latestMarkerKey && markerKey === latestMarkerKey;
          return (
            <div
              key={markerKey}
              className={`pitch-event-marker pitch-event-marker--${tone} ${isLatest ? "pitch-event-marker--latest" : ""}`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              title={`${markerLabel(marker.type)}${formatMarkerText(marker) ? `: ${formatMarkerText(marker)}` : ""}`}
              aria-label={`${markerLabel(marker.type)}${formatMarkerText(marker) ? ` ${formatMarkerText(marker)}` : ""}`}
            >
              <span className="pitch-event-marker-icon" aria-hidden="true">
                {markerIcon(marker.type)}
              </span>
            </div>
          );
        })}

        {/* Status overlays */}
        {showNotAvailable && (
          <div className="pitch-overlay-message">
            <span className="pitch-msg-icon">📡</span>
            <span className="pitch-msg-text">Live pitch data unavailable</span>
          </div>
        )}

        {showIdle && (
          <div className="pitch-overlay-message pitch-overlay-message--idle">
            <span className="pitch-msg-icon"><img src="../../public/icons/goal.svg"/></span>
            <span className="pitch-msg-text">Waiting for live data…</span>
          </div>
        )}

        {/* Team labels on pitch */}
        {isAvailable && !showIdle && (homeName || awayName) && (
          <>
            {homeName && <div className="pitch-team-label pitch-team-label--home">{homeName}</div>}
            {awayName && <div className="pitch-team-label pitch-team-label--away">{awayName}</div>}
          </>
        )}
      </div>

      {isAvailable && (mode || markers.length > 0) && (
        <div className="pitch-insights">
          {mode && (
            <div className={`pitch-legend pitch-legend--${mode}`}>
              <span className="pitch-legend-dot" />
              <span className="pitch-legend-text">
                {mode === "dangerous" && (
                  `⚡ Dangerous attack — ${dir === "home" ? (homeName || "Home") : (awayName || "Away")}`
                )}
                {mode === "attack" && (
                  `▶ Attack — ${dir === "home" ? (homeName || "Home") : (awayName || "Away")}`
                )}
                {mode === "possession" && (
                  `● Possession — ${dir === "home" ? (homeName || "Home") : (awayName || "Away")}`
                )}
              </span>
            </div>
          )}

          {markers.length > 0 && (
            <>
              <div className="pitch-summary-chips" aria-label="Pitch event summary">
                {summaryCounts.goals > 0 && <span className="pitch-summary-chip pitch-summary-chip--goal"><img src="../../public/icons/goal.svg"/> {summaryCounts.goals} Goals</span>}
                {summaryCounts.corners > 0 && <span className="pitch-summary-chip pitch-summary-chip--corner"><img src="../../public/icons/corner.svg"/> {summaryCounts.corners} Corners</span>}
                {summaryCounts.shots > 0 && <span className="pitch-summary-chip pitch-summary-chip--shot">🎯 {summaryCounts.shots} Shots</span>}
                {summaryCounts.cards > 0 && <span className="pitch-summary-chip pitch-summary-chip--card"><img src="../../public/icons/yellow.svg"/> {summaryCounts.cards} Cards</span>}
                {summaryCounts.saves > 0 && <span className="pitch-summary-chip pitch-summary-chip--save">🧤 {summaryCounts.saves} Saves</span>}
                {summaryCounts.penalties > 0 && <span className="pitch-summary-chip pitch-summary-chip--penalty">⛳ {summaryCounts.penalties} Penalties</span>}
              </div>

              <div className="pitch-event-feed" aria-label="Pitch events">
                {markers.slice().reverse().map((marker) => {
                  const teamLabel = resolveTeamLabel(marker, homeTeamId, awayTeamId, homeName, awayName);
                  const markerText = formatMarkerText(marker);
                  return (
                    <div key={marker.key || getLatestMarkerKey(marker)} className="pitch-event-row">
                      <span className={`pitch-event-row-icon pitch-event-row-icon--${getMarkerTone(marker.type)}`} aria-hidden="true">
                        {markerIcon(marker.type)}
                      </span>
                      <div className="pitch-event-row-body">
                        <div className="pitch-event-row-title">
                          <span className="pitch-event-row-type">{markerLabel(marker.type)}</span>
                          {formatMarkerTime(marker) && <span className="pitch-event-row-time">{formatMarkerTime(marker)}</span>}
                        </div>
                        <div className="pitch-event-row-text">
                          {markerText}
                          {teamLabel && <span className="pitch-event-row-team"> · {teamLabel}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}