use chrono::{DateTime, Utc};
use glob::glob;
use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

// Plan limits (tokens per 5-hour window)
const PLAN_PRO: u64 = 44_000;
const PLAN_MAX5: u64 = 88_000;
const PLAN_MAX20: u64 = 220_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub plan: String,
    pub limit: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub message_count: u64,
    pub session_start: Option<String>,
    pub burn_rate: f64,        // tokens per minute
    pub estimated_remaining_min: f64,
    pub usage_percent: f64,
    pub sessions: Vec<SessionInfo>,
    pub last_updated: String,
    pub status: String, // "ok", "warning", "critical"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub tokens: u64,
    pub cost: f64,
    pub messages: u64,
    pub started: String,
}

impl Default for UsageData {
    fn default() -> Self {
        Self {
            plan: "max5".into(),
            limit: PLAN_MAX5,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
            total_tokens: 0,
            total_cost: 0.0,
            message_count: 0,
            session_start: None,
            burn_rate: 0.0,
            estimated_remaining_min: 0.0,
            usage_percent: 0.0,
            sessions: vec![],
            last_updated: Utc::now().to_rfc3339(),
            status: "ok".into(),
        }
    }
}

impl UsageData {
    pub fn update_limit(&mut self) {
        self.limit = match self.plan.as_str() {
            "pro" => PLAN_PRO,
            "max5" => PLAN_MAX5,
            "max20" => PLAN_MAX20,
            _ => PLAN_MAX5,
        };
        self.recalculate();
    }

    fn recalculate(&mut self) {
        self.total_tokens = self.input_tokens + self.output_tokens;
        self.usage_percent = if self.limit > 0 {
            (self.total_tokens as f64 / self.limit as f64) * 100.0
        } else {
            0.0
        };
        self.status = if self.usage_percent >= 90.0 {
            "critical".into()
        } else if self.usage_percent >= 70.0 {
            "warning".into()
        } else {
            "ok".into()
        };
    }
}

// Pricing per million tokens (Claude 3.5/4 Sonnet pricing)
const INPUT_PRICE: f64 = 3.0;
const OUTPUT_PRICE: f64 = 15.0;
const CACHE_READ_PRICE: f64 = 0.30;
const CACHE_CREATION_PRICE: f64 = 3.75;

fn calculate_cost(input: u64, output: u64, cache_read: u64, cache_creation: u64) -> f64 {
    (input as f64 * INPUT_PRICE
        + output as f64 * OUTPUT_PRICE
        + cache_read as f64 * CACHE_READ_PRICE
        + cache_creation as f64 * CACHE_CREATION_PRICE)
        / 1_000_000.0
}

