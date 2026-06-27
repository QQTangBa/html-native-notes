use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidInboxLine {
    pub line_number: usize,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxReadResult {
    pub requests: Vec<Value>,
    pub invalid_lines: Vec<InvalidInboxLine>,
    pub skipped_duplicates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntakeResult {
    pub created: bool,
    pub manifest_path: String,
    pub asset: Value,
}

pub fn vault_inbox_path(vault_dir: &Path) -> PathBuf {
    vault_dir.join(".htmlvault").join("inbox").join("requests.jsonl")
}

pub fn app_support_inbox_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("agent-inbox").join("requests.jsonl")
}

pub fn read_inbox_requests(inbox_paths: &[PathBuf]) -> Result<InboxReadResult, String> {
    let mut seen_dedupe_keys = HashSet::new();
    let mut requests = Vec::new();
    let mut invalid_lines = Vec::new();
    let mut skipped_duplicates = Vec::new();
    let mut global_line_number = 0usize;

    for inbox_path in inbox_paths {
        let raw = read_optional_file(inbox_path).map_err(|error| error.to_string())?;

        for line in raw.lines() {
            global_line_number += 1;
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

            let parsed: Value = match serde_json::from_str(trimmed) {
                Ok(value) => value,
                Err(_) => {
                    invalid_lines.push(InvalidInboxLine {
                        line_number: global_line_number,
                        reason: "Invalid JSON".to_string(),
                    });
                    continue;
                }
            };

            let request_id = match string_field(&parsed, "requestId") {
                Some(value) => value,
                None => {
                    invalid_lines.push(InvalidInboxLine {
                        line_number: global_line_number,
                        reason: "Missing requestId".to_string(),
                    });
                    continue;
                }
            };
            let dedupe_key = match string_field(&parsed, "dedupeKey") {
                Some(value) => value,
                None => {
                    invalid_lines.push(InvalidInboxLine {
                        line_number: global_line_number,
                        reason: "Missing dedupeKey".to_string(),
                    });
                    continue;
                }
            };

            if seen_dedupe_keys.contains(&dedupe_key) {
                skipped_duplicates.push(request_id);
                continue;
            }

            seen_dedupe_keys.insert(dedupe_key);
            requests.push(parsed);
        }
    }

    Ok(InboxReadResult {
        requests,
        invalid_lines,
        skipped_duplicates,
    })
}

pub fn acknowledge_inbox_requests(inbox_paths: &[PathBuf], processed_request_ids: &[String]) -> Result<(), String> {
    let processed: HashSet<&str> = processed_request_ids.iter().map(String::as_str).collect();

    for inbox_path in inbox_paths {
        rewrite_inbox_without(inbox_path, &processed).map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn intake_inbox_request(vault_dir: &Path, request: &Value) -> Result<IntakeResult, String> {
    verify_source_hash(request)?;

    let manifest_path = manifest_path_for(vault_dir);
    let mut manifest = read_manifest(&manifest_path)?;
    let dedupe_key = required_string(request, "dedupeKey")?;

    if let Some(existing) = manifest
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| assets.iter().find(|asset| string_field(asset, "dedupeKey").as_deref() == Some(dedupe_key.as_str())))
        .cloned()
    {
        return Ok(IntakeResult {
            created: false,
            manifest_path: manifest_path.to_string_lossy().to_string(),
            asset: existing,
        });
    }

    let now = timestamp_string();
    let asset = asset_from_request(request, &dedupe_key, &now)?;
    let assets = manifest
        .get_mut("assets")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "Invalid manifest assets".to_string())?;
    assets.push(asset.clone());
    manifest["updatedAt"] = Value::String(now);
    write_manifest(&manifest_path, &manifest)?;

    Ok(IntakeResult {
        created: true,
        manifest_path: manifest_path.to_string_lossy().to_string(),
        asset,
    })
}

fn read_optional_file(path: &Path) -> io::Result<String> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(error),
    }
}

