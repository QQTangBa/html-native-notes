use crate::core::vault::read_vault_asset_source;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
struct HtmlReference {
    kind: String,
    reference: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopiedExportAsset {
    pub kind: String,
    pub reference: String,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkippedExportResource {
    pub kind: String,
    pub reference: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticPackageExportResult {
    pub asset_id: String,
    pub export_type: String,
    pub output_dir: String,
    pub index_path: String,
    pub manifest_path: String,
    pub copied_assets: Vec<CopiedExportAsset>,
    pub skipped_external: Vec<SkippedExportResource>,
    pub source_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownExportResult {
    pub asset_id: String,
    pub export_type: String,
    pub output_path: String,
    pub source_hash: String,
}

pub fn export_vault_static_package(vault_dir: &Path, asset_id: &str) -> Result<StaticPackageExportResult, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let output_dir = vault_dir
        .join(".htmlvault")
        .join("exports")
        .join(&source.asset_id)
        .join("latest");
    let index_path = output_dir.join("index.html");
    let manifest_path = output_dir.join("manifest.json");
    let source_dir = Path::new(&source.source_path)
        .parent()
        .ok_or_else(|| "Source path must have a parent directory".to_string())?;
    let mut copied_assets = Vec::new();
    let mut skipped_external = Vec::new();

    if output_dir.exists() {
        fs::remove_dir_all(&output_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    fs::write(&index_path, &source.html).map_err(|error| error.to_string())?;

    for reference in collect_references(&source.html) {
        if is_external(&reference.reference) {
            skipped_external.push(SkippedExportResource {
                kind: reference.kind,
                reference: reference.reference,
            });
            continue;
        }

        if let Some(copied) = copy_local_reference(source_dir, &output_dir, &reference)? {
            copied_assets.push(copied);
        }
    }

    let result = StaticPackageExportResult {
        asset_id: source.asset_id.clone(),
        export_type: "static-package".to_string(),
        output_dir: output_dir.to_string_lossy().to_string(),
        index_path: index_path.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        copied_assets,
        skipped_external,
        source_hash: source_hash(source.html.as_bytes()),
    };
    let manifest = json!({
        "assetId": &result.asset_id,
        "exportType": &result.export_type,
        "outputDir": &result.output_dir,
        "indexPath": &result.index_path,
        "manifestPath": &result.manifest_path,
        "copiedAssets": &result.copied_assets,
        "skippedExternal": &result.skipped_external,
        "sourceHash": &result.source_hash,
        "title": source.title,
        "sourcePath": source.source_path,
        "createdAt": unix_timestamp(),
    });

    fs::write(
        &manifest_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?
        ),
    )
    .map_err(|error| error.to_string())?;

    Ok(result)
}

pub fn export_vault_markdown(vault_dir: &Path, asset_id: &str) -> Result<MarkdownExportResult, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let output_dir = vault_dir.join(".htmlvault").join("exports").join(&source.asset_id);
    let output_path = output_dir.join(format!("{}.md", safe_file_name(&source.title, &source.asset_id)));
    let markdown = html_to_markdown(&source.html, &source.title);

    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    fs::write(&output_path, markdown).map_err(|error| error.to_string())?;

    Ok(MarkdownExportResult {
        asset_id: source.asset_id,
        export_type: "markdown".to_string(),
        output_path: output_path.to_string_lossy().to_string(),
        source_hash: source_hash(source.html.as_bytes()),
    })
}

fn collect_references(html: &str) -> Vec<HtmlReference> {
    let mut references = Vec::new();

    collect_tag_attribute(html, "img", "src", "image", &mut references);
    collect_tag_attribute(html, "script", "src", "script", &mut references);
    collect_stylesheet_links(html, &mut references);

    references
}

fn collect_tag_attribute(html: &str, tag_name: &str, attr_name: &str, kind: &str, references: &mut Vec<HtmlReference>) {
    for tag in find_opening_tags(html, tag_name) {
        if let Some(reference) = attribute_value(&tag, attr_name) {
            references.push(HtmlReference {
                kind: kind.to_string(),
                reference,
            });
        }
    }
}

fn collect_stylesheet_links(html: &str, references: &mut Vec<HtmlReference>) {
    for tag in find_opening_tags(html, "link") {
        if !tag.to_lowercase().contains("stylesheet") {
            continue;
        }
        if let Some(reference) = attribute_value(&tag, "href") {
            references.push(HtmlReference {
                kind: "stylesheet".to_string(),
                reference,
            });
        }
    }
}

fn copy_local_reference(
    source_dir: &Path,
    output_dir: &Path,
    reference: &HtmlReference,
) -> Result<Option<CopiedExportAsset>, String> {
    let clean_reference = strip_reference_suffix(&reference.reference);
    if clean_reference.is_empty()
        || Path::new(&clean_reference).is_absolute()
        || is_external(&clean_reference)
    {
        return Ok(None);
    }

    let source_path = source_dir.join(&clean_reference);
    if !is_inside(source_dir, &source_path) || !source_path.is_file() {
        return Ok(None);
    }

    let output_path = output_dir.join(&clean_reference);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(&source_path, &output_path).map_err(|error| error.to_string())?;

    Ok(Some(CopiedExportAsset {
        kind: reference.kind.clone(),
        reference: reference.reference.clone(),
        output_path: output_path.to_string_lossy().to_string(),
    }))
}

fn html_to_markdown(html: &str, title: &str) -> String {
    let mut markdown = readable_text(html).join("\n\n");
    if !markdown.starts_with("# ") {
        markdown = format!("# {title}\n\n{markdown}");
    }
    format!("{}\n", markdown.trim())
}

fn readable_text(html: &str) -> Vec<String> {
    let without_scripts = remove_tag_blocks(html, "script");
    let without_styles = remove_tag_blocks(&without_scripts, "style");
    let mut text = without_styles
        .replace("</h1>", "\n\n")
        .replace("<h1>", "# ")
        .replace("</h2>", "\n\n")
        .replace("<h2>", "## ")
        .replace("</h3>", "\n\n")
        .replace("<h3>", "### ")
        .replace("<li>", "- ")
        .replace("</li>", "\n")
        .replace("</p>", "\n\n")
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">");

    while let Some(start) = text.find('<') {
        let Some(end) = text[start..].find('>') else {
            break;
        };
        text.replace_range(start..=start + end, "");
    }

    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn remove_tag_blocks(html: &str, tag: &str) -> String {
    let mut output = html.to_string();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");

    while let Some(start) = output.to_lowercase().find(&open) {
        let lower = output.to_lowercase();
        let Some(end_relative) = lower[start..].find(&close) else {
            break;
        };
        let end = start + end_relative + close.len();
        output.replace_range(start..end, "");
    }

    output
}

fn find_opening_tags(html: &str, tag_name: &str) -> Vec<String> {
    let lower = html.to_lowercase();
    let needle = format!("<{tag_name}");
    let mut tags = Vec::new();
    let mut offset = 0;

    while let Some(relative_start) = lower[offset..].find(&needle) {
        let start = offset + relative_start;
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

fn strip_reference_suffix(reference: &str) -> String {
    reference
        .split('#')
        .next()
        .unwrap_or(reference)
        .split('?')
        .next()
        .unwrap_or(reference)
        .to_string()
}

fn is_external(reference: &str) -> bool {
    let lower = reference.to_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("//")
        || lower.starts_with("data:")
        || lower.starts_with("file://")
}

fn is_inside(parent_path: &Path, child_path: &Path) -> bool {
    child_path
        .strip_prefix(parent_path)
        .map(|relative| !relative.as_os_str().is_empty())
        .unwrap_or(false)
}

fn safe_file_name(value: &str, fallback: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.trim().is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

fn source_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();

    format!("sha256:{hex}")
}

fn unix_timestamp() -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    format!("unix:{millis}")
}
