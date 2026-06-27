mod commands;
mod core;

use commands::inbox::DesktopState;
use tauri::Manager;

#[tauri::command]
fn app_health() -> &'static str {
    "HTML Native Notes desktop shell ok"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = DesktopState::from_app(app.handle()).map_err(|error| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(std::io::ErrorKind::Other, error))
            })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_health,
            commands::vault::vault_list_library,
            commands::vault::vault_get_asset_source,
            commands::version_store::vault_list_versions,
            commands::version_store::vault_create_version_snapshot,
            commands::version_store::vault_diff_versions,
            commands::version_store::vault_rollback_version,
            commands::importer::import_scan_candidates,
            commands::profile::profile_build,
            commands::profile::profile_embed,
            commands::profile::profile_extract,
            commands::profile::profile_migrate,
            commands::asset_scan::asset_scan_integrity,
            commands::exporter::export_static_package,
            commands::exporter::export_markdown,
            commands::publish::publish_static,
            commands::service_runtime::service_check_health,
            commands::service_runtime::service_start,
            commands::service_runtime::service_stop,
            commands::notes::note_list,
            commands::notes::note_create,
            commands::notes::note_get,
            commands::notes::note_save_content,
            commands::notes::note_duplicate,
            commands::notes::note_delete,
            commands::source_guard::source_guard_review_write,
            commands::source_guard::source_guard_apply_write_decision,
            commands::inbox::inbox_list_requests,
            commands::inbox::inbox_confirm_request,
            commands::inbox::inbox_dismiss_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running HTML Native Notes desktop shell");
}
