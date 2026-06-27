use crate::commands::inbox::DesktopState;
use crate::core::version_store::{
    create_vault_version_snapshot, diff_vault_versions, list_vault_versions, rollback_vault_version,
    PublicVersionSnapshot, VaultVersionRollbackResponse, VaultVersionsResponse, VersionDiff,
};
use tauri::State;

#[tauri::command]
pub async fn vault_list_versions(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<VaultVersionsResponse, String> {
    list_vault_versions(&state.vault_dir, &asset_id)
}

#[tauri::command]
pub async fn vault_create_version_snapshot(
    state: State<'_, DesktopState>,
    asset_id: String,
    reason: String,
) -> Result<PublicVersionSnapshot, String> {
    create_vault_version_snapshot(&state.vault_dir, &asset_id, reason)
}

#[tauri::command]
pub async fn vault_diff_versions(
    state: State<'_, DesktopState>,
    asset_id: String,
    from_snapshot_id: String,
    to_snapshot_id: String,
) -> Result<VersionDiff, String> {
    diff_vault_versions(&state.vault_dir, &asset_id, &from_snapshot_id, &to_snapshot_id)
}

#[tauri::command]
pub async fn vault_rollback_version(
    state: State<'_, DesktopState>,
    asset_id: String,
    snapshot_id: String,
) -> Result<VaultVersionRollbackResponse, String> {
    rollback_vault_version(&state.vault_dir, &asset_id, &snapshot_id)
}
