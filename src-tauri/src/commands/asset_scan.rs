use crate::commands::inbox::DesktopState;
use crate::core::asset_scan::{scan_vault_asset_integrity, AssetIntegrityReport};
use tauri::State;

#[tauri::command]
pub async fn asset_scan_integrity(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<AssetIntegrityReport, String> {
    scan_vault_asset_integrity(&state.vault_dir, &asset_id)
}
