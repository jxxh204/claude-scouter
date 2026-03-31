import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface UsageData {
  plan: string;
  limit: number;
  customLimit: number | null;
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
  projects: ProjectInfo[];
  hourlyUsage: HourlyPoint[];
  models: ModelUsage[];
  dailyHistory: DailyPoint[];
  activeProject: string | null;
  lastUpdated: string;
  status: string;
}

interface SessionInfo { id: string; tokens: number; cost: number; messages: number; started: string; }
interface ProjectInfo { name: string; path: string; tokens: number; messages: number; cost: number; }
interface HourlyPoint { hour: string; tokens: number; messages: number; }
interface ModelUsage { model: string; inputTokens: number; outputTokens: number; totalTokens: number; cost: number; messages: number; }
interface DailyPoint { date: string; tokens: number; cost: number; messages: number; }

const PLANS = ["pro", "max5", "max20", "custom"];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatCost(n: number): string {
  if (n >= 100) return "$" + n.toFixed(2);
  if (n >= 1) return "$" + n.toFixed(2);
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
  const colors: Record<string, string> = { ok: "#22c55e", warning: "#f59e0b", critical: "#ef4444" };
  return <span className="status-dot" style={{ background: colors[status] || colors.ok }} />;
}

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const clamp = Math.min(100, Math.max(0, percent));
  const color = status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#8b5cf6";
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${clamp}%`, background: color }} />
    </div>
  );
}

function MiniChart({ data, labelKey, valueKey }: { data: { [k: string]: any }[]; labelKey: string; valueKey: string }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d[valueKey] as number), 1);
  return (
    <div className="mini-chart">
      <div className="chart-bars">
        {data.map((point, i) => (
          <div key={i} className="chart-bar-container">
            <div
              className="chart-bar"
              style={{ height: `${((point[valueKey] as number) / maxVal) * 100}%` }}
              title={`${point[labelKey]}: ${formatTokens(point[valueKey] as number)}`}
            />
            <span className="chart-bar-label">
              {String(point[labelKey]).replace(/^\d{4}-\d{2}-/, "").replace(/:00$/, "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Countdown component that ticks every second
function Countdown({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);

  useEffect(() => {
    setRemaining(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining > 0]);

  if (remaining <= 0) return <span>—</span>;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const display = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return <span>{display}</span>;
}

type Tab = "overview" | "models" | "projects" | "history" | "sessions";

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showCustomLimit, setShowCustomLimit] = useState(false);
  const [customLimitInput, setCustomLimitInput] = useState("");

  useEffect(() => {
    invoke<UsageData>("get_usage").then(setData);
    const unlisten = listen<UsageData>("usage-updated", (event) => setData(event.payload));
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handlePlanChange = async (plan: string) => {
    if (plan === "custom") { setShowCustomLimit(true); return; }
    setShowCustomLimit(false);
    setData(await invoke<UsageData>("set_plan", { plan }));
  };

  const handleCustomLimit = async () => {
    const limit = parseInt(customLimitInput);
    if (isNaN(limit) || limit <= 0) return;
    setData(await invoke<UsageData>("set_custom_limit", { limit }));
    setShowCustomLimit(false);
  };

  const handleProjectFilter = async (project: string | null) => {
    setData(await invoke<UsageData>("set_project_filter", { project: project || null }));
  };

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, select, input, a, .tab, .plan-select")) return;
    e.preventDefault();
    e.stopPropagation();
    await invoke("start_drag");
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
      <div className="titlebar" onMouseDown={handleDrag}>
        <div className="titlebar-left">
          <StatusDot status={data.status} />
          <span className="title">Claude Scouter</span>
        </div>
        <div className="titlebar-right">
          <select value={data.plan} onChange={(e) => handlePlanChange(e.target.value)} className="plan-select">
            {PLANS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {showCustomLimit && (
        <div className="custom-limit-row">
          <input type="number" placeholder="Token limit" value={customLimitInput}
            onChange={(e) => setCustomLimitInput(e.target.value)} className="custom-limit-input" autoFocus />
          <button onClick={handleCustomLimit} className="custom-limit-btn">Set</button>
        </div>
      )}

      <div className="section">
        <div className="usage-header">
          <span className="usage-label">Token Usage (5h)</span>
          <span className="usage-value">{formatTokens(data.totalTokens)} / {formatTokens(data.limit)}</span>
        </div>
        <ProgressBar percent={data.usagePercent} status={data.status} />
        <div className="usage-sub">
          <span className="usage-percent">{data.usagePercent.toFixed(1)}%</span>
          {data.estimatedRemainingMin > 0 && data.burnRate > 0 && (
            <span className={`countdown ${data.status === "critical" ? "critical" : data.status === "warning" ? "warning" : ""}`}>
              ⏱️ <Countdown minutes={data.estimatedRemainingMin} />
            </span>
          )}
          {data.windowRemainingMin > 0 && (
            <span className="window-reset">🔄 {formatTime(data.windowRemainingMin)}</span>
          )}
        </div>
      </div>

      <div className="tabs">
        {(["overview", "models", "projects", "history", "sessions"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "📊" : t === "models" ? "🤖" : t === "projects" ? "📁" : t === "history" ? "📈" : "💬"}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === "overview" && (
          <>
            <div className="stats-grid">
              <div className="stat"><span className="stat-label">Input</span><span className="stat-value">{formatTokens(data.inputTokens)}</span></div>
              <div className="stat"><span className="stat-label">Output</span><span className="stat-value">{formatTokens(data.outputTokens)}</span></div>
              <div className="stat"><span className="stat-label">Cache Read</span><span className="stat-value">{formatTokens(data.cacheReadTokens)}</span></div>
              <div className="stat"><span className="stat-label">Cache Write</span><span className="stat-value">{formatTokens(data.cacheCreationTokens)}</span></div>
            </div>
            <div className="metrics">
              <div className="metric"><span className="metric-icon">💰</span><div><span className="metric-label">Cost</span><span className="metric-value">{formatCost(data.totalCost)}</span></div></div>
              <div className="metric"><span className="metric-icon">🔥</span><div><span className="metric-label">Burn Rate</span><span className="metric-value">{formatTokens(Math.round(data.burnRate))}/min</span></div></div>
              <div className="metric"><span className="metric-icon">💬</span><div><span className="metric-label">Messages</span><span className="metric-value">{data.messageCount}</span></div></div>
            </div>
            <div className="chart-section">
              <div className="chart-label">Hourly</div>
              <MiniChart data={data.hourlyUsage} labelKey="hour" valueKey="tokens" />
            </div>
          </>
        )}

        {tab === "models" && (
          <div className="model-list">
            {data.models.length === 0 && <div className="empty-state">No model data in current window</div>}
            {data.models.map((m) => (
              <div key={m.model} className="model-item">
                <div className="model-header">
                  <span className="model-name">{m.model.split("/").pop() || m.model}</span>
                  <span className="model-cost">{formatCost(m.cost)}</span>
                </div>
                <div className="model-stats">
                  <span>In: {formatTokens(m.inputTokens)}</span>
                  <span>Out: {formatTokens(m.outputTokens)}</span>
                  <span>{m.messages} msgs</span>
                </div>
                <div className="model-bar-container">
                  <div className="model-bar" style={{
                    width: `${data.models[0] ? (m.totalTokens / data.models[0].totalTokens) * 100 : 0}%`
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "projects" && (
          <div className="project-list">
            <div className={`project-item ${!data.activeProject ? "active" : ""}`} onClick={() => handleProjectFilter("")}>
              <span className="project-name">All Projects</span>
              <span className="project-tokens">{formatTokens(data.projects.reduce((s, p) => s + p.tokens, 0))}</span>
            </div>
            {data.projects.filter((p) => p.tokens > 0 || p.name === data.activeProject).map((p) => (
              <div key={p.name} className={`project-item ${data.activeProject === p.name ? "active" : ""}`}
                onClick={() => handleProjectFilter(p.name)}>
                <span className="project-name" title={p.path}>{p.name.length > 25 ? "..." + p.name.slice(-22) : p.name}</span>
                <span className="project-tokens">{formatTokens(p.tokens)}</span>
                <span className="project-msgs">{p.messages} msgs</span>
              </div>
            ))}
            {data.projects.filter((p) => p.tokens > 0).length === 0 && <div className="empty-state">No projects in current window</div>}
          </div>
        )}

        {tab === "history" && (
          <div className="history-view">
            <div className="chart-section">
              <div className="chart-label">7-Day Token Usage</div>
              <MiniChart data={data.dailyHistory} labelKey="date" valueKey="tokens" />
            </div>
            <div className="chart-section" style={{ marginTop: 12 }}>
              <div className="chart-label">7-Day Cost</div>
              <MiniChart data={data.dailyHistory} labelKey="date" valueKey="cost" />
            </div>
            <div className="history-table">
              {data.dailyHistory.slice().reverse().map((d) => (
                <div key={d.date} className="history-row">
                  <span className="history-date">{d.date.slice(5)}</span>
                  <span className="history-tokens">{formatTokens(d.tokens)}</span>
                  <span className="history-cost">{formatCost(d.cost)}</span>
                  <span className="history-msgs">{d.messages} msgs</span>
                </div>
              ))}
              {data.dailyHistory.length === 0 && <div className="empty-state">No history data</div>}
            </div>
          </div>
        )}

        {tab === "sessions" && (
          <div className="session-list">
            {data.sessions.slice(0, 15).map((s) => (
              <div key={s.id} className="session-item">
                <span className="session-id">{s.id.slice(0, 8)}...</span>
                <span className="session-tokens">{formatTokens(s.tokens)}</span>
                <span className="session-msgs">{s.messages} msgs</span>
              </div>
            ))}
            {data.sessions.length === 0 && <div className="empty-state">No sessions in current window</div>}
          </div>
        )}
      </div>

      <div className="footer">
        <span>Updated: {new Date(data.lastUpdated).toLocaleTimeString()}</span>
        {data.activeProject && (
          <span className="filter-badge" onClick={() => handleProjectFilter("")}>
            📁 {data.activeProject.split("/").pop()} ✕
          </span>
        )}
      </div>
    </div>
  );
}
