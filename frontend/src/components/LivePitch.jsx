import "./LivePitch.css";
import { useEffect, useState } from "react";

export default function LivePitch({
  event,
  homeTeamId,
  awayTeamId,
}) {
  const [state, setState] = useState({
    mode: null,
    activeTeam: null,
    ballPosition: null,
  });

  useEffect(() => {
    if (!event) return;

    const payload =
      typeof event === "string"
        ? JSON.parse(event)
        : event;

    if (payload.event_type === 0) {
      const d = payload.event_data;

      let mode = null;

      if (d.is_dangerous_attack)
        mode = "dangerous";

      else if (d.is_attack)
        mode = "attack";

      else if (d.is_possession)
        mode = "possession";

      setState(prev => ({
        ...prev,
        activeTeam: d.team_id,
        mode,
      }));
    }

    if (
      payload.event_type === 3 &&
      payload.event_data.ball_position
    ) {
      setState(prev => ({
        ...prev,
        ballPosition:
          payload.event_data.ball_position,
      }));
    }
  }, [event]);

  const isHome =
    state.activeTeam === homeTeamId;

  return (
    <div className="pitch">

      <div className="half-line" />
      <div className="center-circle" />

      {state.mode === "possession" && (
        <div
          className={`overlay possession ${
            isHome
              ? "home"
              : "away"
          }`}
        />
      )}

      {state.mode === "attack" && (
        <div
          className={`overlay attack ${
            isHome
              ? "home"
              : "away"
          }`}
        >
          <div className="arrows">
            {isHome
              ? "▶ ▶ ▶ ▶"
              : "◀ ◀ ◀ ◀"}
          </div>
        </div>
      )}

      {state.mode === "dangerous" && (
        <div
          className={`overlay dangerous ${
            isHome
              ? "home"
              : "away"
          }`}
        />
      )}

      {state.ballPosition && (
        <div
          className="ball"
          style={{
            left: `${state.ballPosition.x}%`,
            top: `${state.ballPosition.y}%`,
          }}
        />
      )}
    </div>
  );
}