use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    pub kind: String,
    pub title: String,
    pub source_path: String,
    pub relative_path: String,
    pub source_hash: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanResult {
    pub root_path: String,
    pub candidates: Vec<ImportCandidate>,
    pub skipped_dirs: Vec<String>,
}

pub fn scan_import_candidates(root_path: &Path) -> Result<ImportScanResult, String> {
    let root_path = root_path
        .canonicalize()
        .map_err(|error| format!("Import root is not readable: {error}"))?;
    let mut candidates = Vec::new();
    let mut skipped_dirs = Vec::new();

    walk_import_root(&root_path, &root_path, &mut candidates, &mut skipped_dirs)?;
    candidates.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    Ok(ImportScanResult {
        root_path: root_path.to_string_lossy().to_string(),
        candidates,
        skipped_dirs,
    })
}

fn walk_import_root(
    root_path: &Path,
    current_path: &Path,
    candidates: &mut Vec<ImportCandidate>,
    skipped_dirs: &mut Vec<String>,
) -> Result<(), String> {
    let entries = fs::read_dir(current_path).map_err(|error| error.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if should_skip_dir(&file_name) {
                skipped_dirs.push(relative_path(root_path, &path));
                continue;
            }

            if path.join("package.json").is_file() {
                candidates.push(service_candidate(root_path, &path)?);
            } else if path.join("index.html").is_file() {
                candidates.push(project_candidate(root_path, &path.join("index.html"))?);
            }

            walk_import_root(root_path, &path, candidates, skipped_dirs)?;
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let lower_name = file_name.to_lowercase();
        if lower_name.ends_with(".html") || lower_name.ends_with(".htm") {
            candidates.push(html_candidate(root_path, &path)?);
        } else if lower_name.ends_with(".md") || lower_name.ends_with(".markdown") {
            candidates.push(markdown_candidate(root_path, &path)?);
        }
    }

    Ok(())
}

fn html_candidate(root_path: &Path, source_path: &Path) -> Result<ImportCandidate, String> {
    Ok(ImportCandidate {
        kind: "html-note".to_string(),
        title: title_from_file(source_path),
        source_path: source_path.to_string_lossy().to_string(),
        relative_path: relative_path(root_path, source_path),
        source_hash: Some(sha256_file(source_path)?),
        warnings: Vec::new(),
    })
}

fn markdown_candidate(root_path: &Path, source_path: &Path) -> Result<ImportCandidate, String> {
    Ok(ImportCandidate {
        kind: "markdown-note".to_string(),
        title: title_from_file(source_path),
        source_path: source_path.to_string_lossy().to_string(),
        relative_path: relative_path(root_path, source_path),
        source_hash: Some(sha256_file(source_path)?),
        warnings: Vec::new(),
    })
}

fn project_candidate(root_path: &Path, index_path: &Path) -> Result<ImportCandidate, String> {
    Ok(ImportCandidate {
        kind: "project".to_string(),
        title: title_from_file(index_path.parent().unwrap_or(index_path)),
        source_path: index_path.to_string_lossy().to_string(),
        relative_path: relative_path(root_path, index_path),
        source_hash: Some(sha256_file(index_path)?),
        warnings: Vec::new(),
    })
}

fn service_candidate(root_path: &Path, service_dir: &Path) -> Result<ImportCandidate, String> {
    let package_path = service_dir.join("package.json");

    Ok(ImportCandidate {
        kind: "service".to_string(),
        title: title_from_file(service_dir),
        source_path: service_dir.to_string_lossy().to_string(),
        relative_path: relative_path(root_path, service_dir),
        source_hash: Some(sha256_file(&package_path)?),
        warnings: vec!["package.json service candidate needs start command review".to_string()],
    })
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".htmlvault" | "node_modules" | "dist" | "build" | "target" | ".next" | ".turbo"
    )
}

fn sha256_file(file_path: &Path) -> Result<String, String> {
    let bytes = fs::read(file_path).map_err(|error| error.to_string())?;
    let digest = Sha256::digest(&bytes);
    Ok(format!("sha256:{digest:x}"))
}

fn relative_path(root_path: &Path, path: &Path) -> String {
    path.strip_prefix(root_path)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn title_from_file(path: &Path) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .map(|value| value.to_string_lossy().replace(['-', '_'], " "))
        .unwrap_or_else(|| "Untitled".to_string())
}
