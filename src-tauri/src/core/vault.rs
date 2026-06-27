use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultLibraryFilters {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub source_agent: Option<String>,
    pub kind: Option<String>,
    pub folder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultThumbnail {
    pub status: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultLibraryItem {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub source: String,
    pub source_agent: Option<String>,
    pub source_path: Option<String>,
    pub relative_source_path: Option<String>,
    pub folder_path: String,
    pub tags: Vec<String>,
    pub summary: String,
    pub updated_at: String,
    pub thumbnail: VaultThumbnail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFolderSummary {
    pub path: String,
    pub item_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultAvailableFilters {
    pub tags: Vec<String>,
    pub source_agents: Vec<String>,
    pub kinds: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultLibraryResponse {
    pub items: Vec<VaultLibraryItem>,
    pub folders: Vec<VaultFolderSummary>,
    pub available_filters: VaultAvailableFilters,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultAssetSourceResponse {
    pub asset_id: String,
    pub title: String,
    pub source_path: String,
    pub source_hash: Option<String>,
    pub current_hash: String,
    pub source_hash_matches: bool,
    pub html: String,
}

pub fn read_vault_manifest(vault_dir: &Path) -> Result<Value, String> {
    let manifest_path = vault_dir.join(".htmlvault").join("manifest.json");

    match fs::read_to_string(manifest_path) {
        Ok(content) => serde_json::from_str(&content).map_err(|error| error.to_string()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(json!({
            "schemaVersion": 1,
            "assets": []
        })),
        Err(error) => Err(error.to_string()),
    }
}

pub fn list_vault_library(vault_dir: &Path, filters: VaultLibraryFilters) -> Result<VaultLibraryResponse, String> {
    let manifest = read_vault_manifest(vault_dir)?;
    let assets = manifest
        .get("assets")
        .and_then(Value::as_array)
        .ok_or_else(|| "Invalid manifest assets".to_string())?;
    let mut items: Vec<VaultLibraryItem> = assets
        .iter()
        .map(|asset| asset_to_library_item(vault_dir, asset))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .filter(|item| matches_filters(item, &filters))
        .collect();

    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    let mut folder_counts = BTreeMap::<String, usize>::new();
    let mut tags = BTreeSet::<String>::new();
    let mut source_agents = BTreeSet::<String>::new();
    let mut kinds = BTreeSet::<String>::new();

    for item in &items {
        *folder_counts.entry(item.folder_path.clone()).or_default() += 1;
        kinds.insert(item.kind.clone());
        if let Some(source_agent) = &item.source_agent {
            source_agents.insert(source_agent.clone());
        }
        for tag in &item.tags {
            tags.insert(tag.clone());
        }
    }

    Ok(VaultLibraryResponse {
        items,
        folders: folder_counts
            .into_iter()
            .map(|(path, item_count)| VaultFolderSummary { path, item_count })
            .collect(),
        available_filters: VaultAvailableFilters {
            tags: tags.into_iter().collect(),
            source_agents: source_agents.into_iter().collect(),
            kinds: kinds.into_iter().collect(),
        },
    })
}

pub fn read_vault_asset_source(vault_dir: &Path, asset_id: &str) -> Result<VaultAssetSourceResponse, String> {
    let manifest = read_vault_manifest(vault_dir)?;
    let asset = manifest
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| assets.iter().find(|item| string_field(item, "id").as_deref() == Some(asset_id)))
        .ok_or_else(|| "Vault asset not found".to_string())?;
    let source_path = required_string(asset, "sourcePath")?;
    let html = fs::read_to_string(&source_path).map_err(|error| error.to_string())?;
    let current_hash = format!("sha256:{}", hex_sha256(html.as_bytes()));
    let source_hash = string_field(asset, "sourceHash");

    Ok(VaultAssetSourceResponse {
        asset_id: asset_id.to_string(),
        title: string_field(asset, "title").unwrap_or_else(|| asset_id.to_string()),
        source_path,
        source_hash: source_hash.clone(),
        source_hash_matches: source_hash.as_deref().map(|value| value == current_hash).unwrap_or(false),
        current_hash,
        html,
    })
}

fn asset_to_library_item(vault_dir: &Path, asset: &Value) -> Result<VaultLibraryItem, String> {
    let id = required_string(asset, "id")?;
    let kind = string_field(asset, "kind").unwrap_or_else(|| "html-note".to_string());
    let source_path = string_field(asset, "sourcePath");
    let relative_source_path = source_path.as_ref().map(|value| relative_source_path(vault_dir, value));
    let folder_path = relative_source_path
        .as_ref()
        .and_then(|value| Path::new(value).parent().map(|parent| parent.to_string_lossy().to_string()))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "root".to_string());
    let thumbnail_path = vault_dir
        .join(".htmlvault")
        .join("thumbnails")
        .join(format!("{id}.png"));

    Ok(VaultLibraryItem {
        id,
        kind,
        title: string_field(asset, "title").unwrap_or_else(|| "Untitled".to_string()),
        source: string_field(asset, "source").unwrap_or_else(|| "bridge".to_string()),
        source_agent: string_field(asset, "sourceAgent"),
        source_path,
        relative_source_path,
        folder_path,
        tags: string_array_field(asset, "tags"),
        summary: string_field(asset, "summary").unwrap_or_else(|| "Registered Vault asset".to_string()),
        updated_at: string_field(asset, "updatedAt").unwrap_or_else(|| "unix:0".to_string()),
        thumbnail: VaultThumbnail {
            status: if thumbnail_path.exists() { "ready" } else { "pending" }.to_string(),
            path: thumbnail_path.to_string_lossy().to_string(),
        },
    })
}

fn matches_filters(item: &VaultLibraryItem, filters: &VaultLibraryFilters) -> bool {
    if let Some(query) = filters.q.as_ref().map(|value| value.to_lowercase()).filter(|value| !value.is_empty()) {
        let haystack = format!(
            "{} {} {} {}",
            item.title,
            item.summary,
            item.relative_source_path.clone().unwrap_or_default(),
            item.tags.join(" ")
        )
        .to_lowercase();

        if !query.split_whitespace().all(|term| haystack.contains(term)) {
            return false;
        }
    }

    if filters.tag.as_ref().is_some_and(|tag| !item.tags.contains(tag)) {
        return false;
    }
    if filters.source_agent.as_ref().is_some_and(|source_agent| item.source_agent.as_ref() != Some(source_agent)) {
        return false;
    }
    if filters.kind.as_ref().is_some_and(|kind| &item.kind != kind) {
        return false;
    }
    if filters.folder.as_ref().is_some_and(|folder| &item.folder_path != folder) {
        return false;
    }

    true
}

fn relative_source_path(vault_dir: &Path, source_path: &str) -> String {
    let source = PathBuf::from(source_path);

    source
        .strip_prefix(vault_dir)
        .map(|relative| relative.to_string_lossy().trim_start_matches('/').to_string())
        .unwrap_or_else(|_| source.to_string_lossy().to_string())
}

fn required_string(value: &Value, key: &str) -> Result<String, String> {
    string_field(value, key).ok_or_else(|| format!("Missing {key}"))
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn string_array_field(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect())
        .unwrap_or_default()
}

fn hex_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}
