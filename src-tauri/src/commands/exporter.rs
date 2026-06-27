use crate::commands::inbox::DesktopState;
use crate::core::exporter::{
    export_vault_markdown, export_vault_static_package, MarkdownExportResult,
    StaticPackageExportResult,
};
use tauri::State;

#[tauri::command]
pub async fn export_static_package(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<StaticPackageExportResult, String> {
    export_vault_static_package(&state.vault_dir, &asset_id)
}

#[tauri::command]
pub async fn export_markdown(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<MarkdownExportResult, String> {
    export_vault_markdown(&state.vault_dir, &asset_id)
}
