import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UsageData, ViewMode } from "../types";
import { formatTokens, formatTime, usageColor } from "../utils";
import "./MiniView.css";

interface Props {
  data: UsageData;
  onModeChange: (mode: ViewMode) => void;
}

export default function MiniView({ data, onModeChange }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (data.status === "critical") {
      setPulse(true);
    } else {
      setPulse(false);
    }
  }, [data.status]);

  const handleDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    await invoke("start_drag");
  };

  const handleClick = () => onModeChange("compact");

  const percent = Math.min(100, data.usagePercent);
  const color = usageColor(data.status);

  // SVG circular gauge
  const size = 96;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div
      className={`mini-view ${pulse ? "pulse" : ""}`}
      onMouseDown={handleDrag}
      onClick={handleClick}
      title="Click to expand"
    >
      <svg width={size} height={size} className="mini-gauge">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a1a2e"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="mini-gauge-progress"
        />
      </svg>

      <div className="mini-center">
        <span className="mini-pct" style={{ color }}>{percent.toFixed(0)}%</span>
        {data.burnRate > 0 && (
          <span className="mini-burn">{formatTokens(Math.round(data.burnRate))}/m</span>
        )}
      </div>
    </div>
  );
}
