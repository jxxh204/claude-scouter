import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ViewMode, ArchitectureData, ArchNode, ArchEdge } from "../types";
import "./ArchitectureView.css";

interface Props {
  onModeChange: (mode: ViewMode) => void;
}

interface LayoutNode extends ArchNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const KIND_COLORS: Record<string, string> = {
  agent: "#8b5cf6",
  plugin: "#3b82f6",
  hook: "#f59e0b",
  command: "#22c55e",
  skill: "#ec4899",
  project: "#06b6d4",
  permission: "#ef4444",
};

const KIND_ICONS: Record<string, string> = {
  agent: "🤖",
  plugin: "🔌",
  hook: "🪝",
  command: "⌨️",
  skill: "⚡",
  project: "📁",
  permission: "🔐",
};

const ALL_KINDS = ["agent", "plugin", "hook", "command", "skill", "project", "permission"];

function forceLayout(
  nodes: LayoutNode[],
  edges: ArchEdge[],
  width: number,
  height: number,
  iterations: number = 120
) {
  // Initialize positions in a circle
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    n.x = cx + r * Math.cos(angle) + (Math.random() - 0.5) * 40;
    n.y = cy + r * Math.sin(angle) + (Math.random() - 0.5) * 40;
    n.vx = 0;
    n.vy = 0;
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const repulsion = 8000 * alpha;
    const attraction = 0.005 * alpha;
    const damping = 0.85;

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = 180;
      const force = (dist - idealLen) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.001 * alpha;
      n.vy += (cy - n.y) * 0.001 * alpha;
    }

    // Apply velocity
    const pad = 60;
    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: LayoutNode[],
  edges: ArchEdge[],
  width: number,
  height: number,
  hoveredId: string | null,
  visibleKinds: Set<string>,
  dpr: number
) {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Grid background
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visibleNodes = new Set(nodes.filter((n) => visibleKinds.has(n.kind)).map((n) => n.id));

  // Draw edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    if (!visibleNodes.has(a.id) || !visibleNodes.has(b.id)) continue;

    const isHighlight =
      hoveredId && (edge.from === hoveredId || edge.to === hoveredId);
    const isDisabled = edge.label === "disabled";

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = isHighlight
      ? "rgba(139,92,246,0.7)"
      : isDisabled
      ? "rgba(255,255,255,0.06)"
      : "rgba(255,255,255,0.12)";
    ctx.lineWidth = isHighlight ? 2 : 1;
    if (isDisabled) {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge label (only on hover)
    if (isHighlight && edge.label) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(139,92,246,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, mx, my - 4);
    }
  }

  // Draw nodes
  for (const node of nodes) {
    if (!visibleNodes.has(node.id)) continue;

    const isHovered = node.id === hoveredId;
    const color = KIND_COLORS[node.kind] || "#666";
    const r = node.radius;

    // Glow
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(
        node.x,
        node.y,
        r,
        node.x,
        node.y,
        r + 8
      );
      glow.addColorStop(0, color + "40");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = node.enabled
      ? color + (isHovered ? "dd" : "88")
      : "rgba(50,50,50,0.6)";
    ctx.fill();
    ctx.strokeStyle = node.enabled
      ? color + (isHovered ? "ff" : "66")
      : "rgba(80,80,80,0.4)";
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.stroke();

    // Icon
    const icon = KIND_ICONS[node.kind] || "●";
    ctx.font = `${r * 0.9}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, node.x, node.y);

    // Label
    ctx.font = `${isHovered ? 11 : 10}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = node.enabled
      ? isHovered
        ? "#fff"
        : "#ccc"
      : "#555";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      node.label.length > 18
        ? node.label.slice(0, 16) + "…"
        : node.label,
      node.x,
      node.y + r + 6
    );
  }

  ctx.restore();
}

