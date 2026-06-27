use crate::core::importer::{scan_import_candidates, ImportScanResult};
use tauri::State;

use crate::commands::inbox::DesktopState;

#[tauri::command]
pub async fn import_scan_candidates(
    _state: State<'_, DesktopState>,
    root_path: String,
) -> Result<ImportScanResult, String> {
    scan_import_candidates(std::path::Path::new(&root_path))
}
