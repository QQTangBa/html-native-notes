use crate::core::profile::{
    build_html_profile, embed_html_profile, extract_embedded_html_profile, migrate_html_profile,
    HtmlProfile,
};
use serde_json::Value;

#[tauri::command]
pub async fn profile_build(
    html: String,
    source_path: String,
    source_hash: String,
) -> Result<HtmlProfile, String> {
    Ok(build_html_profile(&html, &source_path, &source_hash))
}

#[tauri::command]
pub async fn profile_embed(html: String, profile: HtmlProfile) -> Result<String, String> {
    embed_html_profile(&html, &profile)
}

#[tauri::command]
pub async fn profile_extract(html: String) -> Result<Option<HtmlProfile>, String> {
    extract_embedded_html_profile(&html)
}

#[tauri::command]
pub async fn profile_migrate(value: Value) -> Result<HtmlProfile, String> {
    Ok(migrate_html_profile(value))
}