fn rewrite_inbox_without(inbox_path: &Path, processed: &HashSet<&str>) -> io::Result<()> {
    let raw = read_optional_file(inbox_path)?;
    let mut remaining = Vec::new();

    for line in raw.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        let parsed = match serde_json::from_str::<Value>(trimmed) {
            Ok(value) => value,
            Err(_) => {
                remaining.push(trimmed.to_string());
                continue;
            }
        };

        match string_field(&parsed, "requestId") {
            Some(request_id) if processed.contains(request_id.as_str()) => {}
            _ => remaining.push(trimmed.to_string()),
        }
    }

    if let Some(parent) = inbox_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let next_content = if remaining.is_empty() {
        String::new()
    } else {
        format!("{}\n", remaining.join("\n"))
    };
    fs::write(inbox_path, next_content)
}

fn manifest_path_for(vault_dir: &Path) -> PathBuf {
    vault_dir.join(".htmlvault").join("manifest.json")
}

fn read_manifest(manifest_path: &Path) -> Result<Value, String> {
    match fs::read_to_string(manifest_path) {
        Ok(content) => serde_json::from_str(&content).map_err(|error| error.to_string()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let now = timestamp_string();
            Ok(json!({
                "schemaVersion": 1,
                "createdAt": now,
                "updatedAt": now,
                "assets": []
            }))
        }
        Err(error) => Err(error.to_string()),
    }
}

fn write_manifest(manifest_path: &Path, manifest: &Value) -> Result<(), String> {
    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_path = manifest_path.with_extension("json.tmp");
    let serialized = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(&temp_path, format!("{serialized}\n")).map_err(|error| error.to_string())?;
    fs::rename(temp_path, manifest_path).map_err(|error| error.to_string())
}

fn asset_from_request(request: &Value, dedupe_key: &str, now: &str) -> Result<Value, String> {
    let request_type = required_string(request, "type")?;
    let request_id = required_string(request, "requestId")?;
    let service = request.get("service");
    let service_title = service.and_then(|value| string_field(value, "title"));
    let service_cwd = service.and_then(|value| string_field(value, "cwd"));
    let source_path = string_field(request, "sourcePath").or(service_cwd);
    let title = string_field(request, "title")
        .or(service_title)
        .or_else(|| source_path.as_ref().and_then(|value| Path::new(value).file_name().map(|name| name.to_string_lossy().to_string())))
        .unwrap_or_else(|| request_id.clone());
    let kind = if request_type == "registerWebService" {
        "service"
    } else {
        "html-note"
    };
    let tags = request.get("tags").cloned().unwrap_or_else(|| json!([]));

    Ok(json!({
        "id": asset_id_for(dedupe_key),
        "kind": kind,
        "title": title,
        "source": "bridge",
        "sourcePath": source_path,
        "sourceHash": string_field(request, "sourceHash"),
        "tags": tags,
        "dedupeKey": dedupe_key,
        "requestId": request_id,
        "sourceAgent": string_field(request, "sourceAgent"),
        "createdAt": now,
        "updatedAt": now
    }))
}

fn verify_source_hash(request: &Value) -> Result<(), String> {
    let Some(source_path) = string_field(request, "sourcePath") else {
        return Ok(());
    };
    let Some(expected_hash) = string_field(request, "sourceHash") else {
        return Ok(());
    };

    let bytes = fs::read(&source_path).map_err(|error| error.to_string())?;
    let actual_hash = format!("sha256:{}", hex_sha256(&bytes));

    if actual_hash != expected_hash {
        return Err(format!("Source hash mismatch for {source_path}"));
    }

    Ok(())
}

fn asset_id_for(dedupe_key: &str) -> String {
    format!("asset_{}", &hex_sha256(dedupe_key.as_bytes())[0..16])
}

fn hex_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn required_string(value: &Value, key: &str) -> Result<String, String> {
    string_field(value, key).ok_or_else(|| format!("Missing {key}"))
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn timestamp_string() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    format!("unix:{seconds}")
}
