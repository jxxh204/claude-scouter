import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ViewMode, ArchitectureData, ArchNode, ArchEdge } from "../types";
import "./ArchitectureView.css";

interface Props {
  onModeChange: (mode: ViewMode) => void;
}

const KIND_COLORS: Record<string, string> = {
  project: "#8b5cf6",
  agent: "#ec4899",
  rule: "#f59e0b",
  skill: "#22c55e",
  command: "#3b82f6",
  hook: "#ef4444",
  plugin: "#06b6d4",
};

interface ProjectGroup {
  project: ArchNode;
  agents: ArchNode[];
  rules: ArchNode[];
  skills: ArchNode[];
  commands: ArchNode[];
  agentRuleEdges: ArchEdge[];
}

function groupByProject(data: ArchitectureData): {
  projects: ProjectGroup[];
  globalHooks: ArchNode[];
  globalPlugins: ArchNode[];
  globalSkills: ArchNode[];
} {
  const projectNodes = data.nodes.filter((n) => n.kind === "project");
  const projects: ProjectGroup[] = [];

  for (const proj of projectNodes) {
    const prefix = proj.id + ":";
    const children = data.nodes.filter((n) => n.id.startsWith(prefix));
    const agentRuleEdges = data.edges.filter(
      (e) => e.from.includes(":agent:") && e.to.includes(":rule:") && e.label === "follows"
    );
    const total = children.length;
    if (total === 0) continue;

    projects.push({
      project: proj,
      agents: children.filter((n) => n.kind === "agent"),
      rules: children.filter((n) => n.kind === "rule"),
      skills: children.filter((n) => n.kind === "skill"),
      commands: children.filter((n) => n.kind === "command"),
      agentRuleEdges,
    });
  }

  projects.sort((a, b) => a.project.label.localeCompare(b.project.label));

  return {
    projects,
    globalHooks: data.nodes.filter((n) => n.id.startsWith("global:hook:")),
    globalPlugins: data.nodes.filter((n) => n.id.startsWith("global:plugin:")),
    globalSkills: data.nodes.filter((n) => n.id.startsWith("global:skill:")),
  };
}

// Get connected rule names for an agent
function getAgentRules(agent: ArchNode, rules: ArchNode[], edges: ArchEdge[]): ArchNode[] {
  const ruleIds = edges
    .filter((e) => e.from === agent.id && e.label === "follows")
    .map((e) => e.to);
  return rules.filter((r) => ruleIds.includes(r.id));
}

function FlowArrow({ label }: { label?: string }) {
  return (
    <div className="flow-arrow">
      <div className="flow-arrow-line" />
      <div className="flow-arrow-head">▼</div>
      {label && <span className="flow-arrow-label">{label}</span>}
    </div>
  );
}

function HookRow({ hooks, phase }: { hooks: ArchNode[]; phase: string }) {
  const phaseHooks: Record<string, string[]> = {
    start: ["SessionStart"],
    pre: ["PreToolUse"],
    post: ["PostToolUse"],
    end: ["Stop", "SubagentStop", "Notification", "TeammateIdle"],
    all: hooks.map((h) => h.label),
  };
  const relevant = hooks.filter((h) => (phaseHooks[phase] || []).includes(h.label));
  if (relevant.length === 0) return null;

  return (
    <div className="flow-hook-row">
      {relevant.map((h) => (
        <span key={h.id} className="flow-hook-chip">
          🪝 {h.label}
          {h.details.handlers && <span className="flow-hook-count">×{h.details.handlers}</span>}
        </span>
      ))}
    </div>
  );
}

