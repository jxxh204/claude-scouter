use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchNode {
    pub id: String,
    pub label: String,
    pub kind: String, // "agent" | "skill" | "channel" | "command" | "plugin" | "model"
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

fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".openclaw")
        .join("openclaw.json")
}

pub fn read_architecture() -> ArchitectureData {
    let mut nodes: Vec<ArchNode> = Vec::new();
    let mut edges: Vec<ArchEdge> = Vec::new();

    let path = config_path();
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return ArchitectureData { nodes, edges },
    };
    let config: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return ArchitectureData { nodes, edges },
    };

    // --- Agent (main) ---
    let agent_id = "agent:main".to_string();
    let mut agent_details = HashMap::new();
    if let Some(model) = config
        .pointer("/agents/defaults/model/primary")
        .and_then(|v| v.as_str())
    {
        agent_details.insert("model".into(), model.into());
    }
    if let Some(ws) = config
        .pointer("/agents/defaults/workspace")
        .and_then(|v| v.as_str())
    {
        agent_details.insert("workspace".into(), ws.into());
    }
    nodes.push(ArchNode {
        id: agent_id.clone(),
        label: "Main Agent".into(),
        kind: "agent".into(),
        enabled: true,
        details: agent_details,
    });

    // --- Model ---
    if let Some(model) = config
        .pointer("/agents/defaults/model/primary")
        .and_then(|v| v.as_str())
    {
        let model_id = format!("model:{}", model);
        let short = model.split('/').last().unwrap_or(model);
        let mut d = HashMap::new();
        d.insert("full".into(), model.into());
        nodes.push(ArchNode {
            id: model_id.clone(),
            label: short.into(),
            kind: "model".into(),
            enabled: true,
            details: d,
        });
        edges.push(ArchEdge {
            from: agent_id.clone(),
            to: model_id,
            label: "uses".into(),
        });
    }

    // --- Skills ---
    if let Some(entries) = config.pointer("/skills/entries").and_then(|v| v.as_object()) {
        for (name, val) in entries {
            let enabled = val
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let skill_id = format!("skill:{}", name);
            let mut d = HashMap::new();
            d.insert("enabled".into(), enabled.to_string());
            nodes.push(ArchNode {
                id: skill_id.clone(),
                label: name.clone(),
                kind: "skill".into(),
                enabled,
                details: d,
            });
            edges.push(ArchEdge {
                from: agent_id.clone(),
                to: skill_id,
                label: if enabled {
                    "active".into()
                } else {
                    "disabled".into()
                },
            });
        }
    }

    // Also check built-in skills dir
    let builtin_skills_dir = PathBuf::from("/usr/local/lib/node_modules/openclaw/skills");
    if builtin_skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&builtin_skills_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let skill_id = format!("skill:{}", name);
                    // Skip if already added from config
                    if nodes.iter().any(|n| n.id == skill_id) {
                        continue;
                    }
                    let mut d = HashMap::new();
                    d.insert("source".into(), "builtin".into());
                    nodes.push(ArchNode {
                        id: skill_id.clone(),
                        label: name,
                        kind: "skill".into(),
                        enabled: false, // not explicitly configured
                        details: d,
                    });
                    // Don't add edge for unconfigured builtins to reduce clutter
                }
            }
        }
    }

    // Workspace skills
    let ws_skills_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(".openclaw/workspace/skills");
    if ws_skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&ws_skills_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let skill_id = format!("skill:{}", name);
                    if nodes.iter().any(|n| n.id == skill_id) {
                        continue;
                    }
                    let mut d = HashMap::new();
                    d.insert("source".into(), "workspace".into());
                    nodes.push(ArchNode {
                        id: skill_id.clone(),
                        label: name,
                        kind: "skill".into(),
                        enabled: true,
                        details: d,
                    });
                    edges.push(ArchEdge {
                        from: agent_id.clone(),
                        to: skill_id,
                        label: "workspace".into(),
                    });
                }
            }
        }
    }

    // --- Channels ---
    if let Some(channels) = config.get("channels").and_then(|v| v.as_object()) {
        for (ch_name, ch_val) in channels {
            let enabled = ch_val
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let ch_id = format!("channel:{}", ch_name);
            let mut d = HashMap::new();
            d.insert("enabled".into(), enabled.to_string());

            // Count allowed channels (for discord)
            if let Some(guilds) = ch_val.get("guilds").and_then(|v| v.as_object()) {
                let mut ch_count = 0;
                for (_gid, gval) in guilds {
                    if let Some(chs) = gval.pointer("/channels").and_then(|v| v.as_object()) {
                        ch_count += chs.len();
                    }
                }
                d.insert("allowedChannels".into(), ch_count.to_string());
            }

            nodes.push(ArchNode {
                id: ch_id.clone(),
                label: ch_name.clone(),
                kind: "channel".into(),
                enabled,
                details: d,
            });

            if enabled {
                edges.push(ArchEdge {
                    from: agent_id.clone(),
                    to: ch_id,
                    label: "connected".into(),
                });
            }
        }
    }

    // --- Plugins ---
    if let Some(entries) = config
        .pointer("/plugins/entries")
        .and_then(|v| v.as_object())
    {
        for (name, val) in entries {
            let enabled = val
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let plug_id = format!("plugin:{}", name);
            let mut d = HashMap::new();
            d.insert("enabled".into(), enabled.to_string());
            nodes.push(ArchNode {
                id: plug_id.clone(),
                label: name.clone(),
                kind: "plugin".into(),
                enabled,
                details: d,
            });
            if enabled {
                // Connect plugin to its channel if same name exists
                let ch_id = format!("channel:{}", name);
                if nodes.iter().any(|n| n.id == ch_id) {
                    edges.push(ArchEdge {
                        from: plug_id,
                        to: ch_id,
                        label: "provides".into(),
                    });
                }
            }
        }
    }

    // --- Commands ---
    if let Some(cmds) = config.get("commands") {
        let cmd_id = "commands:config".to_string();
        let mut d = HashMap::new();
        if let Some(native) = cmds.get("native").and_then(|v| v.as_str()) {
            d.insert("native".into(), native.into());
        }
        if let Some(ns) = cmds.get("nativeSkills").and_then(|v| v.as_str()) {
            d.insert("nativeSkills".into(), ns.into());
        }
        nodes.push(ArchNode {
            id: cmd_id.clone(),
            label: "Commands".into(),
            kind: "command".into(),
            enabled: true,
            details: d,
        });
        edges.push(ArchEdge {
            from: agent_id.clone(),
            to: cmd_id,
            label: "handles".into(),
        });
    }

    ArchitectureData { nodes, edges }
}
