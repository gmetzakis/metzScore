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
  const useBetradar = propSituation !== undefined || propBallPos !== undefined;

  const mode     = useBetradar ? propSituation    : wsMode;
  const team     = useBetradar ? propTeam         : wsTeam;
  const ballPos  = useBetradar ? propBallPos       : wsBallPos;
  const ballEndP = useBetradar ? propBallEnd       : wsBallEnd;

  // Infer direction from ball coordinates if team is not available
  const dir = team || inferDirectionFromPositions(ballPos, ballEndP) || "home";

  // ── Rendering ──────────────────────────────────────────────────────────────
  const showNotAvailable = !isAvailable;
  const showIdle         = isAvailable && !mode && !ballPos;

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

        {/* Status overlays */}
        {showNotAvailable && (
          <div className="pitch-overlay-message">
            <span className="pitch-msg-icon">📡</span>
            <span className="pitch-msg-text">Live pitch data unavailable</span>
          </div>
        )}

        {showIdle && (
          <div className="pitch-overlay-message pitch-overlay-message--idle">
            <span className="pitch-msg-icon">⚽</span>
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

      {/* Situation legend below the pitch */}
      {isAvailable && mode && (
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
    </div>
  );
}