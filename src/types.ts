export interface UsageData {
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
  recentActivities: RecentActivity[];
  activeProject: string | null;
  lastUpdated: string;
  status: string;
}

export interface SessionInfo {
  id: string;
  tokens: number;
  cost: number;
  messages: number;
  started: string;
  lastActive: string;
  status: string;
  model: string;
  project: string;
  recentTools: string[];
}

export interface RecentActivity {
  timestamp: string;
  tool: string;
  summary: string;
  sessionId: string;
  project: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  tokens: number;
  messages: number;
  cost: number;
}

export interface HourlyPoint {
  hour: string;
  tokens: number;
  messages: number;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  messages: number;
}

export interface DailyPoint {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
}

export type ViewMode = "mini" | "full" | "arch";

export interface ArchNode {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
  details: Record<string, string>;
}

export interface ArchEdge {
  from: string;
  to: string;
  label: string;
}

export interface ArchitectureData {
  nodes: ArchNode[];
  edges: ArchEdge[];
}