fn get_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct LogEntry {
    #[serde(rename = "type")]
    entry_type: Option<String>,
    message: Option<LogMessage>,
    timestamp: Option<String>,
    #[serde(rename = "costUSD")]
    cost_usd: Option<f64>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct LogMessage {
    role: Option<String>,
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
struct TokenUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
}

fn scan_usage(data: &mut UsageData) {
    let claude_dir = match get_claude_dir() {
        Some(d) => d,
        None => return,
    };

    // Reset counters
    data.input_tokens = 0;
    data.output_tokens = 0;
    data.cache_read_tokens = 0;
    data.cache_creation_tokens = 0;
    data.total_cost = 0.0;
    data.message_count = 0;
    data.sessions.clear();

    let mut session_map: HashMap<String, SessionInfo> = HashMap::new();
    let mut first_timestamp: Option<DateTime<Utc>> = None;
    let mut timestamps: Vec<(DateTime<Utc>, u64)> = vec![];

    // Scan JSONL files in ~/.claude/projects/
    let pattern = claude_dir.join("projects").join("**").join("*.jsonl");
    let pattern_str = pattern.to_string_lossy().to_string();

    let paths: Vec<PathBuf> = glob(&pattern_str)
        .unwrap_or_else(|_| glob("").unwrap())
        .filter_map(|r| r.ok())
        .collect();

    for path in paths {
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for line in content.lines() {
            let entry: LogEntry = match serde_json::from_str(line) {
                Ok(e) => e,
                Err(_) => continue,
            };

            // Extract usage from various structures
            let usage = entry
                .usage
                .as_ref()
                .or(entry.message.as_ref().and_then(|m| m.usage.as_ref()));

            if let Some(u) = usage {
                let input = u.input_tokens.unwrap_or(0);
                let output = u.output_tokens.unwrap_or(0);
                let cache_read = u.cache_read_input_tokens.unwrap_or(0);
                let cache_create = u.cache_creation_input_tokens.unwrap_or(0);

                data.input_tokens += input;
                data.output_tokens += output;
                data.cache_read_tokens += cache_read;
                data.cache_creation_tokens += cache_create;
                data.message_count += 1;

                let tokens = input + output;

                // Parse timestamp for burn rate
                if let Some(ts) = &entry.timestamp {
                    if let Ok(dt) = ts.parse::<DateTime<Utc>>() {
                        if first_timestamp.is_none() {
                            first_timestamp = Some(dt);
                        }
                        timestamps.push((dt, tokens));
                    }
                }

                // Track session
                let sid = entry
                    .session_id
                    .clone()
                    .unwrap_or_else(|| "unknown".into());
                let session = session_map.entry(sid.clone()).or_insert(SessionInfo {
                    id: sid,
                    tokens: 0,
                    cost: 0.0,
                    messages: 0,
                    started: entry
                        .timestamp
                        .clone()
                        .unwrap_or_default(),
                });
                session.tokens += tokens;
                session.messages += 1;
            }

            // Direct cost tracking
            if let Some(cost) = entry.cost_usd {
                data.total_cost += cost;
            }
        }
    }

    // If no direct cost, calculate from tokens
    if data.total_cost == 0.0 {
        data.total_cost = calculate_cost(
            data.input_tokens,
            data.output_tokens,
            data.cache_read_tokens,
            data.cache_creation_tokens,
        );
    }

    // Calculate session costs
    for session in session_map.values_mut() {
        session.cost = (session.tokens as f64 * (INPUT_PRICE + OUTPUT_PRICE) / 2.0) / 1_000_000.0;
    }

    // Calculate burn rate (tokens per minute over last 30 min)
    if let Some(first) = first_timestamp {
        let now = Utc::now();
        let elapsed_min = (now - first).num_seconds() as f64 / 60.0;
        if elapsed_min > 0.0 {
            data.burn_rate = data.total_tokens as f64 / elapsed_min;
        }
    }

    // Estimated remaining
    let remaining_tokens = if data.total_tokens < data.limit {
        data.limit - data.total_tokens
    } else {
        0
    };
    data.estimated_remaining_min = if data.burn_rate > 0.0 {
        remaining_tokens as f64 / data.burn_rate
    } else {
        0.0
    };

    if let Some(first) = first_timestamp {
        data.session_start = Some(first.to_rfc3339());
    }

    data.sessions = session_map.into_values().collect();
    data.sessions.sort_by(|a, b| b.tokens.cmp(&a.tokens));

    data.recalculate();
    data.last_updated = Utc::now().to_rfc3339();
}

pub fn watch_claude_usage(handle: AppHandle, data: Arc<Mutex<UsageData>>) {
    // Initial scan
    {
        let mut d = data.lock().unwrap();
        scan_usage(&mut d);
        let _ = handle.emit("usage-updated", d.clone());
    }

    let claude_dir = match get_claude_dir() {
        Some(d) => d,
        None => {
            eprintln!("Could not find ~/.claude directory");
            return;
        }
    };

    let (tx, rx) = mpsc::channel();

    let mut watcher = match recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            match event.kind {
                EventKind::Modify(_) | EventKind::Create(_) => {
                    let _ = tx.send(());
                }
                _ => {}
            }
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create watcher: {}", e);
            // Fallback to polling
            loop {
                std::thread::sleep(Duration::from_secs(5));
                let mut d = data.lock().unwrap();
                scan_usage(&mut d);
                let _ = handle.emit("usage-updated", d.clone());
            }
        }
    };

    let projects_dir = claude_dir.join("projects");
    if projects_dir.exists() {
        let _ = watcher.watch(&projects_dir, RecursiveMode::Recursive);
    }
    // Also watch the main dir
    let _ = watcher.watch(&claude_dir, RecursiveMode::NonRecursive);

    let mut last_scan = Instant::now();
    let debounce = Duration::from_secs(2);

    loop {
        match rx.recv_timeout(Duration::from_secs(10)) {
            Ok(_) => {
                // Debounce: don't scan more than every 2s
                if last_scan.elapsed() >= debounce {
                    let mut d = data.lock().unwrap();
                    scan_usage(&mut d);
                    let _ = handle.emit("usage-updated", d.clone());
                    last_scan = Instant::now();
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Periodic refresh
                let mut d = data.lock().unwrap();
                scan_usage(&mut d);
                let _ = handle.emit("usage-updated", d.clone());
                last_scan = Instant::now();
            }
            Err(_) => break,
        }
    }
}
