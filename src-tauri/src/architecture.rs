use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchNode {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub enabled: bool,
    pub details: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchEdge {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectureData {
    pub nodes: Vec<ArchNode>,
    pub edges: Vec<ArchEdge>,
}

fn claude_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".claude")
}

fn make_node(id: &str, label: &str, kind: &str, details: HashMap<String, String>) -> ArchNode {
    ArchNode {
        id: id.into(),
        label: label.into(),
        kind: kind.into(),
        enabled: true,
        details,
    }
}

fn read_md_summary(path: &PathBuf) -> HashMap<String, String> {
    let mut d = HashMap::new();
    if let Ok(content) = fs::read_to_string(path) {
        // First non-empty line as description
        for line in content.lines() {
            let trimmed = line.trim().trim_start_matches('#').trim();
            if !trimmed.is_empty() {
                let desc = if trimmed.len() > 80 {
                    format!("{}…", &trimmed[..77])
                } else {
                    trimmed.to_string()
                };
                d.insert("description".into(), desc);
                break;
            }
        }
        let line_count = content.lines().count();
        d.insert("lines".into(), line_count.to_string());
    }
    d
}

/// Scan a project workspace's .claude/ directory and extract architecture
fn scan_project(
    project_path: &PathBuf,
    nodes: &mut Vec<ArchNode>,
    edges: &mut Vec<ArchEdge>,
) -> Option<String> {
    let claude_dir = project_path.join(".claude");
    if !claude_dir.exists() {
        return None;
    }

    let project_name = project_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let proj_id = format!("project:{}", project_name);

    let mut proj_details = HashMap::new();
    proj_details.insert("path".into(), project_path.to_string_lossy().to_string());

    // Check for CLAUDE.md at project root
    let claude_md = project_path.join("CLAUDE.md");
    if claude_md.exists() {
        proj_details.insert("CLAUDE.md".into(), "✅".into());
    }

    // Check settings.local.json
    let settings_local = claude_dir.join("settings.local.json");
    if settings_local.exists() {
        proj_details.insert("settings".into(), "✅".into());
        if let Ok(content) = fs::read_to_string(&settings_local) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                // Extract MCP servers if any
                if let Some(mcp) = val.get("mcpServers").and_then(|v| v.as_object()) {
                    let names: Vec<&String> = mcp.keys().collect();
                    if !names.is_empty() {
                        proj_details.insert(
                            "mcpServers".into(),
                            names.iter().map(|n| n.as_str()).collect::<Vec<_>>().join(", "),
                        );
                    }
                }
            }
        }
    }

    nodes.push(ArchNode {
        id: proj_id.clone(),
        label: project_name.clone(),
        kind: "project".into(),
        enabled: true,
        details: proj_details,
    });

    // --- Agents ---
    let agents_dir = claude_dir.join("agents");
    if agents_dir.exists() {
        if let Ok(entries) = fs::read_dir(&agents_dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if !fname.ends_with(".md") {
                    continue;
                }
                let agent_name = fname.trim_end_matches(".md");
                let agent_id = format!("{}:agent:{}", proj_id, agent_name);
                let details = read_md_summary(&entry.path());

                nodes.push(make_node(&agent_id, agent_name, "agent", details));
                edges.push(ArchEdge {
                    from: proj_id.clone(),
                    to: agent_id.clone(),
                    label: "has agent".into(),
                });

                // Try to infer agent → rule connections from agent file content
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let content_lower = content.to_lowercase();
                    // Check if agent mentions any rule files
                    let rules_dir = claude_dir.join("rules");
                    if rules_dir.exists() {
                        if let Ok(rule_entries) = fs::read_dir(&rules_dir) {
                            for rule_entry in rule_entries.flatten() {
                                let rule_fname =
                                    rule_entry.file_name().to_string_lossy().to_string();
                                let rule_name = rule_fname.trim_end_matches(".md");
                                let rule_id = format!("{}:rule:{}", proj_id, rule_name);

                                // Check if agent content references this rule by keyword match
                                let rule_keywords: Vec<&str> =
                                    rule_name.split('-').collect();
                                let matches = rule_keywords.iter().any(|kw| {
                                    kw.len() > 3 && content_lower.contains(*kw)
                                });

                                if matches {
                                    edges.push(ArchEdge {
                                        from: agent_id.clone(),
                                        to: rule_id,
                                        label: "follows".into(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Rules ---
    let rules_dir = claude_dir.join("rules");
    if rules_dir.exists() {
        if let Ok(entries) = fs::read_dir(&rules_dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if !fname.ends_with(".md") {
                    continue;
                }
                let rule_name = fname.trim_end_matches(".md");
                let rule_id = format!("{}:rule:{}", proj_id, rule_name);

                // Skip if already added
                if nodes.iter().any(|n| n.id == rule_id) {
                    continue;
                }

                let details = read_md_summary(&entry.path());
                nodes.push(make_node(&rule_id, rule_name, "rule", details));
                edges.push(ArchEdge {
                    from: proj_id.clone(),
                    to: rule_id,
                    label: "has rule".into(),
                });
            }
        }
    }

    // --- Skills ---
    let skills_dir = claude_dir.join("skills");
    if skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let skill_name = entry.file_name().to_string_lossy().to_string();
                let skill_id = format!("{}:skill:{}", proj_id, skill_name);
                let mut d = HashMap::new();

                // Count files in skill dir
                if let Ok(sub) = fs::read_dir(entry.path()) {
                    let files: Vec<String> = sub
                        .flatten()
                        .map(|e| e.file_name().to_string_lossy().to_string())
                        .collect();
                    d.insert("files".into(), files.join(", "));
                }

                // Read skill's main md if exists
                let skill_md = entry.path().join(format!("{}.md", skill_name));
                if skill_md.exists() {
                    let summary = read_md_summary(&skill_md);
                    if let Some(desc) = summary.get("description") {
                        d.insert("description".into(), desc.clone());
                    }
                }

                nodes.push(make_node(&skill_id, &skill_name, "skill", d));
                edges.push(ArchEdge {
                    from: proj_id.clone(),
                    to: skill_id,
                    label: "has skill".into(),
                });
            }
        }
    }

    // --- Commands (project-level from ~/.claude/commands/) ---
    let commands_dir = claude_dir.join("commands");
    if commands_dir.exists() {
        scan_commands(&commands_dir, &proj_id, nodes, edges);
    }

    Some(proj_id)
}

fn scan_commands(
    dir: &PathBuf,
    parent_id: &str,
    nodes: &mut Vec<ArchNode>,
    edges: &mut Vec<ArchEdge>,
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

            if is_dir {
                // Recurse into subdirectory
                let sub_id = format!("{}:cmdgroup:{}", parent_id, fname);
                let mut d = HashMap::new();
                d.insert("type".into(), "group".into());
                nodes.push(make_node(&sub_id, &fname, "command", d));
                edges.push(ArchEdge {
                    from: parent_id.into(),
                    to: sub_id.clone(),
                    label: "has command".into(),
                });
                scan_commands(&entry.path(), &sub_id, nodes, edges);
            } else if fname.ends_with(".md") {
                let cmd_name = fname.trim_end_matches(".md");
                let cmd_id = format!("{}:cmd:{}", parent_id, cmd_name);
                let details = read_md_summary(&entry.path());
                nodes.push(make_node(&cmd_id, cmd_name, "command", details));
                edges.push(ArchEdge {
                    from: parent_id.into(),
                    to: cmd_id,
                    label: "has command".into(),
                });
            }
        }
    }
}

pub fn read_architecture() -> ArchitectureData {
    let mut nodes: Vec<ArchNode> = Vec::new();
    let mut edges: Vec<ArchEdge> = Vec::new();
    let base = claude_dir();

    // --- Global settings ---
    let settings_path = base.join("settings.json");
    let settings: serde_json::Value = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null);

    // --- Global Hooks ---
    if let Some(hooks) = settings.get("hooks").and_then(|v| v.as_object()) {
        for (hook_name, hook_val) in hooks {
            let hook_id = format!("global:hook:{}", hook_name);
            let mut d = HashMap::new();
            let handler_count = hook_val.as_array().map(|a| a.len()).unwrap_or(0);
            d.insert("handlers".into(), handler_count.to_string());
            d.insert("scope".into(), "global".into());
            nodes.push(make_node(&hook_id, hook_name, "hook", d));
        }
    }

    // --- Global Commands ---
    let global_cmds_dir = base.join("commands");
    if global_cmds_dir.exists() {
        let global_cmd_id = "global:commands".to_string();
        let mut d = HashMap::new();
        d.insert("scope".into(), "global".into());
        nodes.push(make_node(&global_cmd_id, "Global Commands", "command", d));
        scan_commands(&global_cmds_dir, &global_cmd_id, &mut nodes, &mut edges);
    }

    // --- Global Skills ---
    let global_skills_dir = base.join("skills");
    if global_skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&global_skills_dir) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let skill_name = entry.file_name().to_string_lossy().to_string();
                let skill_id = format!("global:skill:{}", skill_name);
                let mut d = HashMap::new();
                d.insert("scope".into(), "global".into());
                nodes.push(make_node(&skill_id, &skill_name, "skill", d));
            }
        }
    }

    // --- Global Plugins ---
    if let Some(plugins) = settings.get("enabledPlugins").and_then(|v| v.as_object()) {
        for (name, val) in plugins {
            let enabled = val.as_bool().unwrap_or(false);
            if !enabled {
                continue;
            }
            let short = name.split('@').next().unwrap_or(name);
            let plug_id = format!("global:plugin:{}", short);
            let mut d = HashMap::new();
            d.insert("fullId".into(), name.clone());
            d.insert("scope".into(), "global".into());
            nodes.push(ArchNode {
                id: plug_id,
                label: short.into(),
                kind: "plugin".into(),
                enabled: true,
                details: d,
            });
        }
    }

    // --- Scan projects ---
    // Find project workspaces from ~/.claude/projects/ directory names
    let projects_dir = base.join("projects");
    let mut scanned_paths: Vec<PathBuf> = Vec::new();

    if projects_dir.exists() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let dirname = entry.file_name().to_string_lossy().to_string();
                // Decode: -Users-name-project → /Users/name/project
                let decoded_path = PathBuf::from(format!("/{}", dirname.replace('-', "/")));
                // Fix: the encoding actually replaces / with - but keeps first char
                // Try the raw decoded path
                if decoded_path.join(".claude").exists() {
                    scanned_paths.push(decoded_path);
                }
            }
        }
    }

    // Also scan some common locations
    if let Some(home) = dirs::home_dir() {
        for dir_name in &["project", "projects", "dev", "work", "Study"] {
            let parent = home.join(dir_name);
            if parent.exists() {
                if let Ok(entries) = fs::read_dir(&parent) {
                    for entry in entries.flatten() {
                        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            let p = entry.path();
                            if p.join(".claude").exists() && !scanned_paths.contains(&p) {
                                scanned_paths.push(p);
                            }
                        }
                    }
                }
            }
        }
    }

    // Limit to 20 projects
    scanned_paths.truncate(20);

    let mut project_ids: Vec<String> = Vec::new();
    for path in &scanned_paths {
        if let Some(pid) = scan_project(path, &mut nodes, &mut edges) {
            project_ids.push(pid);
        }
    }

    // Connect projects to global hooks
    for pid in &project_ids {
        for node in &nodes {
            if node.id.starts_with("global:hook:") {
                edges.push(ArchEdge {
                    from: node.id.clone(),
                    to: pid.clone(),
                    label: "applies to".into(),
                });
            }
        }
    }

    ArchitectureData { nodes, edges }
}
