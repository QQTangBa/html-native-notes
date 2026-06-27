use crate::core::vault::read_vault_asset_source;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlWriteReview {
    pub source_path: String,
    pub expected_source_hash: String,
    pub original_html: String,
    pub edited_html: String,
    pub status: String,
    pub diff: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum WriteDecision {
    Cancel {
        #[serde(rename = "saveAsPath")]
        save_as_path: Option<String>,
    },
    SaveAs {
        #[serde(rename = "saveAsPath")]
        save_as_path: String,
    },
    WriteBack,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteDecisionResult {
    pub action: String,
    pub output_path: Option<String>,
}

pub fn review_vault_asset_write(
    vault_dir: &Path,
    asset_id: &str,
    edited_html: String,
) -> Result<HtmlWriteReview, String> {
    let source = read_vault_asset_source(vault_dir, asset_id)?;
    let source_path =
        ensure_existing_vault_path(vault_dir, Path::new(&source.source_path), "Source path escapes Vault")?;

    Ok(review_html_write(
        source_path.to_string_lossy().to_string(),
        source.current_hash,
        source.html,
        edited_html,
    ))
}

pub fn apply_vault_write_decision(
    vault_dir: &Path,
    asset_id: &str,
    edited_html: String,
    decision: WriteDecision,
) -> Result<WriteDecisionResult, String> {
    let review = review_vault_asset_write(vault_dir, asset_id, edited_html)?;
    apply_write_decision(vault_dir, &review, decision)
}

fn review_html_write(
    source_path: String,
    expected_source_hash: String,
    original_html: String,
    edited_html: String,
) -> HtmlWriteReview {
    let changed = original_html != edited_html;

    HtmlWriteReview {
        source_path,
        expected_source_hash,
        original_html: original_html.clone(),
        edited_html: edited_html.clone(),
        status: if changed { "changed" } else { "unchanged" }.to_string(),
        diff: create_readable_diff(&original_html, &edited_html),
    }
}

fn apply_write_decision(
    vault_dir: &Path,
    review: &HtmlWriteReview,
    decision: WriteDecision,
) -> Result<WriteDecisionResult, String> {
    match decision {
        WriteDecision::Cancel { save_as_path: _ } => Ok(WriteDecisionResult {
            action: "cancel".to_string(),
            output_path: None,
        }),
        WriteDecision::SaveAs { save_as_path } => {
            let output_path = prepare_vault_save_as_path(vault_dir, Path::new(&save_as_path))?;
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&output_path, &review.edited_html).map_err(|error| error.to_string())?;
            Ok(WriteDecisionResult {
                action: "save-as".to_string(),
                output_path: Some(output_path.to_string_lossy().to_string()),
            })
        }
        WriteDecision::WriteBack => {
            let source_path = ensure_existing_vault_path(
                vault_dir,
                Path::new(&review.source_path),
                "Source path escapes Vault",
            )?;
            let current_hash = hash_file(&source_path)?;
            if current_hash != review.expected_source_hash {
                return Err(format!(
                    "Source changed before write-back: expected {}, received {}",
                    review.expected_source_hash, current_hash
                ));
            }
            fs::write(&source_path, &review.edited_html).map_err(|error| error.to_string())?;
            Ok(WriteDecisionResult {
                action: "write-back".to_string(),
                output_path: Some(source_path.to_string_lossy().to_string()),
            })
        }
    }
}

fn create_readable_diff(original_html: &str, edited_html: &str) -> String {
    if original_html == edited_html {
        return String::new();
    }

    let original_lines = split_lines(original_html);
    let edited_lines = split_lines(edited_html);
    let max_len = original_lines.len().max(edited_lines.len());
    let mut diff = Vec::new();

    for index in 0..max_len {
        let original_line = original_lines.get(index);
        let edited_line = edited_lines.get(index);

        if original_line == edited_line {
            if let Some(line) = original_line {
                diff.push(format!(" {line}"));
            }
            continue;
        }

        if let Some(line) = original_line {
            diff.push(format!("-{line}"));
        }
        if let Some(line) = edited_line {
            diff.push(format!("+{line}"));
        }
    }

    diff.join("\n")
}

fn split_lines(value: &str) -> Vec<&str> {
    value.strip_suffix('\n').unwrap_or(value).split('\n').collect()
}

fn hash_file(source_path: &Path) -> Result<String, String> {
    let bytes = fs::read(source_path).map_err(|error| error.to_string())?;
    let digest = Sha256::digest(bytes);
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();

    Ok(format!("sha256:{hex}"))
}

fn ensure_existing_vault_path(
    vault_dir: &Path,
    target_path: &Path,
    escape_message: &str,
) -> Result<PathBuf, String> {
    let canonical_vault = vault_dir.canonicalize().map_err(|error| error.to_string())?;
    let canonical_target = target_path.canonicalize().map_err(|error| error.to_string())?;

    if !canonical_target.starts_with(&canonical_vault) {
        return Err(escape_message.to_string());
    }

    Ok(canonical_target)
}

fn prepare_vault_save_as_path(vault_dir: &Path, target_path: &Path) -> Result<PathBuf, String> {
    if target_path.exists() {
        return Err("Save-as target already exists".to_string());
    }

    let parent = target_path
        .parent()
        .ok_or_else(|| "Save-as target must have a parent directory".to_string())?;
    let canonical_parent = ensure_existing_vault_path(vault_dir, parent, "Save-as path escapes Vault")?;
    let file_name = target_path
        .file_name()
        .ok_or_else(|| "Save-as target must include a file name".to_string())?;

    Ok(canonical_parent.join(file_name))
}
