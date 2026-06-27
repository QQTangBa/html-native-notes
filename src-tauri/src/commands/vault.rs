use crate::commands::inbox::DesktopState;
use crate::core::vault::{
    list_vault_library, read_vault_asset_source, VaultAssetSourceResponse, VaultLibraryFilters,
    VaultLibraryResponse,
};
use tauri::State;

#[tauri::command]
pub async fn vault_list_library(
    state: State<'_, DesktopState>,
    filters: Option<VaultLibraryFilters>,
) -> Result<VaultLibraryResponse, String> {
    list_vault_library(&state.vault_dir, filters.unwrap_or_default())
}

#[tauri::command]
pub async fn vault_get_asset_source(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<VaultAssetSourceResponse, String> {
    read_vault_asset_source(&state.vault_dir, &asset_id)
}
