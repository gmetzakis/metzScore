import "./LivePitch.css";
import { useEffect, useRef, useState } from "react";

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
  if (candidate.event_data && typeof candidate.event_data === "object") {
    return candidate.event_data;
  }
  if (candidate.ball_position || candidate.is_dangerous_attack || candidate.is_attack || candidate.is_possession) {
    return candidate;
  }
  return null;
}

function inferDirection(ed) {
  if (!ed) return null;
  const bp = ed.ball_position;
  const be = ed.ball_position_end;
  if (bp && be && typeof bp.x === "number" && typeof be.x === "number") {
    return be.x >= bp.x ? "home" : "away";
  }
  return null;
}

export default function LivePitch({
  event,
  messages,
  homeTeamId,
  awayTeamId,
}) {
  const [ballPos, setBallPos] = useState(null);
  const [ballEnd, setBallEnd] = useState(null);
  const [mode, setMode] = useState(null);
  const [direction, setDirection] = useState(null);
  const [debug, setDebug] = useState("");

  const timerRef = useRef(null);
  const processedRef = useRef("");

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleData = (data) => {
    if (!data) return;

    const ed = resolveEventData(data);
    if (!ed) return;

    const bp = ed.ball_position;
    const be = ed.ball_position_end;
    if (bp && typeof bp.x === "number" && typeof bp.y === "number") {
      setBallPos({ x: bp.x, y: bp.y });
    }
    if (be && typeof be.x === "number" && typeof be.y === "number") {
      setBallEnd({ x: be.x, y: be.y });
    }

    const hasMode = ed.is_dangerous_attack || ed.is_attack || ed.is_possession;
    if (hasMode) {
      const m = ed.is_dangerous_attack ? "dangerous" : ed.is_attack ? "attack" : "possession";
      setMode(m);
      const dir = inferDirection(ed);
      if (dir) setDirection(dir);

      clearTimer();
      timerRef.current = setTimeout(() => {
        setMode(null);
        setBallEnd(null);
      }, 3000);
    }
  };

  useEffect(() => {
    if (!messages || !Array.isArray(messages) || messages.length === 0) return;

    const latest = messages[messages.length - 1];
    if (!latest) return;

    const key = typeof latest === "string" ? latest : JSON.stringify(latest);
    if (key === processedRef.current) return;
    processedRef.current = key;

    const data = extractPitchData(latest);
    if (data) {
      setDebug(prev => prev + " ✓");
    }
    handleData(data);
  }, [messages]);

  useEffect(() => {
    if (!event) return;
    const data = extractPitchData(event);
    handleData(data);
  }, [event]);

  useEffect(() => {
    return clearTimer;
  }, []);

  const dir = direction || inferDirection({ ball_position: ballPos, ball_position_end: ballEnd });

  return (
    <div className="pitch-wrapper">
      <div className="pitch">
        <div className="half-line" />
        <div className="center-circle" />

        {mode === "possession" && (
          <div className={`overlay possession ${dir === "away" ? "away" : "home"}`} />
        )}

        {mode === "attack" && (
          <div className={`overlay attack ${dir === "away" ? "away" : "home"}`}>
            <div className="arrows">
              {dir === "away" ? "◀ ◀ ◀ ◀" : "▶ ▶ ▶ ▶"}
            </div>
          </div>
        )}

        {mode === "dangerous" && (
          <div className={`overlay dangerous ${dir === "away" ? "away" : "home"}`} />
        )}

        {ballPos && (
          <div
            className="ball"
            style={{
              left: `${ballPos.x}%`,
              top: `${ballPos.y}%`,
            }}
          />
        )}

        {ballEnd && mode && (
          <div
            className="ball-end"
            style={{
              left: `${ballEnd.x}%`,
              top: `${ballEnd.y}%`,
            }}
          />
        )}
      </div>
      {debug && <div className="pitch-debug">parsed{debug}</div>}
    </div>
  );
}
