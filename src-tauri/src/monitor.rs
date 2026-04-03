use chrono::{DateTime, Duration, Utc};
use glob::glob;
use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

static WARNED_70: AtomicBool = AtomicBool::new(false);
static WARNED_90: AtomicBool = AtomicBool::new(false);

const PLAN_PRO: u64 = 44_000;
const PLAN_MAX5: u64 = 220_000;
const PLAN_MAX20: u64 = 880_000;
const WINDOW_HOURS: i64 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub plan: String,
    pub limit: u64,
    pub custom_limit: Option<u64>,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub message_count: u64,
    pub session_start: Option<String>,
    pub burn_rate: f64,
    pub estimated_remaining_min: f64,
    pub usage_percent: f64,
    pub window_remaining_min: f64,
    pub sessions: Vec<SessionInfo>,
    pub projects: Vec<ProjectInfo>,
    pub hourly_usage: Vec<HourlyPoint>,
    pub models: Vec<ModelUsage>,
    pub daily_history: Vec<DailyPoint>,
    pub recent_activities: Vec<RecentActivity>,
    pub active_project: Option<String>,
    pub last_updated: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub tokens: u64,
    pub cost: f64,
    pub messages: u64,
    pub started: String,
    pub last_active: String,
    pub status: String,       // "active" | "idle" | "offline"
    pub model: String,
    pub project: String,
    pub recent_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentActivity {
    pub timestamp: String,
    pub tool: String,
    pub summary: String,
    pub session_id: String,
    pub project: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub tokens: u64,
    pub messages: u64,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyPoint {
    pub hour: String,
    pub tokens: u64,
    pub messages: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub cost: f64,
    pub messages: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPoint {
    pub date: String, // "2026-03-31"
    pub tokens: u64,
    pub cost: f64,
    pub messages: u64,
}

impl Default for UsageData {
    fn default() -> Self {
        Self {
            plan: "max5".into(),
            limit: PLAN_MAX5,
            custom_limit: None,
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
            window_remaining_min: 0.0,
            sessions: vec![],
            projects: vec![],
            hourly_usage: vec![],
            models: vec![],
            daily_history: vec![],
            recent_activities: vec![],
            active_project: None,
            last_updated: Utc::now().to_rfc3339(),
            status: "ok".into(),
        }
    }
}

impl UsageData {
    pub fn update_limit(&mut self) {
        self.limit = if let Some(custom) = self.custom_limit {
            custom
        } else {
            match self.plan.as_str() {
                "pro" => PLAN_PRO,
                "max5" => PLAN_MAX5,
                "max20" => PLAN_MAX20,
                _ => PLAN_MAX5,
            }
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

// Model-specific pricing per million tokens
fn model_pricing(model: &str) -> (f64, f64) {
    // (input_per_m, output_per_m)
    let m = model.to_lowercase();
    if m.contains("opus") {
        (15.0, 75.0)
    } else if m.contains("haiku") {
        (0.25, 1.25)
    } else {
        // Default: Sonnet pricing
        (3.0, 15.0)
    }
}

const CACHE_READ_PRICE: f64 = 0.30;
const CACHE_CREATION_PRICE: f64 = 3.75;

fn calculate_cost_for_model(model: &str, input: u64, output: u64, cache_read: u64, cache_creation: u64) -> f64 {
    let (inp, outp) = model_pricing(model);
    (input as f64 * inp
        + output as f64 * outp
        + cache_read as f64 * CACHE_READ_PRICE
        + cache_creation as f64 * CACHE_CREATION_PRICE)
        / 1_000_000.0
}

fn calculate_cost(input: u64, output: u64, cache_read: u64, cache_creation: u64) -> f64 {
    calculate_cost_for_model("sonnet", input, output, cache_read, cache_creation)
}

fn get_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

fn extract_project_name(path: &PathBuf) -> String {
    let path_str = path.to_string_lossy();
    if let Some(projects_idx) = path_str.find("/projects/") {
        let after = &path_str[projects_idx + 10..];
        let parts: Vec<&str> = after.split('/').collect();
        if parts.len() >= 2 {
            return parts[0..parts.len() - 1].join("/");
        }
    }
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into())
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
    model: Option<String>,
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct LogMessage {
    role: Option<String>,
    model: Option<String>,
    usage: Option<TokenUsage>,
    content: Option<serde_json::Value>,
}

fn extract_tool_uses(message: &LogMessage) -> Vec<(String, String)> {
    let mut tools = vec![];
    if let Some(serde_json::Value::Array(arr)) = &message.content {
        for item in arr {
            if item.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                let summary = if let Some(input) = item.get("input") {
                    if let Some(fp) = input.get("file_path").and_then(|v| v.as_str()) {
                        fp.split('/').last().unwrap_or(fp).to_string()
                    } else if let Some(cmd) = input.get("command").and_then(|v| v.as_str()) {
                        cmd.chars().take(40).collect()
                    } else if let Some(fp) = input.get("path").and_then(|v| v.as_str()) {
                        fp.split('/').last().unwrap_or(fp).to_string()
                    } else {
                        String::new()
                    }
                } else {
                    String::new()
                };
                tools.push((name, summary));
            }
        }
    }
    tools
}

#[derive(Debug, Deserialize)]
struct TokenUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
}

struct ModelAccum {
    input_tokens: u64,
    output_tokens: u64,
    messages: u64,
}

fn scan_usage(data: &mut UsageData) {
    let claude_dir = match get_claude_dir() {
        Some(d) => d,
        None => return,
    };

    let plan = data.plan.clone();
    let custom_limit = data.custom_limit;
    let active_project = data.active_project.clone();

    data.input_tokens = 0;
    data.output_tokens = 0;
    data.cache_read_tokens = 0;
    data.cache_creation_tokens = 0;
    data.total_cost = 0.0;
    data.message_count = 0;
    data.sessions.clear();
    data.projects.clear();
    data.hourly_usage.clear();
    data.models.clear();
    data.daily_history.clear();
    data.recent_activities.clear();
    data.plan = plan;
    data.custom_limit = custom_limit;
    data.active_project = active_project;

    let now = Utc::now();
    let window_start = now - Duration::hours(WINDOW_HOURS);
    let history_start = now - Duration::days(7); // 7-day history

    let mut session_map: HashMap<String, SessionInfo> = HashMap::new();
    let mut session_last_model: HashMap<String, String> = HashMap::new();
    let mut session_last_active: HashMap<String, DateTime<Utc>> = HashMap::new();
    let mut session_project: HashMap<String, String> = HashMap::new();
    let mut session_tools: HashMap<String, Vec<String>> = HashMap::new();
    let mut all_activities: Vec<RecentActivity> = Vec::new();
    let mut project_map: HashMap<String, ProjectInfo> = HashMap::new();
    let mut hourly_map: HashMap<String, (u64, u64)> = HashMap::new();
    let mut model_map: HashMap<String, ModelAccum> = HashMap::new();
    let mut daily_map: HashMap<String, (u64, f64, u64)> = HashMap::new();
    let mut first_timestamp: Option<DateTime<Utc>> = None;

    let pattern = claude_dir.join("projects").join("**").join("*.jsonl");
    let pattern_str = pattern.to_string_lossy().to_string();

    let paths: Vec<PathBuf> = glob(&pattern_str)
        .unwrap_or_else(|_| glob("").unwrap())
        .filter_map(|r| r.ok())
        .collect();

    for path in paths {
        let project_name = extract_project_name(&path);

        // Skip files not modified recently (perf)
        if let Ok(meta) = fs::metadata(&path) {
            if let Ok(modified) = meta.modified() {
                let age = modified.elapsed().unwrap_or_default();
                if age > std::time::Duration::from_secs(8 * 24 * 3600) {
                    project_map.entry(project_name.clone()).or_insert(ProjectInfo {
                        name: project_name.clone(),
                        path: path.to_string_lossy().to_string(),
                        tokens: 0, messages: 0, cost: 0.0,
                    });
                    continue;
                }
            }
        }

        if let Some(ref active) = data.active_project {
            if !active.is_empty() && project_name != *active {
                project_map.entry(project_name.clone()).or_insert(ProjectInfo {
                    name: project_name.clone(),
                    path: path.to_string_lossy().to_string(),
                    tokens: 0, messages: 0, cost: 0.0,
                });
                continue;
            }
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        project_map.entry(project_name.clone()).or_insert(ProjectInfo {
            name: project_name.clone(),
            path: path.to_string_lossy().to_string(),
            tokens: 0, messages: 0, cost: 0.0,
        });

        for line in content.lines() {
            let entry: LogEntry = match serde_json::from_str(line) {
                Ok(e) => e,
                Err(_) => continue,
            };

            let entry_time = entry
                .timestamp
                .as_ref()
                .and_then(|ts| ts.parse::<DateTime<Utc>>().ok());

            let dt = match entry_time {
                Some(dt) if dt >= history_start => dt,
                _ => continue,
            };

            let usage = entry
                .usage
                .as_ref()
                .or(entry.message.as_ref().and_then(|m| m.usage.as_ref()));

            if let Some(u) = usage {
                let input = u.input_tokens.unwrap_or(0);
                let output = u.output_tokens.unwrap_or(0);
                let cache_read = u.cache_read_input_tokens.unwrap_or(0);
                let cache_create = u.cache_creation_input_tokens.unwrap_or(0);
                let tokens = input + output;

                // Model tracking
                let model_name = entry.model
                    .as_deref()
                    .or(entry.message.as_ref().and_then(|m| m.model.as_deref()))
                    .unwrap_or("unknown")
                    .to_string();

                let model_accum = model_map.entry(model_name.clone()).or_insert(ModelAccum {
                    input_tokens: 0, output_tokens: 0, messages: 0,
                });

                // Daily history (7 days)
                let date_key = dt.format("%Y-%m-%d").to_string();
                let daily = daily_map.entry(date_key).or_insert((0, 0.0, 0));
                daily.0 += tokens;
                daily.1 += calculate_cost_for_model(&model_name, input, output, cache_read, cache_create);
                daily.2 += 1;

                // Only count within 5-hour window for current stats
                if dt >= window_start {
                    data.input_tokens += input;
                    data.output_tokens += output;
                    data.cache_read_tokens += cache_read;
                    data.cache_creation_tokens += cache_create;
                    data.message_count += 1;

                    model_accum.input_tokens += input;
                    model_accum.output_tokens += output;
                    model_accum.messages += 1;

                    if first_timestamp.is_none() || dt < first_timestamp.unwrap() {
                        first_timestamp = Some(dt);
                    }

                    let hour_key = format!("{:02}:00", dt.format("%H"));
                    let hourly = hourly_map.entry(hour_key).or_insert((0, 0));
                    hourly.0 += tokens;
                    hourly.1 += 1;

                    let sid = entry.session_id.clone().unwrap_or_else(|| "unknown".into());
                    let session = session_map.entry(sid.clone()).or_insert(SessionInfo {
                        id: sid.clone(), tokens: 0, cost: 0.0, messages: 0,
                        started: entry.timestamp.clone().unwrap_or_default(),
                        last_active: String::new(), status: String::new(),
                        model: String::new(), project: String::new(),
                        recent_tools: vec![],
                    });
                    session.tokens += tokens;
                    session.messages += 1;

                    // Track last active time and model per session
                    let prev = session_last_active.get(&sid);
                    if prev.is_none() || dt > *prev.unwrap() {
                        session_last_active.insert(sid.clone(), dt);
                        session_last_model.insert(sid.clone(), model_name.clone());
                    }
                    session_project.entry(sid.clone()).or_insert_with(|| project_name.clone());

                    if let Some(proj) = project_map.get_mut(&project_name) {
                        proj.tokens += tokens;
                        proj.messages += 1;
                    }
                }
            }

            if let Some(cost) = entry.cost_usd {
                if dt >= window_start {
                    data.total_cost += cost;
                }
            }

            // Extract tool uses from assistant messages
            if dt >= window_start {
                if let Some(ref msg) = entry.message {
                    if msg.role.as_deref() == Some("assistant") {
                        let tool_uses = extract_tool_uses(msg);
                        let sid = entry.session_id.clone().unwrap_or_else(|| "unknown".into());
                        for (tool_name, summary) in &tool_uses {
                            session_tools.entry(sid.clone()).or_default().push(tool_name.clone());
                            all_activities.push(RecentActivity {
                                timestamp: entry.timestamp.clone().unwrap_or_default(),
                                tool: tool_name.clone(),
                                summary: summary.clone(),
                                session_id: sid.clone(),
                                project: project_name.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Calculate costs
    if data.total_cost == 0.0 {
        data.total_cost = calculate_cost(
            data.input_tokens, data.output_tokens,
            data.cache_read_tokens, data.cache_creation_tokens,
        );
    }

    for session in session_map.values_mut() {
        session.cost = calculate_cost(session.tokens / 2, session.tokens / 2, 0, 0);
    }
    for proj in project_map.values_mut() {
        proj.cost = calculate_cost(proj.tokens / 2, proj.tokens / 2, 0, 0);
    }

    // Model usage
    data.models = model_map.into_iter().map(|(name, acc)| {
        let cost = calculate_cost_for_model(&name, acc.input_tokens, acc.output_tokens, 0, 0);
        ModelUsage {
            model: name,
            input_tokens: acc.input_tokens,
            output_tokens: acc.output_tokens,
            total_tokens: acc.input_tokens + acc.output_tokens,
            cost,
            messages: acc.messages,
        }
    }).collect();
    data.models.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    // Daily history
    let mut dates: Vec<String> = daily_map.keys().cloned().collect();
    dates.sort();
    data.daily_history = dates.into_iter().map(|d| {
        let (tokens, cost, messages) = daily_map[&d];
        DailyPoint { date: d, tokens, cost, messages }
    }).collect();

    // Burn rate
    data.recalculate();
    if let Some(first) = first_timestamp {
        let elapsed_min = (now - first).num_seconds() as f64 / 60.0;
        if elapsed_min > 0.0 {
            data.burn_rate = data.total_tokens as f64 / elapsed_min;
        }
    }

    let remaining_tokens = if data.total_tokens < data.limit { data.limit - data.total_tokens } else { 0 };
    data.estimated_remaining_min = if data.burn_rate > 0.0 {
        remaining_tokens as f64 / data.burn_rate
    } else { 0.0 };

    if let Some(first) = first_timestamp {
        let window_end = first + Duration::hours(WINDOW_HOURS);
        let remaining = (window_end - now).num_seconds() as f64 / 60.0;
        data.window_remaining_min = if remaining > 0.0 { remaining } else { 0.0 };
    }

    if let Some(first) = first_timestamp {
        data.session_start = Some(first.to_rfc3339());
    }

    // Populate session metadata
    for session in session_map.values_mut() {
        let sid = &session.id;
        if let Some(la) = session_last_active.get(sid) {
            session.last_active = la.to_rfc3339();
            let age_min = (now - *la).num_minutes();
            session.status = if age_min < 5 { "active".into() }
                else if age_min < 30 { "idle".into() }
                else { "offline".into() };
        } else {
            session.status = "offline".into();
        }
        if let Some(m) = session_last_model.get(sid) {
            session.model = m.split('/').last().unwrap_or(m).to_string();
        }
        if let Some(p) = session_project.get(sid) {
            session.project = p.clone();
        }
        if let Some(tools) = session_tools.get(sid) {
            let mut unique: Vec<String> = vec![];
            for t in tools.iter().rev().take(10) {
                if !unique.contains(t) { unique.push(t.clone()); }
            }
            session.recent_tools = unique;
        }
    }

    data.sessions = session_map.into_values().collect();
    data.sessions.sort_by(|a, b| b.tokens.cmp(&a.tokens));

    // Recent activities (last 20)
    all_activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    all_activities.truncate(20);
    data.recent_activities = all_activities;
    data.projects = project_map.into_values().collect();
    data.projects.sort_by(|a, b| b.tokens.cmp(&a.tokens));

    let mut hours: Vec<String> = hourly_map.keys().cloned().collect();
    hours.sort();
    data.hourly_usage = hours.into_iter().map(|h| {
        let (tokens, messages) = hourly_map[&h];
        HourlyPoint { hour: h, tokens, messages }
    }).collect();

    data.update_limit();
    data.last_updated = Utc::now().to_rfc3339();
}

fn check_and_notify(handle: &AppHandle, data: &UsageData) {
    let pct = data.usage_percent;
    if pct >= 90.0 && !WARNED_90.load(Ordering::Relaxed) {
        WARNED_90.store(true, Ordering::Relaxed);
        let _ = handle.notification().builder()
            .title("🚨 Claude Scouter — Critical")
            .body(format!("Token usage at {:.1}%! ({} / {})", pct,
                format_tokens_rust(data.total_tokens), format_tokens_rust(data.limit)))
            .show();
    } else if pct >= 70.0 && !WARNED_70.load(Ordering::Relaxed) {
        WARNED_70.store(true, Ordering::Relaxed);
        let _ = handle.notification().builder()
            .title("⚠️ Claude Scouter — Warning")
            .body(format!("Token usage at {:.1}%. Consider slowing down.", pct))
            .show();
    }
    if pct < 70.0 {
        WARNED_70.store(false, Ordering::Relaxed);
        WARNED_90.store(false, Ordering::Relaxed);
    } else if pct < 90.0 {
        WARNED_90.store(false, Ordering::Relaxed);
    }
}

fn format_tokens_rust(n: u64) -> String {
    if n >= 1_000_000 { format!("{:.1}M", n as f64 / 1_000_000.0) }
    else if n >= 1_000 { format!("{:.1}K", n as f64 / 1_000.0) }
    else { n.to_string() }
}

pub fn watch_claude_usage(handle: AppHandle, data: Arc<Mutex<UsageData>>) {
    {
        let mut d = data.lock().unwrap();
        scan_usage(&mut d);
        check_and_notify(&handle, &d);
        let _ = handle.emit("usage-updated", d.clone());
    }

    let claude_dir = match get_claude_dir() {
        Some(d) => d,
        None => { eprintln!("Could not find ~/.claude directory"); return; }
    };

    let (tx, rx) = mpsc::channel();
    let mut watcher = match recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            match event.kind {
                EventKind::Modify(_) | EventKind::Create(_) => { let _ = tx.send(()); }
                _ => {}
            }
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create watcher: {}", e);
            loop {
                std::thread::sleep(std::time::Duration::from_secs(5));
                let mut d = data.lock().unwrap();
                scan_usage(&mut d);
                check_and_notify(&handle, &d);
                let _ = handle.emit("usage-updated", d.clone());
            }
        }
    };

    let projects_dir = claude_dir.join("projects");
    if projects_dir.exists() {
        let _ = watcher.watch(&projects_dir, RecursiveMode::Recursive);
    }
    let _ = watcher.watch(&claude_dir, RecursiveMode::NonRecursive);

    let mut last_scan = Instant::now();
    let debounce = std::time::Duration::from_secs(3);

    loop {
        match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(_) => {
                if last_scan.elapsed() >= debounce {
                    let mut d = data.lock().unwrap();
                    scan_usage(&mut d);
                    check_and_notify(&handle, &d);
                    let _ = handle.emit("usage-updated", d.clone());
                    last_scan = Instant::now();
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let mut d = data.lock().unwrap();
                scan_usage(&mut d);
                check_and_notify(&handle, &d);
                let _ = handle.emit("usage-updated", d.clone());
                last_scan = Instant::now();
            }
            Err(_) => break,
        }
    }
}
