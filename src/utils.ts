export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatCost(n: number): string {
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

export function formatTime(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return Math.round(min) + "m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

export function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📖", Edit: "✏️", Write: "📝", Bash: "💻", execute: "💻",
  Search: "🔍", Grep: "🔍", Glob: "📂", LS: "📂", Agent: "🤖",
};

export function toolIcon(name: string): string {
  return TOOL_ICONS[name] || "🔧";
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    ok: "#22c55e", warning: "#f59e0b", critical: "#ef4444",
    active: "#22c55e", idle: "#f59e0b", offline: "#666",
  };
  return colors[status] || "#666";
}

export function usageColor(status: string): string {
  return status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#8b5cf6";
}
