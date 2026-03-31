import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PixelDungeon from "./PixelDungeon";

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

// Diablo-style Productivity Game
function calculateDiablo(data: UsageData) {
  const totalTokens = data.totalTokens;
  const msgs = data.messageCount;
  const outputRatio = data.outputTokens / Math.max(data.inputTokens, 1);
  const cacheHitRate = data.cacheReadTokens / Math.max(data.inputTokens + data.cacheReadTokens, 1);
  const projectCount = data.projects.filter(p => p.tokens > 0).length;
  const modelCount = data.models.length;

  // Level & XP
  const xp = Math.floor(totalTokens / 50);
  const level = Math.floor(Math.sqrt(xp / 5)) + 1;
  const xpBase = Math.pow(level - 1, 2) * 5;
  const xpNext = Math.pow(level, 2) * 5;
  const xpProgress = ((xp - xpBase) / Math.max(1, xpNext - xpBase)) * 100;

  // HP & Mana
  const maxHp = 100 + level * 20;
  const hp = Math.max(10, maxHp - Math.floor(data.usagePercent * 1.5)); // HP drops as usage approaches limit
  const maxMana = 50 + level * 10;
  const mana = Math.min(maxMana, Math.floor(cacheHitRate * maxMana * 2)); // Mana from cache efficiency

  // Character class
  const classes = [
    { name: "Barbarian", icon: "⚔️", cond: data.burnRate > 300 },
    { name: "Sorcerer", icon: "🔮", cond: modelCount >= 2 && cacheHitRate > 0.3 },
    { name: "Rogue", icon: "🗡️", cond: outputRatio > 2.5 },
    { name: "Druid", icon: "🌿", cond: projectCount >= 3 },
    { name: "Necromancer", icon: "💀", cond: data.hourlyUsage.some(h => parseInt(h.hour) >= 23 || parseInt(h.hour) <= 5) },
  ];
  const charClass = classes.find(c => c.cond) || { name: "Wanderer", icon: "🚶" };

  // Stats (Diablo-style)
  const strength = Math.min(999, Math.floor(data.outputTokens / 1000)); // Raw output
  const dexterity = Math.min(999, Math.floor(outputRatio * 100)); // Efficiency
  const intelligence = Math.min(999, Math.floor(cacheHitRate * 500 + modelCount * 50)); // Smart usage
  const vitality = Math.min(999, Math.floor(msgs * 2)); // Endurance

  // Equipment (generated from usage patterns)
  type Rarity = "common" | "magic" | "rare" | "legendary" | "unique";
  const rarityFromValue = (v: number): Rarity => {
    if (v > 80) return "unique";
    if (v > 60) return "legendary";
    if (v > 40) return "rare";
    if (v > 20) return "magic";
    return "common";
  };

  const equipment = [
    { slot: "🪖 Helm", name: level >= 10 ? "Crown of Tokens" : level >= 5 ? "Focus Visor" : "Thinking Cap",
      rarity: rarityFromValue(Math.min(100, level * 8)),
      stat: `+${Math.floor(intelligence / 5)} INT` },
    { slot: "🛡️ Shield", name: cacheHitRate > 0.5 ? "Cache Aegis" : cacheHitRate > 0.2 ? "Memory Ward" : "Basic Guard",
      rarity: rarityFromValue(cacheHitRate * 130),
      stat: `+${Math.floor(vitality / 3)} VIT` },
    { slot: "⚔️ Weapon", name: data.burnRate > 500 ? "Inferno Blade" : data.burnRate > 200 ? "Swift Edge" : data.burnRate > 50 ? "Code Slicer" : "Rusty Dagger",
      rarity: rarityFromValue(Math.min(100, data.burnRate / 5)),
      stat: `+${Math.floor(strength / 4)} STR` },
    { slot: "🧤 Gloves", name: outputRatio > 3 ? "Precision Gauntlets" : outputRatio > 1.5 ? "Coder's Touch" : "Worn Mitts",
      rarity: rarityFromValue(Math.min(100, outputRatio * 25)),
      stat: `+${Math.floor(dexterity / 4)} DEX` },
    { slot: "👢 Boots", name: projectCount >= 4 ? "Dimensional Striders" : projectCount >= 2 ? "Project Runner" : "Leather Boots",
      rarity: rarityFromValue(projectCount * 20),
      stat: `+${Math.floor(projectCount * 15)} SPD` },
    { slot: "💍 Ring", name: data.totalCost >= 10 ? "Ring of Wealth" : data.totalCost >= 1 ? "Gold Band" : "Copper Ring",
      rarity: rarityFromValue(Math.min(100, data.totalCost * 10)),
      stat: `$${data.totalCost.toFixed(2)} spent` },
  ];

  // Monsters slain (messages = kills)
  const monstersSlain = msgs;
  const dungeonFloor = Math.min(100, Math.floor(level / 2) + 1);
  const bossesSlain = data.sessions.length;

  // Kill feed (recent activity from hourly)
  const recentKills = data.hourlyUsage.slice(-3).map(h => {
    const monsterNames = ["Syntax Imp", "Bug Fiend", "Null Wraith", "Merge Demon", "Stack Golem", "Regex Beast", "Deadlock Shade"];
    const name = monsterNames[parseInt(h.hour) % monsterNames.length];
    const count = h.messages;
    return { name, count, hour: h.hour };
  });

  return {
    level, xp, xpNext, xpProgress,
    hp, maxHp, mana, maxMana,
    charClass, strength, dexterity, intelligence, vitality,
    equipment, monstersSlain, dungeonFloor, bossesSlain, recentKills,
  };
}

function CharacterPreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="char-preview">
      <div className="char-preview-title">Choose Your Scouter</div>
      <div className="char-preview-grid">
        <div className="char-card">
          <img src="/char_scouter_512.png" alt="Scouter Warrior" className="char-img" />
          <div className="char-name">Scouter Warrior</div>
          <div className="char-desc">사이버펑크 스카우터</div>
        </div>
        <div className="char-card">
          <img src="/char_diablo_512.png" alt="Dark Knight" className="char-img" />
          <div className="char-name">Dark Knight</div>
          <div className="char-desc">디아블로 다크 워리어</div>
        </div>
      </div>
      <button className="char-back-btn" onClick={onBack}>← Back</button>
    </div>
  );
}

type Tab = "overview" | "models" | "projects" | "history" | "sessions" | "game";

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showCustomLimit, setShowCustomLimit] = useState(false);
  const [customLimitInput, setCustomLimitInput] = useState("");
  const [showCharPreview, setShowCharPreview] = useState(false);

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

  if (showCharPreview) {
    return (
      <div className="app">
        <div className="titlebar" onMouseDown={handleDrag}>
          <div className="titlebar-left">
            <StatusDot status={data.status} />
            <span className="title">Claude Scouter</span>
          </div>
        </div>
        <CharacterPreview onBack={() => setShowCharPreview(false)} />
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
          <button className="icon-btn" onClick={() => setShowCharPreview(true)} title="Character Preview">🎨</button>
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
        {(["overview", "models", "projects", "history", "sessions", "game"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "📊" : t === "models" ? "🤖" : t === "projects" ? "📁" : t === "history" ? "📈" : t === "sessions" ? "💬" : "🎮"}
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

        {tab === "game" && (() => {
          const d = calculateDiablo(data);
          const rarityColor = (r: string) => r === "unique" ? "#c4a000" : r === "legendary" ? "#ff8000" : r === "rare" ? "#ffff00" : r === "magic" ? "#6888ff" : "#888";
          // Determine animation state
          const animState = data.usagePercent >= 90 ? "hurt" : data.burnRate > 100 ? "attacking" : data.burnRate > 0 ? "walking" : "idle";
          return (
            <div className="diablo">
              {/* Pixel dungeon scene */}
              <div className="d-scene">
                <PixelDungeon
                  state={animState}
                  classIcon={d.charClass.icon}
                  floor={d.dungeonFloor}
                  kills={d.monstersSlain}
                  hpPercent={(d.hp / d.maxHp) * 100}
                />
              </div>

              {/* Character header */}
              <div className="d-char">
                <div className="d-char-icon">{d.charClass.icon}</div>
                <div className="d-char-info">
                  <div className="d-char-class">{d.charClass.name}</div>
                  <div className="d-char-level">Level {d.level} · Floor {d.dungeonFloor}</div>
                </div>
                <div className="d-kills">
                  <span className="d-kills-num">💀 {d.monstersSlain}</span>
                  <span className="d-kills-label">kills</span>
                </div>
              </div>

              {/* HP / Mana / XP bars */}
              <div className="d-bars">
                <div className="d-bar-row">
                  <span className="d-bar-label">HP</span>
                  <div className="d-bar hp"><div className="d-bar-fill" style={{ width: `${(d.hp / d.maxHp) * 100}%` }} /></div>
                  <span className="d-bar-val">{d.hp}/{d.maxHp}</span>
                </div>
                <div className="d-bar-row">
                  <span className="d-bar-label">MP</span>
                  <div className="d-bar mp"><div className="d-bar-fill" style={{ width: `${(d.mana / d.maxMana) * 100}%` }} /></div>
                  <span className="d-bar-val">{d.mana}/{d.maxMana}</span>
                </div>
                <div className="d-bar-row">
                  <span className="d-bar-label">XP</span>
                  <div className="d-bar xp"><div className="d-bar-fill" style={{ width: `${Math.min(100, d.xpProgress)}%` }} /></div>
                  <span className="d-bar-val">{d.xp}/{d.xpNext}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="d-stats">
                <div className="d-stat"><span className="d-stat-icon">⚔️</span><span className="d-stat-name">STR</span><span className="d-stat-val">{d.strength}</span></div>
                <div className="d-stat"><span className="d-stat-icon">🏹</span><span className="d-stat-name">DEX</span><span className="d-stat-val">{d.dexterity}</span></div>
                <div className="d-stat"><span className="d-stat-icon">🔮</span><span className="d-stat-name">INT</span><span className="d-stat-val">{d.intelligence}</span></div>
                <div className="d-stat"><span className="d-stat-icon">❤️</span><span className="d-stat-name">VIT</span><span className="d-stat-val">{d.vitality}</span></div>
              </div>

              {/* Equipment */}
              <div className="d-equip">
                <div className="d-section-title">Equipment</div>
                {d.equipment.map((e) => (
                  <div key={e.slot} className="d-equip-item" style={{ borderLeftColor: rarityColor(e.rarity) }}>
                    <span className="d-equip-slot">{e.slot}</span>
                    <span className="d-equip-name" style={{ color: rarityColor(e.rarity) }}>{e.name}</span>
                    <span className="d-equip-stat">{e.stat}</span>
                  </div>
                ))}
              </div>

              {/* Kill feed */}
              {d.recentKills.length > 0 && (
                <div className="d-killfeed">
                  <div className="d-section-title">Recent Encounters</div>
                  {d.recentKills.map((k, i) => (
                    <div key={i} className="d-kill-entry">
                      <span className="d-kill-icon">⚔️</span>
                      <span className="d-kill-text">Slain {k.count}x <strong>{k.name}</strong></span>
                      <span className="d-kill-time">{k.hour}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
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