export default function ArchitectureView({ onModeChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [archData, setArchData] = useState<ArchitectureData | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visibleKinds, setVisibleKinds] = useState<Set<string>>(
    new Set(ALL_KINDS)
  );
  const dragRef = useRef<{
    node: LayoutNode;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Load data
  useEffect(() => {
    invoke<ArchitectureData>("get_architecture")
      .then(setArchData)
      .catch((err) => {
        console.error("get_architecture failed:", err);
        // Show empty state instead of stuck loading
        setArchData({ nodes: [], edges: [] });
      });
  }, []);

  // Layout
  useEffect(() => {
    if (!archData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const nodes: LayoutNode[] = archData.nodes.map((n) => ({
      ...n,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: n.kind === "agent" ? 28 : n.kind === "project" ? 18 : 16,
    }));

    forceLayout(nodes, archData.edges, w, h);
    setLayoutNodes(nodes);
  }, [archData]);

  // Draw
  useEffect(() => {
    if (!canvasRef.current || layoutNodes.length === 0 || !archData) return;
    const canvas = canvasRef.current;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const ctx = canvas.getContext("2d")!;
    drawGraph(
      ctx,
      layoutNodes,
      archData.edges,
      rect.width,
      rect.height,
      hoveredNode?.id || null,
      visibleKinds,
      dpr
    );
  }, [layoutNodes, hoveredNode, archData, visibleKinds]);

  const findNodeAt = useCallback(
    (x: number, y: number): LayoutNode | null => {
      for (let i = layoutNodes.length - 1; i >= 0; i--) {
        const n = layoutNodes[i];
        if (!visibleKinds.has(n.kind)) continue;
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) return n;
      }
      return null;
    },
    [layoutNodes, visibleKinds]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x: e.clientX, y: e.clientY });

      if (dragRef.current) {
        dragRef.current.node.x = x + dragRef.current.offsetX;
        dragRef.current.node.y = y + dragRef.current.offsetY;
        setLayoutNodes([...layoutNodes]);
        return;
      }

      setHoveredNode(findNodeAt(x, y));
    },
    [layoutNodes, findNodeAt]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = findNodeAt(x, y);
      if (node) {
        dragRef.current = {
          node,
          offsetX: node.x - x,
          offsetY: node.y - y,
        };
      }
    },
    [findNodeAt]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const toggleKind = (kind: string) => {
    const next = new Set(visibleKinds);
    if (next.has(kind)) {
      next.delete(kind);
    } else {
      next.add(kind);
    }
    setVisibleKinds(next);
  };

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, select")) return;
    e.preventDefault();
    await invoke("start_drag");
  }, []);

  if (!archData) {
    return (
      <div className="arch-view">
        <div className="arch-titlebar">
          <div className="arch-titlebar-left">
            <span className="arch-title">🔗 Architecture</span>
            <span className="arch-subtitle">Loading...</span>
          </div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>← Dashboard</button>
          </div>
        </div>
        <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 14 }}>
          Loading architecture data...
        </div>
      </div>
    );
  }

  if (archData.nodes.length === 0) {
    return (
      <div className="arch-view">
        <div className="arch-titlebar">
          <div className="arch-titlebar-left">
            <span className="arch-title">🔗 Architecture</span>
            <span className="arch-subtitle">No data</span>
          </div>
          <div className="arch-titlebar-right">
            <button className="arch-btn" onClick={() => onModeChange("full")}>← Dashboard</button>
          </div>
        </div>
        <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 14 }}>
          Claude Code config not found at ~/.claude/settings.json
        </div>
      </div>
    );
  }

  const visibleNodeCount = archData.nodes.filter((n) =>
    visibleKinds.has(n.kind)
  ).length;
  const enabledCount = archData.nodes.filter((n) => n.enabled).length;

  return (
    <div className="arch-view">
      <div className="arch-titlebar" onMouseDown={handleDrag}>
        <div className="arch-titlebar-left">
          <span className="arch-title">🔗 Architecture</span>
          <span className="arch-subtitle">
            {visibleNodeCount} nodes · {archData.edges.length} edges
          </span>
        </div>
        <div className="arch-titlebar-right">
          <button
            className="arch-btn"
            onClick={() => {
              // Re-layout
              if (!canvasRef.current) return;
              const rect =
                canvasRef.current.parentElement!.getBoundingClientRect();
              const nodes: LayoutNode[] = archData.nodes.map((n) => ({
                ...n,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radius: n.kind === "agent" ? 28 : n.kind === "project" ? 18 : 16,
              }));
              forceLayout(nodes, archData.edges, rect.width, rect.height);
              setLayoutNodes(nodes);
            }}
          >
            🔄 Re-layout
          </button>
          <button className="arch-btn" onClick={() => onModeChange("full")}>
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="arch-filters">
        {ALL_KINDS.map((kind) => (
          <button
            key={kind}
            className={`arch-filter-btn ${
              visibleKinds.has(kind) ? "active" : ""
            }`}
            onClick={() => toggleKind(kind)}
            style={
              visibleKinds.has(kind)
                ? {
                    borderColor: KIND_COLORS[kind] + "66",
                    color: KIND_COLORS[kind],
                  }
                : {}
            }
          >
            {KIND_ICONS[kind]} {kind}
          </button>
        ))}
      </div>

      <div className="arch-canvas-wrap">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredNode(null);
            dragRef.current = null;
          }}
          style={{ cursor: hoveredNode ? "grab" : "default" }}
        />

        <div className="arch-stats">
          {enabledCount}/{archData.nodes.length} enabled
        </div>

        <div className="arch-legend">
          {ALL_KINDS.map((kind) => (
            <div key={kind} className="arch-legend-item">
              <div
                className="arch-legend-dot"
                style={{ background: KIND_COLORS[kind] }}
              />
              <span>{kind}</span>
            </div>
          ))}
        </div>

        {hoveredNode && (
          <div
            className="arch-tooltip"
            style={{
              left: mousePos.x + 16,
              top: mousePos.y - 10,
              position: "fixed",
            }}
          >
            <div className="arch-tooltip-title">
              {KIND_ICONS[hoveredNode.kind]} {hoveredNode.label}
            </div>
            <div className="arch-tooltip-kind">
              {hoveredNode.kind} ·{" "}
              {hoveredNode.enabled ? "✅ enabled" : "⭕ disabled"}
            </div>
            {Object.keys(hoveredNode.details).length > 0 && (
              <div className="arch-tooltip-detail">
                {Object.entries(hoveredNode.details).map(([k, v]) => (
                  <span key={k}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
