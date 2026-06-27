use crate::commands::inbox::DesktopState;
use crate::core::source_guard::{
    apply_vault_write_decision, review_vault_asset_write, HtmlWriteReview, WriteDecision,
    WriteDecisionResult,
};
use tauri::State;

#[tauri::command]
pub async fn source_guard_review_write(
    state: State<'_, DesktopState>,
    asset_id: String,
    edited_html: String,
) -> Result<HtmlWriteReview, String> {
    review_vault_asset_write(&state.vault_dir, &asset_id, edited_html)
}

#[tauri::command]
pub async fn source_guard_apply_write_decision(
    state: State<'_, DesktopState>,
    asset_id: String,
    edited_html: String,
    decision: WriteDecision,
) -> Result<WriteDecisionResult, String> {
    apply_vault_write_decision(&state.vault_dir, &asset_id, edited_html, decision)
}
