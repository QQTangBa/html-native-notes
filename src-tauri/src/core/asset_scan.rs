use crate::core::vault::read_vault_asset_source;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
struct Reference {
    kind: String,
    value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingAsset {
    pub kind: String,
    pub reference: String,
    pub resolved_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExternalResource {
    pub kind: String,
    pub reference: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DangerousScript {
    pub kind: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UnpublishableResource {
    pub kind: String,
    pub reference: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIntegrityReport {
    pub html_path: String,
    pub source_hash: String,
    pub missing_assets: Vec<MissingAsset>,
    pub external_resources: Vec<ExternalResource>,
    pub dangerous_scripts: Vec<DangerousScript>,
    pub unpublishable_resources: Vec<UnpublishableResource>,
    pub safe_mode_required: bool,
}

pub fn scan_vault_asset_integrity(vault_dir: &Path, asset_id: &str) -> Result<AssetIntegrityReport, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let html_path = ensure_existing_vault_path(
        vault_dir,
        Path::new(&source.source_path),
        "Asset scan target must stay inside the configured Vault",
    )?;

    scan_html_asset_integrity(&html_path)
}

fn scan_html_asset_integrity(html_path: &Path) -> Result<AssetIntegrityReport, String> {
    let html = fs::read_to_string(html_path).map_err(|error| error.to_string())?;
    let mut missing_assets = Vec::new();
    let mut external_resources = Vec::new();
    let mut unpublishable_resources = Vec::new();

    for reference in collect_references(&html) {
        if is_unpublishable(&reference.value) {
            unpublishable_resources.push(UnpublishableResource {
                kind: reference.kind,
                reference: reference.value,
                reason: "file:// resources cannot be published".to_string(),
            });
            continue;
        }

        if is_external(&reference.value) {
            external_resources.push(ExternalResource {
                kind: reference.kind,
                reference: reference.value,
            });
            continue;
        }

        if reference.kind == "link" {
            continue;
        }

        let resolved_path = resolve_local_reference(html_path, &reference.value);
        if !resolved_path.exists() {
            missing_assets.push(MissingAsset {
                kind: reference.kind,
                reference: reference.value,
                resolved_path: resolved_path.to_string_lossy().to_string(),
            });
        }
    }

    let dangerous_scripts = collect_dangerous_scripts(&html);
    let safe_mode_required = !missing_assets.is_empty()
        || !external_resources.is_empty()
        || !dangerous_scripts.is_empty()
        || !unpublishable_resources.is_empty();

    Ok(AssetIntegrityReport {
        html_path: html_path.to_string_lossy().to_string(),
        source_hash: source_hash(html.as_bytes()),
        missing_assets,
        external_resources,
        dangerous_scripts,
        unpublishable_resources,
        safe_mode_required,
    })
}

fn collect_references(html: &str) -> Vec<Reference> {
    let mut references = Vec::new();

    collect_tag_attribute(html, "img", "src", "image", &mut references);
    collect_tag_attribute(html, "script", "src", "script", &mut references);
    collect_stylesheet_links(html, &mut references);
    collect_tag_attribute(html, "a", "href", "link", &mut references);

    references
}

fn collect_tag_attribute(html: &str, tag_name: &str, attr_name: &str, kind: &str, references: &mut Vec<Reference>) {
    for tag in find_opening_tags(html, tag_name) {
        if let Some(value) = attribute_value(&tag, attr_name) {
            references.push(Reference {
                kind: kind.to_string(),
                value,
            });
        }
    }
}

fn collect_stylesheet_links(html: &str, references: &mut Vec<Reference>) {
    for tag in find_opening_tags(html, "link") {
        let lower = tag.to_lowercase();
        if !lower.contains("stylesheet") {
            continue;
        }
        if let Some(value) = attribute_value(&tag, "href") {
            references.push(Reference {
                kind: "stylesheet".to_string(),
                value,
            });
        }
    }
}

fn collect_dangerous_scripts(html: &str) -> Vec<DangerousScript> {
    find_opening_tags(html, "script")
        .into_iter()
        .filter(|tag| attribute_value(tag, "src").is_none())
        .map(|_| DangerousScript {
            kind: "inline-script".to_string(),
            reason: "Inline script execution is unsafe in static safe mode".to_string(),
        })
        .collect()
}

fn find_opening_tags(html: &str, tag_name: &str) -> Vec<String> {
    let lower = html.to_lowercase();
    let needle = format!("<{tag_name}");
    let mut tags = Vec::new();
    let mut offset = 0;

    while let Some(relative_start) = lower[offset..].find(&needle) {
        let start = offset + relative_start;
        let after_name = start + needle.len();
        if lower[after_name..]
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphanumeric() || character == '-')
        {
            offset = after_name;
            continue;
        }

        if let Some(relative_end) = lower[start..].find('>') {
            let end = start + relative_end + 1;
            tags.push(html[start..end].to_string());
            offset = end;
        } else {
            break;
        }
    }

    tags
}

fn attribute_value(tag: &str, attr_name: &str) -> Option<String> {
    let lower = tag.to_lowercase();
    let needle = format!("{attr_name}=");
    let start = lower.find(&needle)? + needle.len();
    let quote = tag[start..].chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let value_start = start + quote.len_utf8();
    let value_end = tag[value_start..].find(quote)? + value_start;

    Some(tag[value_start..value_end].trim().to_string())
}

fn resolve_local_reference(html_path: &Path, reference: &str) -> PathBuf {
    let clean_reference = reference
        .split('#')
        .next()
        .unwrap_or(reference)
        .split('?')
        .next()
        .unwrap_or(reference);
    let base_dir = html_path.parent().unwrap_or_else(|| Path::new(""));

    base_dir.join(clean_reference)
}

fn is_external(reference: &str) -> bool {
    let lower = reference.to_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

fn is_unpublishable(reference: &str) -> bool {
    reference.to_lowercase().starts_with("file://")
}

fn ensure_existing_vault_path(vault_dir: &Path, target_path: &Path, escape_message: &str) -> Result<PathBuf, String> {
    let canonical_vault = vault_dir.canonicalize().map_err(|error| error.to_string())?;
    let canonical_target = target_path.canonicalize().map_err(|error| error.to_string())?;

    if !canonical_target.starts_with(&canonical_vault) {
        return Err(escape_message.to_string());
    }

    Ok(canonical_target)
}

fn source_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();

    format!("sha256:{hex}")
}
