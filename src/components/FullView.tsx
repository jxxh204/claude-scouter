import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UsageData, ViewMode } from "../types";
import { formatTokens, formatCost, formatTime, relativeTime, toolIcon, statusColor, usageColor } from "../utils";
import "./FullView.css";

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

function BarChart({ data, labelKey, valueKey, height = 80 }: { data: Record<string, any>[]; labelKey: string; valueKey: string; height?: number }) {
  if (!data.length) return <div className="f-empty">No data</div>;
  const max = Math.max(...data.map(d => d[valueKey] as number), 1);
  return (
    <div className="f-chart-bars" style={{ height }}>
      {data.map((point, i) => (
        <div key={i} className="f-bar-col">
          <div className="f-bar" style={{ height: `${((point[valueKey] as number) / max) * 100}%` }}
            title={`${point[labelKey]}: ${formatTokens(point[valueKey] as number)}`} />
          <span className="f-bar-label">{String(point[labelKey]).replace(/^\d{4}-\d{2}-/, "").replace(/:00$/, "")}</span>
        </div>
      ))}
    </div>
  );
}

export default function FullView({ data, onModeChange }: Props) {
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

  const handleProjectFilter = async (project: string | null) => {
    await invoke("set_project_filter", { project: project || null });
  };

  const percent = Math.min(100, data.usagePercent);
  const color = usageColor(data.status);
  const cacheHitRate = data.cacheReadTokens / Math.max(data.cacheReadTokens + data.inputTokens, 1);
  const ioRatio = data.outputTokens / Math.max(data.inputTokens, 1);

  return (
    <div className="full-view">
      {/* Titlebar */}
      <div className="f-titlebar" onMouseDown={handleDrag}>
        <div className="f-titlebar-left">
          <span className="f-status-dot" style={{ background: statusColor(data.status) }} />
          <span className="f-title">Claude Scouter</span>
          {data.status !== "ok" && (
            <span className={`f-alert-badge ${data.status}`}>
              {data.status === "critical" ? "🚨 CRITICAL" : "⚠️ WARNING"}
            </span>
          )}
        </div>
        <div className="f-titlebar-right">
          <select value={data.plan} onChange={e => handlePlanChange(e.target.value)} className="f-plan-select">
            {PLANS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {showCustomLimit && (
        <div className="f-custom-limit">
          <input type="number" placeholder="Token limit" value={customLimitInput}
            onChange={e => setCustomLimitInput(e.target.value)} className="f-custom-input" autoFocus />
          <button onClick={handleCustomLimit} className="f-custom-btn">Set</button>
        </div>
      )}

      {/* Main grid */}
      <div className="f-grid">
        {/* Left column — Usage overview */}
        <div className="f-col-left">
          {/* Usage gauge */}
          <div className="f-panel f-usage-panel">
            <div className="f-usage-header">
              <span className="f-panel-title">TOKEN USAGE (5h)</span>
              <span className="f-usage-value">{formatTokens(data.totalTokens)} / {formatTokens(data.limit)}</span>
            </div>
            <div className="f-progress">
              <div className="f-progress-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
            <div className="f-usage-sub">
              <span className="f-pct">{data.usagePercent.toFixed(1)}%</span>
              {data.estimatedRemainingMin > 0 && data.burnRate > 0 && (
                <span className={`f-countdown ${data.status}`}>
                  ⏱️ <Countdown minutes={data.estimatedRemainingMin} />
                </span>
              )}
              {data.windowRemainingMin > 0 && (
                <span className="f-window-reset">🔄 {formatTime(data.windowRemainingMin)}</span>
              )}
            </div>
          </div>

          {/* Token breakdown */}
          <div className="f-panel">
            <div className="f-panel-title">TOKEN BREAKDOWN</div>
            <div className="f-stats-grid-4">
              <div className="f-stat"><span className="f-stat-label">Input</span><span className="f-stat-value">{formatTokens(data.inputTokens)}</span></div>
              <div className="f-stat"><span className="f-stat-label">Output</span><span className="f-stat-value">{formatTokens(data.outputTokens)}</span></div>
              <div className="f-stat"><span className="f-stat-label">Cache Read</span><span className="f-stat-value">{formatTokens(data.cacheReadTokens)}</span></div>
              <div className="f-stat"><span className="f-stat-label">Cache Write</span><span className="f-stat-value">{formatTokens(data.cacheCreationTokens)}</span></div>
            </div>
          </div>

          {/* Efficiency gauges */}
          <div className="f-panel">
            <div className="f-panel-title">EFFICIENCY</div>
            <div className="f-efficiency-row">
              <div className="f-eff-item">
                <span className="f-eff-label">Cache Hit Rate</span>
                <div className="f-eff-bar"><div className="f-eff-fill" style={{ width: `${(cacheHitRate * 100)}%`, background: cacheHitRate > 0.3 ? "#22c55e" : "#f59e0b" }} /></div>
                <span className="f-eff-value">{(cacheHitRate * 100).toFixed(1)}%</span>
              </div>
              <div className="f-eff-item">
                <span className="f-eff-label">I/O Ratio</span>
                <div className="f-eff-bar"><div className="f-eff-fill" style={{ width: `${Math.min(100, ioRatio * 33)}%`, background: ioRatio > 1.5 ? "#22c55e" : "#8b5cf6" }} /></div>
                <span className="f-eff-value">{ioRatio.toFixed(2)}x</span>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="f-panel f-metrics-row">
            <div className="f-metric"><span className="f-metric-icon">💰</span><span className="f-metric-label">Cost</span><span className="f-metric-value">{formatCost(data.totalCost)}</span></div>
            <div className="f-metric"><span className="f-metric-icon">🔥</span><span className="f-metric-label">Burn</span><span className="f-metric-value">{formatTokens(Math.round(data.burnRate))}/m</span></div>
            <div className="f-metric"><span className="f-metric-icon">💬</span><span className="f-metric-label">Msgs</span><span className="f-metric-value">{data.messageCount}</span></div>
          </div>

          {/* Hourly chart */}
          <div className="f-panel">
            <div className="f-panel-title">HOURLY USAGE</div>
            <BarChart data={data.hourlyUsage} labelKey="hour" valueKey="tokens" />
          </div>

          {/* Daily history */}
          <div className="f-panel">
            <div className="f-panel-title">7-DAY HISTORY</div>
            <BarChart data={data.dailyHistory} labelKey="date" valueKey="tokens" height={60} />
            <div className="f-history-table">
              {data.dailyHistory.slice().reverse().map(d => (
                <div key={d.date} className="f-history-row">
                  <span className="f-hdate">{d.date.slice(5)}</span>
                  <span className="f-htokens">{formatTokens(d.tokens)}</span>
                  <span className="f-hcost">{formatCost(d.cost)}</span>
                  <span className="f-hmsgs">{d.messages} msgs</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Sessions & Activity */}
        <div className="f-col-right">
          {/* Session monitor */}
          <div className="f-panel f-sessions-panel">
            <div className="f-panel-title">
              SESSIONS ({data.sessions.length})
              <span className="f-session-counts">
                {data.sessions.filter(s => s.status === "active").length > 0 && (
                  <span className="f-sbadge active">🟢 {data.sessions.filter(s => s.status === "active").length}</span>
                )}
                {data.sessions.filter(s => s.status === "idle").length > 0 && (
                  <span className="f-sbadge idle">🟡 {data.sessions.filter(s => s.status === "idle").length}</span>
                )}
              </span>
            </div>
            <div className="f-session-list">
              {data.sessions.slice(0, 10).map(s => (
                <div key={s.id} className="f-session-item">
                  <div className="f-session-header">
                    <span className="f-sdot" style={{ background: statusColor(s.status) }} />
                    <span className="f-sid">{s.id.slice(0, 8)}</span>
                    {s.model && <span className="f-smodel">{s.model}</span>}
                    <span className="f-stime">{relativeTime(s.lastActive)}</span>
                  </div>
                  {s.project && <div className="f-sproject">📁 {s.project.split("/").pop()}</div>}
                  <div className="f-sstats">
                    <span className="f-sstats-tokens">{formatTokens(s.tokens)}</span>
                    <span>{s.messages} msgs</span>
                    <span>{formatCost(s.cost)}</span>
                  </div>
                  {s.recentTools.length > 0 && (
                    <div className="f-stools">
                      {s.recentTools.slice(0, 5).map((t, i) => (
                        <span key={i} className="f-stool-tag">{toolIcon(t)} {t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {data.sessions.length === 0 && <div className="f-empty">No sessions in current window</div>}
            </div>
          </div>

          {/* Model breakdown */}
          <div className="f-panel">
            <div className="f-panel-title">MODELS</div>
            {data.models.map(m => (
              <div key={m.model} className="f-model-item">
                <div className="f-model-header">
                  <span className="f-model-name">{m.model.split("/").pop() || m.model}</span>
                  <span className="f-model-cost">{formatCost(m.cost)}</span>
                </div>
                <div className="f-model-stats">
                  <span>In: {formatTokens(m.inputTokens)}</span>
                  <span>Out: {formatTokens(m.outputTokens)}</span>
                  <span>{m.messages} msgs</span>
                </div>
                <div className="f-model-bar"><div className="f-model-fill" style={{
                  width: `${data.models[0] ? (m.totalTokens / data.models[0].totalTokens) * 100 : 0}%`
                }} /></div>
              </div>
            ))}
            {data.models.length === 0 && <div className="f-empty">No model data</div>}
          </div>

          {/* Projects */}
          <div className="f-panel">
            <div className="f-panel-title">PROJECTS</div>
            {data.projects.filter(p => p.tokens > 0).slice(0, 8).map(p => (
              <div key={p.name} className={`f-project-item ${data.activeProject === p.name ? "active" : ""}`}
                onClick={() => handleProjectFilter(data.activeProject === p.name ? null : p.name)}>
                <span className="f-proj-name" title={p.path}>
                  {p.name.length > 25 ? "..." + p.name.slice(-22) : p.name}
                </span>
                <span className="f-proj-tokens">{formatTokens(p.tokens)}</span>
                <span className="f-proj-msgs">{p.messages} msgs</span>
              </div>
            ))}
            {data.activeProject && (
              <button className="f-clear-filter" onClick={() => handleProjectFilter(null)}>Clear filter ✕</button>
            )}
          </div>

          {/* Recent activity */}
          <div className="f-panel f-activity-panel">
            <div className="f-panel-title">RECENT ACTIVITY</div>
            <div className="f-activity-list">
              {data.recentActivities.slice(0, 10).map((a, i) => (
                <div key={i} className="f-activity-item">
                  <span className="f-activity-icon">{toolIcon(a.tool)}</span>
                  <div className="f-activity-body">
                    <span className="f-activity-tool">{a.tool}</span>
                    {a.summary && <span className="f-activity-summary">{a.summary}</span>}
                    <div className="f-activity-meta">
                      <span>📁 {a.project.split("/").pop()}</span>
                      <span>{relativeTime(a.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {data.recentActivities.length === 0 && <div className="f-empty">No recent activity</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="f-footer">
        <span>Updated: {new Date(data.lastUpdated).toLocaleTimeString()}</span>
        {data.activeProject && (
          <span className="f-filter-badge" onClick={() => handleProjectFilter(null)}>
            📁 {data.activeProject.split("/").pop()} ✕
          </span>
        )}
      </div>
    </div>
  );
}
