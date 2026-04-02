import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UsageData, ViewMode } from "../types";
import { formatTokens, formatCost, formatTime, statusColor, usageColor } from "../utils";
import "./CompactView.css";

interface Props {
  data: UsageData;
  onModeChange: (mode: ViewMode) => void;
}

const PLANS = ["pro", "max5", "max20", "custom"];

function Countdown({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(Math.round(minutes * 60));
  useEffect(() => { setRemaining(Math.round(minutes * 60)); }, [minutes]);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining > 0]);
  if (remaining <= 0) return <span>—</span>;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return <span>{h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

export default function CompactView({ data, onModeChange }: Props) {
  const [showCustomLimit, setShowCustomLimit] = useState(false);
  const [customLimitInput, setCustomLimitInput] = useState("");

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, select, input")) return;
    e.preventDefault();
    await invoke("start_drag");
  }, []);

  const handlePlanChange = async (plan: string) => {
    if (plan === "custom") { setShowCustomLimit(true); return; }
    setShowCustomLimit(false);
    await invoke("set_plan", { plan });
  };

  const handleCustomLimit = async () => {
    const limit = parseInt(customLimitInput);
    if (isNaN(limit) || limit <= 0) return;
    await invoke("set_custom_limit", { limit });
    setShowCustomLimit(false);
  };

  const percent = Math.min(100, data.usagePercent);
  const color = usageColor(data.status);
  const activeSessions = data.sessions.filter(s => s.status === "active").length;
  const idleSessions = data.sessions.filter(s => s.status === "idle").length;

  return (
    <div className="compact-view">
      {/* Titlebar */}
      <div className="c-titlebar" onMouseDown={handleDrag}>
        <div className="c-titlebar-left">
          <span className="c-status-dot" style={{ background: statusColor(data.status) }} />
          <span className="c-title">Claude Scouter</span>
        </div>
        <div className="c-titlebar-right">
          <select value={data.plan} onChange={e => handlePlanChange(e.target.value)} className="c-plan-select">
            {PLANS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {showCustomLimit && (
        <div className="c-custom-limit">
          <input type="number" placeholder="Token limit" value={customLimitInput}
            onChange={e => setCustomLimitInput(e.target.value)} className="c-custom-input" autoFocus />
          <button onClick={handleCustomLimit} className="c-custom-btn">Set</button>
        </div>
      )}

      {/* Usage bar */}
      <div className="c-section c-usage">
        <div className="c-usage-header">
          <span className="c-label">TOKEN USAGE (5h)</span>
          <span className="c-value">{formatTokens(data.totalTokens)} / {formatTokens(data.limit)}</span>
        </div>
        <div className="c-progress">
          <div className="c-progress-fill" style={{ width: `${percent}%`, background: color }} />
        </div>
        <div className="c-usage-sub">
          <span className="c-pct">{data.usagePercent.toFixed(1)}%</span>
          {data.estimatedRemainingMin > 0 && data.burnRate > 0 && (
            <span className={`c-countdown ${data.status}`}>
              ⏱️ <Countdown minutes={data.estimatedRemainingMin} />
            </span>
          )}
          {data.windowRemainingMin > 0 && (
            <span className="c-window-reset">🔄 {formatTime(data.windowRemainingMin)}</span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="c-section">
        <div className="c-stats-grid">
          <div className="c-stat"><span className="c-stat-label">Input</span><span className="c-stat-value">{formatTokens(data.inputTokens)}</span></div>
          <div className="c-stat"><span className="c-stat-label">Output</span><span className="c-stat-value">{formatTokens(data.outputTokens)}</span></div>
          <div className="c-stat"><span className="c-stat-label">Cache Read</span><span className="c-stat-value">{formatTokens(data.cacheReadTokens)}</span></div>
          <div className="c-stat"><span className="c-stat-label">Cache Write</span><span className="c-stat-value">{formatTokens(data.cacheCreationTokens)}</span></div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="c-section c-metrics">
        <div className="c-metric">
          <span className="c-metric-icon">💰</span>
          <span className="c-metric-label">Cost</span>
          <span className="c-metric-value">{formatCost(data.totalCost)}</span>
        </div>
        <div className="c-metric">
          <span className="c-metric-icon">🔥</span>
          <span className="c-metric-label">Burn</span>
          <span className="c-metric-value">{formatTokens(Math.round(data.burnRate))}/m</span>
        </div>
        <div className="c-metric">
          <span className="c-metric-icon">💬</span>
          <span className="c-metric-label">Msgs</span>
          <span className="c-metric-value">{data.messageCount}</span>
        </div>
      </div>

      {/* Sessions summary */}
      <div className="c-section c-sessions-summary">
        <div className="c-label">SESSIONS</div>
        <div className="c-session-counts">
          {activeSessions > 0 && <span className="c-session-badge active">🟢 {activeSessions} active</span>}
          {idleSessions > 0 && <span className="c-session-badge idle">🟡 {idleSessions} idle</span>}
          <span className="c-session-badge total">{data.sessions.length} total</span>
        </div>
        {data.sessions.slice(0, 3).map(s => (
          <div key={s.id} className="c-session-row">
            <span className="c-sdot" style={{ background: statusColor(s.status) }} />
            <span className="c-sid">{s.id.slice(0, 8)}</span>
            {s.model && <span className="c-smodel">{s.model}</span>}
            <span className="c-stokens">{formatTokens(s.tokens)}</span>
          </div>
        ))}
      </div>

      {/* Alert */}
      {data.status !== "ok" && (
        <div className={`c-alert ${data.status}`}>
          {data.status === "critical" ? "🚨" : "⚠️"} {data.usagePercent.toFixed(1)}% — {data.status === "critical" ? "Critical!" : "Watch usage"}
        </div>
      )}

      {/* Footer */}
      <div className="c-footer">
        <span>Updated: {new Date(data.lastUpdated).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