function AgentCard({ agent, rules, edges }: { agent: ArchNode; rules: ArchNode[]; edges: ArchEdge[] }) {
  const connectedRules = getAgentRules(agent, rules, edges);
  const tools = agent.details.tools?.split(",").map((t) => t.trim()) || [];
  const model = agent.details.model || "";
  const desc = agent.details.description || agent.details.role || "";

  return (
    <div className="flow-agent-card">
      <div className="flow-agent-header">
        <span className="flow-agent-icon">🤖</span>
        <span className="flow-agent-name">{agent.label}</span>
        {model && <span className="flow-agent-model">{model}</span>}
      </div>
      {desc && <div className="flow-agent-desc">{desc}</div>}
      {tools.length > 0 && (
        <div className="flow-agent-tools">
          {tools.map((t, i) => (
            <span key={i} className="flow-tool-chip">🔧 {t}</span>
          ))}
        </div>
      )}
      {connectedRules.length > 0 && (
        <div className="flow-agent-rules">
          <span className="flow-rules-label">📜 follows:</span>
          {connectedRules.map((r) => (
            <span key={r.id} className="flow-rule-chip">{r.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectFlow({
  pg,
  globalHooks,
  allEdges,
}: {
  pg: ProjectGroup;
  globalHooks: ArchNode[];
  allEdges: ArchEdge[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasAgentTeam = pg.agents.length > 1;

  return (
    <div className="flow-project">
      <div className="flow-project-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="flow-toggle">{collapsed ? "▶" : "▼"}</span>
        <span className="flow-project-icon">📁</span>
        <span className="flow-project-name">{pg.project.label}</span>
        <span className="flow-project-badges">
          {pg.agents.length > 0 && <span style={{ color: KIND_COLORS.agent }}>🤖{pg.agents.length}</span>}
          {pg.rules.length > 0 && <span style={{ color: KIND_COLORS.rule }}>📜{pg.rules.length}</span>}
          {pg.skills.length > 0 && <span style={{ color: KIND_COLORS.skill }}>⚡{pg.skills.length}</span>}
          {pg.commands.length > 0 && <span style={{ color: KIND_COLORS.command }}>⌨️{pg.commands.length}</span>}
        </span>
      </div>

      {!collapsed && (
        <div className="flow-pipeline">
          {/* Step 1: User Input */}
          <div className="flow-step">
            <div className="flow-step-box input">
              👤 User Input
              {pg.commands.length > 0 && (
                <div className="flow-commands-inline">
                  {pg.commands.map((c) => (
                    <span key={c.id} className="flow-cmd-chip">/{c.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <FlowArrow />

          {/* Step 2: SessionStart hook */}
          <HookRow hooks={globalHooks} phase="start" />
          {globalHooks.some((h) => h.label === "SessionStart") && <FlowArrow />}

          {/* Step 3: Agent(s) */}
          <div className="flow-step">
            {hasAgentTeam ? (
              <div className="flow-agent-team">
                <div className="flow-team-label">🤖 Agent Team (tmux)</div>
                <div className="flow-team-grid">
                  {pg.agents.map((a) => (
                    <AgentCard key={a.id} agent={a} rules={pg.rules} edges={allEdges} />
                  ))}
                </div>
              </div>
            ) : pg.agents.length === 1 ? (
              <AgentCard agent={pg.agents[0]} rules={pg.rules} edges={allEdges} />
            ) : (
              <div className="flow-step-box agent">
                🤖 Claude (default agent)
                {pg.rules.length > 0 && (
                  <div className="flow-agent-rules">
                    <span className="flow-rules-label">📜 rules:</span>
                    {pg.rules.map((r) => (
                      <span key={r.id} className="flow-rule-chip">{r.label}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <FlowArrow />

          {/* Step 4: Execution loop */}
          <div className="flow-step">
            <div className="flow-execution-loop">
              <div className="flow-loop-label">🔄 Execution Loop</div>
              <div className="flow-loop-steps">
                <HookRow hooks={globalHooks} phase="pre" />
                <div className="flow-loop-center">
                  <span>🔧 Tool Execution</span>
                  {pg.skills.length > 0 && (
                    <div className="flow-skills-inline">
                      {pg.skills.map((s) => (
                        <span key={s.id} className="flow-skill-chip">⚡ {s.label}</span>
                      ))}
                    </div>
                  )}
                </div>
                <HookRow hooks={globalHooks} phase="post" />
              </div>
            </div>
          </div>

          <FlowArrow />

          {/* Step 5: Output + end hooks */}
          <div className="flow-step">
            <div className="flow-step-box output">
              ✅ Response
            </div>
          </div>

          <HookRow hooks={globalHooks} phase="end" />
        </div>
      )}
    </div>
  );
}

export default function ArchitectureView({ onModeChange }: Props) {
  const [archData, setArchData] = useState<ArchitectureData | null>(null);

  useEffect(() => {
    invoke<ArchitectureData>("get_architecture")
      .then(setArchData)
      .catch((err) => {
        console.error("get_architecture failed:", err);
        setArchData({ nodes: [], edges: [] });
      });
  }, []);

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    await invoke("start_drag");
  }, []);

  if (!archData) {
    return (
      <div className="arch-view">
        <div className="arch-titlebar">
          <div className="arch-titlebar-left"><span className="arch-title">🔗 Architecture</span></div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>← Dashboard</button>
          </div>
        </div>
        <div className="arch-loading">Loading...</div>
      </div>
    );
  }

  if (archData.nodes.length === 0) {
    return (
      <div className="arch-view">
        <div className="arch-titlebar">
          <div className="arch-titlebar-left"><span className="arch-title">🔗 Architecture</span></div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>← Dashboard</button>
          </div>
        </div>
        <div className="arch-loading">No projects with .claude/ found</div>
      </div>
    );
  }

  const { projects, globalHooks, globalPlugins, globalSkills } = groupByProject(archData);

  return (
    <div className="arch-view">
      <div className="arch-titlebar" onMouseDown={handleDrag}>
        <div className="arch-titlebar-left">
          <span className="arch-title">🔗 Architecture</span>
          <span className="arch-subtitle">{projects.length} projects</span>
        </div>
        <div className="arch-titlebar-right">
          <button className="arch-btn" onClick={() => onModeChange("full")}>← Dashboard</button>
        </div>
      </div>

      <div className="arch-content">
        {/* Global overview */}
        {(globalPlugins.length > 0 || globalSkills.length > 0) && (
          <div className="flow-global">
            <div className="flow-global-title">🌐 Global Components</div>
            <div className="flow-global-row">
              {globalPlugins.length > 0 && (
                <div className="flow-global-group">
                  <span className="flow-global-label">🔌 Plugins</span>
                  {globalPlugins.map((p) => (
                    <span key={p.id} className="flow-plugin-chip">{p.label}</span>
                  ))}
                </div>
              )}
              {globalSkills.length > 0 && (
                <div className="flow-global-group">
                  <span className="flow-global-label">⚡ Skills</span>
                  {globalSkills.map((s) => (
                    <span key={s.id} className="flow-skill-chip">{s.label}</span>
                  ))}
                </div>
              )}
              {globalHooks.length > 0 && (
                <div className="flow-global-group">
                  <span className="flow-global-label">🪝 Hooks ({globalHooks.length})</span>
                  {globalHooks.map((h) => (
                    <span key={h.id} className="flow-hook-chip">
                      {h.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Project flows */}
        {projects.map((pg) => (
          <ProjectFlow
            key={pg.project.id}
            pg={pg}
            globalHooks={globalHooks}
            allEdges={archData.edges}
          />
        ))}
      </div>
    </div>
  );
}
