import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface UsageData {
  plan: string;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  sessionStart: string | null;
  burnRate: number;
  estimatedRemainingMin: number;
  usagePercent: number;
  windowRemainingMin: number;
  sessions: SessionInfo[];
  lastUpdated: string;
  status: string;
}

interface SessionInfo {
  id: string;
  tokens: number;
  cost: number;
  messages: number;
  started: string;
}

const PLANS = ["pro", "max5", "max20"];
const appWindow = getCurrentWindow();

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatCost(n: number): string {
  if (n >= 100) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

function formatTime(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return Math.round(min) + "m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "#22c55e",
    warning: "#f59e0b",
    critical: "#ef4444",
  };
  return (
    <span
      className="status-dot"
      style={{ background: colors[status] || colors.ok }}
    />
  );
}

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const clamp = Math.min(100, Math.max(0, percent));
  const color =
    status === "critical"
      ? "#ef4444"
      : status === "warning"
        ? "#f59e0b"
        : "#8b5cf6";

  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${clamp}%`, background: color }}
      />
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    invoke<UsageData>("get_usage").then(setData);

    const unlisten = listen<UsageData>("usage-updated", (event) => {
      setData(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handlePlanChange = async (plan: string) => {
    const result = await invoke<UsageData>("set_plan", { plan });
    setData(result);
  };

  const onMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Don't drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, select, input, a")) return;
    e.preventDefault();
    await appWindow.startDragging();
  }, []);

  if (!data) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Scanning Claude usage...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Custom titlebar — mousedown triggers drag */}
      <div className="titlebar" onMouseDown={onMouseDown}>
        <div className="titlebar-left">
          <StatusDot status={data.status} />
          <span className="title">Claude Scouter</span>
        </div>
        <div className="titlebar-right">
          <select
            value={data.plan}
            onChange={(e) => handlePlanChange(e.target.value)}
            className="plan-select"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main usage */}
      <div className="section">
        <div className="usage-header">
          <span className="usage-label">Token Usage (5h window)</span>
          <span className="usage-value">
            {formatTokens(data.totalTokens)} / {formatTokens(data.limit)}
          </span>
        </div>
        <ProgressBar percent={data.usagePercent} status={data.status} />
        <div className="usage-sub">
          <span className="usage-percent">{data.usagePercent.toFixed(1)}%</span>
          {data.windowRemainingMin > 0 && (
            <span className="window-reset">
              🔄 {formatTime(data.windowRemainingMin)}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-label">Input</span>
          <span className="stat-value">{formatTokens(data.inputTokens)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Output</span>
          <span className="stat-value">{formatTokens(data.outputTokens)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cache Read</span>
          <span className="stat-value">
            {formatTokens(data.cacheReadTokens)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Cache Write</span>
          <span className="stat-value">
            {formatTokens(data.cacheCreationTokens)}
          </span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="metrics">
        <div className="metric">
          <span className="metric-icon">💰</span>
          <div>
            <span className="metric-label">Cost</span>
            <span className="metric-value">{formatCost(data.totalCost)}</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">🔥</span>
          <div>
            <span className="metric-label">Burn Rate</span>
            <span className="metric-value">
              {formatTokens(Math.round(data.burnRate))}/min
            </span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">⏱️</span>
          <div>
            <span className="metric-label">Until Limit</span>
            <span
              className={`metric-value ${data.status === "critical" ? "critical" : ""}`}
            >
              {formatTime(data.estimatedRemainingMin)}
            </span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">💬</span>
          <div>
            <span className="metric-label">Messages</span>
            <span className="metric-value">{data.messageCount}</span>
          </div>
        </div>
      </div>

      {/* Sessions */}
      {data.sessions.length > 0 && (
        <div className="section sessions">
          <h3>Sessions ({data.sessions.length})</h3>
          <div className="session-list">
            {data.sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="session-item">
                <span className="session-id">
                  {s.id.slice(0, 8)}...
                </span>
                <span className="session-tokens">
                  {formatTokens(s.tokens)}
                </span>
                <span className="session-msgs">{s.messages} msgs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <span>
          Updated:{" "}
          {new Date(data.lastUpdated).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
