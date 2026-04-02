import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UsageData, ViewMode } from "../types";
import { formatTokens, formatTime, usageColor } from "../utils";
import "./MiniView.css";

interface Props {
  data: UsageData;
  onModeChange: (mode: ViewMode) => void;
}

export default function MiniView({ data, onModeChange }: Props) {
  const dragged = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragged.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    await invoke("start_drag");
    // After drag ends, mark as dragged if moved
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx > 5 || dy > 5) {
      dragged.current = true;
    }
  };

  const handleClick = () => {
    if (!dragged.current) {
      onModeChange("full");
    }
  };

  const percent = Math.min(100, data.usagePercent);
  const color = usageColor(data.status);
  const isCritical = data.status === "critical";
  const isWarning = data.status === "warning";
  const activeSessions = data.sessions.filter(s => s.status === "active").length;

  return (
    <div
      className={`mini-view ${isCritical ? "critical" : isWarning ? "warning" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      title="Click to expand"
    >
      {/* Progress bar */}
      <div className="mini-progress">
        <div className="mini-progress-fill" style={{ width: `${percent}%`, background: color }} />
      </div>

      {/* Info row */}
      <div className="mini-info">
        <span className="mini-dot" style={{ background: color }} />
        <span className="mini-pct" style={{ color }}>{percent.toFixed(0)}%</span>
        <span className="mini-tokens">{formatTokens(data.totalTokens)}</span>
        {data.burnRate > 0 && (
          <span className="mini-burn">🔥{formatTokens(Math.round(data.burnRate))}/m</span>
        )}
        {data.estimatedRemainingMin > 0 && data.burnRate > 0 && (
          <span className="mini-time">⏱{formatTime(data.estimatedRemainingMin)}</span>
        )}
        {activeSessions > 0 && (
          <span className="mini-sessions">💬{activeSessions}</span>
        )}
      </div>
    </div>
  );
}
