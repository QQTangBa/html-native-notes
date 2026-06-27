use crate::core::vault::read_vault_asset_source;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionSnapshot {
    snapshot_id: String,
    asset_id: String,
    reason: String,
    created_at: String,
    content_hash: String,
    content_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicVersionSnapshot {
    pub snapshot_id: String,
    pub asset_id: String,
    pub reason: String,
    pub created_at: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultVersionsResponse {
    pub snapshots: Vec<PublicVersionSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffSection {
    pub added: Vec<String>,
    pub removed: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedTitle {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DomSummary {
    pub added_tags: Vec<String>,
    pub removed_tags: Vec<String>,
    pub changed_title: Option<ChangedTitle>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDiff {
    pub source: DiffSection,
    pub content: DiffSection,
    pub dom_summary: DomSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultVersionRollbackResponse {
    pub asset_id: String,
    pub snapshot_id: String,
    pub restored_hash: String,
}

pub fn list_vault_versions(vault_dir: &Path, asset_id: &str) -> Result<VaultVersionsResponse, String> {
    Ok(VaultVersionsResponse {
        snapshots: list_version_snapshots(vault_dir, asset_id)?
            .into_iter()
            .map(PublicVersionSnapshot::from)
            .collect(),
    })
}

pub fn create_vault_version_snapshot(
    vault_dir: &Path,
    asset_id: &str,
    reason: String,
) -> Result<PublicVersionSnapshot, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let source_path =
        ensure_existing_vault_path(vault_dir, Path::new(&source.source_path), "Source path escapes Vault")?;
    let content = fs::read_to_string(&source_path).map_err(|error| error.to_string())?;
    let content_hash = content_hash(content.as_bytes());
    let snapshot_id = snapshot_id_for(&content_hash, &reason);
    let dir = version_dir(vault_dir, asset_id)?;
    let content_path = dir.join(format!("{snapshot_id}.html"));
    let snapshot = VersionSnapshot {
        snapshot_id,
        asset_id: asset_id.to_string(),
        reason,
        created_at: unix_timestamp(),
        content_hash,
        content_path: content_path.to_string_lossy().to_string(),
    };
    let mut snapshots = list_version_snapshots(vault_dir, asset_id)?;

    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    fs::write(&content_path, content).map_err(|error| error.to_string())?;
    snapshots.push(snapshot.clone());
    write_snapshots(vault_dir, asset_id, &snapshots)?;

    Ok(PublicVersionSnapshot::from(snapshot))
}

pub fn diff_vault_versions(
    vault_dir: &Path,
    asset_id: &str,
    from_snapshot_id: &str,
    to_snapshot_id: &str,
) -> Result<VersionDiff, String> {
    let from_snapshot = find_snapshot(vault_dir, asset_id, from_snapshot_id)?;
    let to_snapshot = find_snapshot(vault_dir, asset_id, to_snapshot_id)?;
    let from = read_snapshot_content(vault_dir, asset_id, &from_snapshot)?;
    let to = read_snapshot_content(vault_dir, asset_id, &to_snapshot)?;

    Ok(VersionDiff {
        source: line_diff(&from, &to),
        content: text_diff(readable_text(&from), readable_text(&to)),
        dom_summary: dom_summary(&from, &to),
    })
}

pub fn rollback_vault_version(
    vault_dir: &Path,
    asset_id: &str,
    snapshot_id: &str,
) -> Result<VaultVersionRollbackResponse, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let source_path =
        ensure_existing_vault_path(vault_dir, Path::new(&source.source_path), "Source path escapes Vault")?;
    let snapshot = find_snapshot(vault_dir, asset_id, snapshot_id)?;
    let content = read_snapshot_content(vault_dir, asset_id, &snapshot)?;

    fs::write(&source_path, &content).map_err(|error| error.to_string())?;

    Ok(VaultVersionRollbackResponse {
        asset_id: asset_id.to_string(),
        snapshot_id: snapshot_id.to_string(),
        restored_hash: content_hash(content.as_bytes()),
    })
}

impl From<VersionSnapshot> for PublicVersionSnapshot {
    fn from(snapshot: VersionSnapshot) -> Self {
        Self {
            snapshot_id: snapshot.snapshot_id,
            asset_id: snapshot.asset_id,
            reason: snapshot.reason,
            created_at: snapshot.created_at,
            content_hash: snapshot.content_hash,
        }
    }
}

fn version_dir(vault_dir: &Path, asset_id: &str) -> Result<PathBuf, String> {
    assert_safe_asset_id(asset_id)?;
    Ok(vault_dir.join(".htmlvault").join("versions").join(asset_id))
}

fn snapshot_index_path(vault_dir: &Path, asset_id: &str) -> Result<PathBuf, String> {
    Ok(version_dir(vault_dir, asset_id)?.join("snapshots.json"))
}

fn list_version_snapshots(vault_dir: &Path, asset_id: &str) -> Result<Vec<VersionSnapshot>, String> {
    let index_path = snapshot_index_path(vault_dir, asset_id)?;
    match fs::read_to_string(index_path) {
        Ok(content) => serde_json::from_str(&content).map_err(|error| error.to_string()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn write_snapshots(vault_dir: &Path, asset_id: &str, snapshots: &[VersionSnapshot]) -> Result<(), String> {
    let index_path = snapshot_index_path(vault_dir, asset_id)?;
    let temp_path = index_path.with_extension("json.tmp");
    let parent = index_path
        .parent()
        .ok_or_else(|| "Version index path must have a parent directory".to_string())?;
    let content = serde_json::to_string_pretty(snapshots).map_err(|error| error.to_string())?;

    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    fs::write(&temp_path, format!("{content}\n")).map_err(|error| error.to_string())?;
    fs::rename(temp_path, index_path).map_err(|error| error.to_string())
}

fn find_snapshot(vault_dir: &Path, asset_id: &str, snapshot_id: &str) -> Result<VersionSnapshot, String> {
    list_version_snapshots(vault_dir, asset_id)?
        .into_iter()
        .find(|snapshot| snapshot.snapshot_id == snapshot_id)
        .ok_or_else(|| format!("Snapshot not found: {snapshot_id}"))
}

fn read_snapshot_content(vault_dir: &Path, asset_id: &str, snapshot: &VersionSnapshot) -> Result<String, String> {
    let canonical_version_dir = version_dir(vault_dir, asset_id)?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let canonical_content_path = Path::new(&snapshot.content_path)
        .canonicalize()
        .map_err(|error| error.to_string())?;

    if !canonical_content_path.starts_with(&canonical_version_dir) {
        return Err("Snapshot content path is outside the asset version directory".to_string());
    }

    fs::read_to_string(canonical_content_path).map_err(|error| error.to_string())
}

fn assert_safe_asset_id(asset_id: &str) -> Result<(), String> {
    let suffix = asset_id.strip_prefix("asset_").ok_or_else(|| "Invalid asset id".to_string())?;
    if suffix.is_empty() || !suffix.chars().all(|item| item.is_ascii_alphanumeric() || item == '_' || item == '-') {
        return Err("Invalid asset id".to_string());
    }
    Ok(())
}

fn ensure_existing_vault_path(vault_dir: &Path, target_path: &Path, escape_message: &str) -> Result<PathBuf, String> {
    let canonical_vault = vault_dir.canonicalize().map_err(|error| error.to_string())?;
    let canonical_target = target_path.canonicalize().map_err(|error| error.to_string())?;

    if !canonical_target.starts_with(&canonical_vault) {
        return Err(escape_message.to_string());
    }

    Ok(canonical_target)
}

fn line_diff(from: &str, to: &str) -> DiffSection {
    let from_tokens = source_tokens(from);
    let to_tokens = source_tokens(to);
    let from_set = from_tokens.iter().cloned().collect::<BTreeSet<_>>();
    let to_set = to_tokens.iter().cloned().collect::<BTreeSet<_>>();

    DiffSection {
        added: to_tokens
            .into_iter()
            .filter(|line| !from_set.contains(line))
            .collect(),
        removed: from_tokens
            .into_iter()
            .filter(|line| !to_set.contains(line))
            .collect(),
    }
}

fn source_tokens(html: &str) -> Vec<String> {
    html.replace("><", ">\n<")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn readable_text(html: &str) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    let mut in_tag = false;

    for character in html.chars() {
        match character {
            '<' => {
                if !current.trim().is_empty() {
                    lines.push(current.trim().to_string());
                }
                current.clear();
                in_tag = true;
            }
            '>' => in_tag = false,
            _ if !in_tag => current.push(character),
            _ => {}
        }
    }

    if !current.trim().is_empty() {
        lines.push(current.trim().to_string());
    }

    lines
}

fn text_diff(from: Vec<String>, to: Vec<String>) -> DiffSection {
    let from_set = from.iter().cloned().collect::<BTreeSet<_>>();
    let to_set = to.iter().cloned().collect::<BTreeSet<_>>();

    DiffSection {
        added: to.into_iter().filter(|line| !from_set.contains(line)).collect(),
        removed: from.into_iter().filter(|line| !to_set.contains(line)).collect(),
    }
}

fn dom_summary(from: &str, to: &str) -> DomSummary {
    let from_tags = tag_counts(from);
    let to_tags = tag_counts(to);
    let added_tags = to_tags
        .iter()
        .filter(|(tag, count)| **count > *from_tags.get(*tag).unwrap_or(&0))
        .map(|(tag, _)| tag.clone())
        .collect();
    let removed_tags = from_tags
        .iter()
        .filter(|(tag, count)| **count > *to_tags.get(*tag).unwrap_or(&0))
        .map(|(tag, _)| tag.clone())
        .collect();
    let from_title = title_of(from);
    let to_title = title_of(to);

    DomSummary {
        added_tags,
        removed_tags,
        changed_title: match (from_title, to_title) {
            (Some(from), Some(to)) if from != to => Some(ChangedTitle { from, to }),
            _ => None,
        },
    }
}

fn tag_counts(html: &str) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::<String, usize>::new();
    let mut chars = html.chars().peekable();

    while let Some(character) = chars.next() {
        if character != '<' || matches!(chars.peek().copied(), Some('/') | Some('!')) {
            continue;
        }

        let mut tag = String::new();
        while let Some(next) = chars.peek() {
            if next.is_ascii_alphanumeric() || *next == '-' {
                tag.push(next.to_ascii_lowercase());
                chars.next();
            } else {
                break;
            }
        }

        if !tag.is_empty() {
            *counts.entry(tag).or_default() += 1;
        }
    }

    counts
}

fn title_of(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let open_start = lower.find("<title")?;
    let open_end = lower[open_start..].find('>')? + open_start + 1;
    let close_start = lower[open_end..].find("</title>")? + open_end;

    Some(html[open_end..close_start].trim().to_string())
}

fn snapshot_id_for(content_hash: &str, reason: &str) -> String {
    let seed = format!("{reason}:{content_hash}:{}", unix_timestamp());
    let hex = hex_sha256(seed.as_bytes());

    format!("snap_{}", &hex[..16])
}

fn content_hash(bytes: &[u8]) -> String {
    format!("sha256:{}", hex_sha256(bytes))
}

fn hex_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn unix_timestamp() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    format!("unix:{millis}")
}
