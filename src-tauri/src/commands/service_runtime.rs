use crate::commands::inbox::DesktopState;
use crate::core::service_runtime::{
    check_service_health, start_service, stop_service, ServiceRuntimeResult,
};
use tauri::State;

#[tauri::command]
pub async fn service_check_health(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<ServiceRuntimeResult, String> {
    check_service_health(&state.vault_dir, &asset_id)
}

#[tauri::command]
pub async fn service_start(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<ServiceRuntimeResult, String> {
    start_service(&state.vault_dir, &asset_id)
}

#[tauri::command]
pub async fn service_stop(
    state: State<'_, DesktopState>,
    asset_id: String,
) -> Result<ServiceRuntimeResult, String> {
    stop_service(&state.vault_dir, &asset_id)
}
