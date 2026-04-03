use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchNode {
    pub id: String,
    pub label: String,
    pub kind: String, // "agent" | "plugin" | "hook" | "command" | "skill" | "project" | "permission"
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

pub fn read_architecture() -> ArchitectureData {
    let mut nodes: Vec<ArchNode> = Vec::new();
    let mut edges: Vec<ArchEdge> = Vec::new();
    let base = claude_dir();

    // Read settings.json
    let settings_path = base.join("settings.json");
    let settings: serde_json::Value = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null);

    // --- Central Agent Node ---
    let agent_id = "agent:claude-code".to_string();
    let mut agent_details = HashMap::new();
    if let Some(mode) = settings.get("teammateMode").and_then(|v| v.as_str()) {
        agent_details.insert("teammateMode".into(), mode.into());
    }
    if let Some(thinking) = settings.get("alwaysThinkingEnabled").and_then(|v| v.as_bool()) {
        agent_details.insert("alwaysThinking".into(), thinking.to_string());
    }
    nodes.push(ArchNode {
        id: agent_id.clone(),
        label: "Claude Code".into(),
        kind: "agent".into(),
        enabled: true,
        details: agent_details,
    });

    // --- Plugins ---
    if let Some(plugins) = settings.get("enabledPlugins").and_then(|v| v.as_object()) {
        for (name, val) in plugins {
            let enabled = val.as_bool().unwrap_or(false);
            let plug_id = format!("plugin:{}", name);
            let short_name = name.split('@').next().unwrap_or(name);
            let mut d = HashMap::new();
            d.insert("fullId".into(), name.clone());
            d.insert("enabled".into(), enabled.to_string());
            nodes.push(ArchNode {
                id: plug_id.clone(),
                label: short_name.into(),
                kind: "plugin".into(),
                enabled,
                details: d,
            });
            if enabled {
                edges.push(ArchEdge {
                    from: agent_id.clone(),
                    to: plug_id,
                    label: "uses".into(),
                });
            }
        }
    }

    // --- Hooks ---
    if let Some(hooks) = settings.get("hooks").and_then(|v| v.as_object()) {
        for (hook_name, hook_val) in hooks {
            let hook_id = format!("hook:{}", hook_name);
            let mut d = HashMap::new();

            // Count handlers
            let handler_count = hook_val.as_array().map(|a| a.len()).unwrap_or(0);
            d.insert("handlers".into(), handler_count.to_string());

            // Extract first command as preview
            if let Some(arr) = hook_val.as_array() {
                if let Some(first) = arr.first() {
                    if let Some(hooks_inner) = first.get("hooks").and_then(|v| v.as_array()) {
                        if let Some(cmd) = hooks_inner.first()
                            .and_then(|h| h.get("command"))
                            .and_then(|c| c.as_str())
                        {
                            let short = if cmd.len() > 60 {
                                format!("{}...", &cmd[..57])
                            } else {
                                cmd.to_string()
                            };
                            d.insert("command".into(), short);
                        }
                    }
                }
            }

            nodes.push(ArchNode {
                id: hook_id.clone(),
                label: hook_name.clone(),
                kind: "hook".into(),
                enabled: true,
                details: d,
            });
            edges.push(ArchEdge {
                from: agent_id.clone(),
                to: hook_id,
                label: "triggers".into(),
            });
        }
    }

    // --- Commands (from ~/.claude/commands/) ---
    let commands_dir = base.join("commands");
    if commands_dir.exists() {
        if let Ok(entries) = fs::read_dir(&commands_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                let cmd_id = format!("command:{}", name);

                let mut d = HashMap::new();
                if is_dir {
                    // Count files in command dir
                    if let Ok(sub) = fs::read_dir(entry.path()) {
                        let count = sub.count();
                        d.insert("files".into(), count.to_string());
                    }
                    d.insert("type".into(), "directory".into());
                } else {
                    d.insert("type".into(), "file".into());
                    // Read first line as description
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let first_line = content.lines().next().unwrap_or("").trim();
                        if !first_line.is_empty() && first_line.len() <= 80 {
                            d.insert("description".into(), first_line.into());
                        }
                    }
                }

                let label = name.trim_end_matches(".md").to_string();
                nodes.push(ArchNode {
                    id: cmd_id.clone(),
                    label,
                    kind: "command".into(),
                    enabled: true,
                    details: d,
                });
                edges.push(ArchEdge {
                    from: agent_id.clone(),
                    to: cmd_id,
                    label: "has".into(),
                });
            }
        }
    }

    // --- Skills (from ~/.claude/skills/) ---
    let skills_dir = base.join("skills");
    if skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let skill_id = format!("skill:{}", name);
                let mut d = HashMap::new();

                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    if let Ok(sub) = fs::read_dir(entry.path()) {
                        let count = sub.count();
                        d.insert("files".into(), count.to_string());
                    }
                }

                let label = name.trim_end_matches(".md").to_string();
                nodes.push(ArchNode {
                    id: skill_id.clone(),
                    label,
                    kind: "skill".into(),
                    enabled: true,
                    details: d,
                });
                edges.push(ArchEdge {
                    from: agent_id.clone(),
                    to: skill_id,
                    label: "uses".into(),
                });
            }
        }
    }

    // --- Projects (from ~/.claude/projects/) ---
    let projects_dir = base.join("projects");
    if projects_dir.exists() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            let mut count = 0;
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                count += 1;
                if count > 15 {
                    // Limit to avoid clutter
                    break;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                // Decode path: -Users-name-project becomes /Users/name/project
                let decoded = name.replace('-', "/");
                let short = decoded.split('/').last().unwrap_or(&name);
                let proj_id = format!("project:{}", name);
                let mut d = HashMap::new();
                d.insert("path".into(), decoded.clone());

                // Check for project-specific CLAUDE.md or settings
                let proj_path = entry.path();
                if proj_path.join("CLAUDE.md").exists() {
                    d.insert("hasCLAUDE.md".into(), "true".into());
                }
                if proj_path.join("settings.json").exists() {
                    d.insert("hasSettings".into(), "true".into());
                }
                // Count MCP configs
                let mcp_path = proj_path.join("mcpServers");
                if mcp_path.exists() {
                    if let Ok(mcp_entries) = fs::read_dir(&mcp_path) {
                        let mcp_count = mcp_entries.count();
                        if mcp_count > 0 {
                            d.insert("mcpServers".into(), mcp_count.to_string());
                        }
                    }
                }

                nodes.push(ArchNode {
                    id: proj_id.clone(),
                    label: short.into(),
                    kind: "project".into(),
                    enabled: true,
                    details: d,
                });
                edges.push(ArchEdge {
                    from: agent_id.clone(),
                    to: proj_id,
                    label: "workspace".into(),
                });
            }
        }
    }

    // --- Permissions (group allowed tools) ---
    if let Some(perms) = settings.pointer("/permissions/allow").and_then(|v| v.as_array()) {
        // Group by tool type
        let mut tool_groups: HashMap<String, Vec<String>> = HashMap::new();
        for perm in perms {
            if let Some(s) = perm.as_str() {
                let tool_type = if s.starts_with("Bash(") {
                    "Bash"
                } else if s.starts_with("Read(") {
                    "Read"
                } else if s.starts_with("Write(") {
                    "Write"
                } else if s.starts_with("mcp__") {
                    "MCP"
                } else {
                    "Other"
                };
                tool_groups.entry(tool_type.into()).or_default().push(s.into());
            }
        }

        for (group, items) in &tool_groups {
            let perm_id = format!("permission:{}", group);
            let mut d = HashMap::new();
            d.insert("count".into(), items.len().to_string());
            // Show first few items
            let preview: Vec<&str> = items.iter().take(3).map(|s| s.as_str()).collect();
            d.insert("items".into(), preview.join(", "));
            if items.len() > 3 {
                d.insert("more".into(), format!("+{}", items.len() - 3));
            }

            nodes.push(ArchNode {
                id: perm_id.clone(),
                label: format!("{} ({})", group, items.len()),
                kind: "permission".into(),
                enabled: true,
                details: d,
            });
            edges.push(ArchEdge {
                from: agent_id.clone(),
                to: perm_id,
                label: "allowed".into(),
            });
        }
    }

    ArchitectureData { nodes, edges }
}
