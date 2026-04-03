import { useEffect, useState, useRef, useCallback } from "react";
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

const KIND_ICONS: Record<string, string> = {
  project: "📁",
  agent: "🤖",
  rule: "📜",
  skill: "⚡",
  command: "⌨️",
  hook: "🪝",
  plugin: "🔌",
};

interface ProjectGroup {
  project: ArchNode;
  agents: ArchNode[];
  rules: ArchNode[];
  skills: ArchNode[];
  commands: ArchNode[];
  // agent→rule connections
  agentRuleEdges: ArchEdge[];
}

function groupByProject(data: ArchitectureData): {
  projects: ProjectGroup[];
  globalHooks: ArchNode[];
  globalPlugins: ArchNode[];
  globalCommands: ArchNode[];
  globalSkills: ArchNode[];
} {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const projectNodes = data.nodes.filter((n) => n.kind === "project");
  const projects: ProjectGroup[] = [];

  for (const proj of projectNodes) {
    const prefix = proj.id + ":";
    const children = data.nodes.filter((n) => n.id.startsWith(prefix));
    const agentRuleEdges = data.edges.filter(
      (e) =>
        e.from.startsWith(prefix) &&
        e.from.includes(":agent:") &&
        e.to.includes(":rule:") &&
        e.label === "follows"
    );

    projects.push({
      project: proj,
      agents: children.filter((n) => n.kind === "agent"),
      rules: children.filter((n) => n.kind === "rule"),
      skills: children.filter((n) => n.kind === "skill"),
      commands: children.filter((n) => n.kind === "command"),
      agentRuleEdges,
    });
  }

  // Sort projects by name
  projects.sort((a, b) => a.project.label.localeCompare(b.project.label));

  const globalHooks = data.nodes.filter((n) => n.id.startsWith("global:hook:"));
  const globalPlugins = data.nodes.filter((n) => n.id.startsWith("global:plugin:"));
  const globalCommands = data.nodes.filter(
    (n) => n.id.startsWith("global:commands") || (n.kind === "command" && n.id.startsWith("global:"))
  );
  const globalSkills = data.nodes.filter((n) => n.id.startsWith("global:skill:"));

  return { projects, globalHooks, globalPlugins, globalCommands, globalSkills };
}

function NodeChip({
  node,
  onHover,
  onLeave,
  hovered,
}: {
  node: ArchNode;
  onHover: (n: ArchNode) => void;
  onLeave: () => void;
  hovered: boolean;
}) {
  const color = KIND_COLORS[node.kind] || "#666";
  const icon = KIND_ICONS[node.kind] || "●";
  return (
    <div
      className={`arch-chip ${hovered ? "hovered" : ""}`}
      style={{
        borderColor: hovered ? color : color + "44",
        background: hovered ? color + "22" : color + "0a",
      }}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={onLeave}
    >
      <span className="arch-chip-icon">{icon}</span>
      <span className="arch-chip-label">{node.label}</span>
    </div>
  );
}

