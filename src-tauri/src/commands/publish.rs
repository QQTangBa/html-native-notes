use crate::commands::inbox::DesktopState;
use crate::core::publish::{publish_vault_static, StaticPublishResult};
use tauri::State;

#[tauri::command]
pub async fn publish_static(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<StaticPublishResult, String> {
    publish_vault_static(&state.vault_dir, &asset_id)
}