function NodeColumn({
  title,
  icon,
  nodes,
  color,
  onHover,
  onLeave,
  hoveredId,
  highlightIds,
}: {
  title: string;
  icon: string;
  nodes: ArchNode[];
  color: string;
  onHover: (n: ArchNode) => void;
  onLeave: () => void;
  hoveredId: string | null;
  highlightIds?: Set<string>;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="arch-column">
      <div className="arch-column-header" style={{ color }}>
        {icon} {title}
        <span className="arch-column-count">{nodes.length}</span>
      </div>
      <div className="arch-column-items">
        {nodes.map((n) => (
          <NodeChip
            key={n.id}
            node={n}
            onHover={onHover}
            onLeave={onLeave}
            hovered={n.id === hoveredId || (highlightIds?.has(n.id) ?? false)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ArchitectureView({ onModeChange }: Props) {
  const [archData, setArchData] = useState<ArchitectureData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ArchNode | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    invoke<ArchitectureData>("get_architecture")
      .then(setArchData)
      .catch((err) => {
        console.error("get_architecture failed:", err);
        setArchData({ nodes: [], edges: [] });
      });
  }, []);

  const handleHover = useCallback(
    (node: ArchNode) => {
      setHoveredNode(node);
      if (!archData) return;
      // Highlight connected nodes
      const connected = new Set<string>();
      for (const edge of archData.edges) {
        if (edge.from === node.id) connected.add(edge.to);
        if (edge.to === node.id) connected.add(edge.from);
      }
      setHighlightIds(connected);
    },
    [archData]
  );

  const handleLeave = useCallback(() => {
    setHoveredNode(null);
    setHighlightIds(new Set());
  }, []);

  const toggleCollapse = (projId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projId)) next.delete(projId);
      else next.add(projId);
      return next;
    });
  };

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    await invoke("start_drag");
  }, []);

  if (!archData) {
    return (
      <div className="arch-view">
        <div className="arch-titlebar">
          <div className="arch-titlebar-left">
            <span className="arch-title">🔗 Architecture</span>
          </div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>
              ← Dashboard
            </button>
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
          <div className="arch-titlebar-left">
            <span className="arch-title">🔗 Architecture</span>
          </div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>
              ← Dashboard
            </button>
          </div>
        </div>
        <div className="arch-loading">
          No projects with .claude/ found
        </div>
      </div>
    );
  }

  const { projects, globalHooks, globalPlugins, globalCommands, globalSkills } =
    groupByProject(archData);

  return (
    <div className="arch-view">
      {/* Titlebar */}
      <div className="arch-titlebar" onMouseDown={handleDrag}>
        <div className="arch-titlebar-left">
          <span className="arch-title">🔗 Architecture</span>
          <span className="arch-subtitle">
            {projects.length} projects · {archData.nodes.length} nodes
          </span>
        </div>
        <div className="arch-titlebar-right">
          <button
            className="arch-btn"
            onClick={() => {
              if (collapsedProjects.size > 0) {
                setCollapsedProjects(new Set());
              } else {
                setCollapsedProjects(new Set(projects.map((p) => p.project.id)));
              }
            }}
          >
            {collapsedProjects.size > 0 ? "📂 Expand All" : "📁 Collapse All"}
          </button>
          <button className="arch-btn" onClick={() => onModeChange("full")}>
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="arch-content">
        {/* Global section */}
        {(globalHooks.length > 0 || globalPlugins.length > 0 || globalCommands.length > 0 || globalSkills.length > 0) && (
          <div className="arch-global-section">
            <div className="arch-section-title">🌐 Global (all projects)</div>
            <div className="arch-row">
              <NodeColumn
                title="Hooks"
                icon="🪝"
                nodes={globalHooks}
                color={KIND_COLORS.hook}
                onHover={handleHover}
                onLeave={handleLeave}
                hoveredId={hoveredNode?.id ?? null}
                highlightIds={highlightIds}
              />
              <NodeColumn
                title="Plugins"
                icon="🔌"
                nodes={globalPlugins}
                color={KIND_COLORS.plugin}
                onHover={handleHover}
                onLeave={handleLeave}
                hoveredId={hoveredNode?.id ?? null}
                highlightIds={highlightIds}
              />
              <NodeColumn
                title="Skills"
                icon="⚡"
                nodes={globalSkills}
                color={KIND_COLORS.skill}
                onHover={handleHover}
                onLeave={handleLeave}
                hoveredId={hoveredNode?.id ?? null}
                highlightIds={highlightIds}
              />
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.map((pg) => {
          const collapsed = collapsedProjects.has(pg.project.id);
          const total =
            pg.agents.length +
            pg.rules.length +
            pg.skills.length +
            pg.commands.length;

          return (
            <div key={pg.project.id} className="arch-project-section">
              <div
                className="arch-project-header"
                onClick={() => toggleCollapse(pg.project.id)}
              >
                <span className="arch-project-toggle">
                  {collapsed ? "▶" : "▼"}
                </span>
                <span className="arch-project-icon">📁</span>
                <span className="arch-project-name">{pg.project.label}</span>
                <span className="arch-project-meta">
                  {pg.agents.length > 0 && (
                    <span className="arch-meta-badge" style={{ color: KIND_COLORS.agent }}>
                      🤖{pg.agents.length}
                    </span>
                  )}
                  {pg.rules.length > 0 && (
                    <span className="arch-meta-badge" style={{ color: KIND_COLORS.rule }}>
                      📜{pg.rules.length}
                    </span>
                  )}
                  {pg.skills.length > 0 && (
                    <span className="arch-meta-badge" style={{ color: KIND_COLORS.skill }}>
                      ⚡{pg.skills.length}
                    </span>
                  )}
                  {pg.commands.length > 0 && (
                    <span className="arch-meta-badge" style={{ color: KIND_COLORS.command }}>
                      ⌨️{pg.commands.length}
                    </span>
                  )}
                  {total === 0 && (
                    <span className="arch-meta-badge" style={{ color: "#555" }}>
                      empty
                    </span>
                  )}
                </span>
                {pg.project.details.path && (
                  <span className="arch-project-path">
                    {pg.project.details.path}
                  </span>
                )}
              </div>

              {!collapsed && total > 0 && (
                <div className="arch-row">
                  <NodeColumn
                    title="Agents"
                    icon="🤖"
                    nodes={pg.agents}
                    color={KIND_COLORS.agent}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    hoveredId={hoveredNode?.id ?? null}
                    highlightIds={highlightIds}
                  />

                  {/* Arrow */}
                  {pg.agents.length > 0 && pg.rules.length > 0 && (
                    <div className="arch-arrow">
                      <span>→</span>
                      {pg.agentRuleEdges.length > 0 && (
                        <span className="arch-arrow-label">follows</span>
                      )}
                    </div>
                  )}

                  <NodeColumn
                    title="Rules"
                    icon="📜"
                    nodes={pg.rules}
                    color={KIND_COLORS.rule}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    hoveredId={hoveredNode?.id ?? null}
                    highlightIds={highlightIds}
                  />

                  <NodeColumn
                    title="Skills"
                    icon="⚡"
                    nodes={pg.skills}
                    color={KIND_COLORS.skill}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    hoveredId={hoveredNode?.id ?? null}
                    highlightIds={highlightIds}
                  />

                  <NodeColumn
                    title="Commands"
                    icon="⌨️"
                    nodes={pg.commands}
                    color={KIND_COLORS.command}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    hoveredId={hoveredNode?.id ?? null}
                    highlightIds={highlightIds}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="arch-tooltip-fixed">
          <div className="arch-tooltip-title">
            {KIND_ICONS[hoveredNode.kind]} {hoveredNode.label}
          </div>
          <div className="arch-tooltip-kind">
            {hoveredNode.kind}
          </div>
          {Object.keys(hoveredNode.details).length > 0 && (
            <div className="arch-tooltip-detail">
              {Object.entries(hoveredNode.details).map(([k, v]) => (
                <div key={k}>
                  <span className="arch-detail-key">{k}:</span> {v}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
