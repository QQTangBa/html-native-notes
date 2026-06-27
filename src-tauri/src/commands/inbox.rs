use crate::core::inbox::{
    acknowledge_inbox_requests, app_support_inbox_path, intake_inbox_request, read_inbox_requests,
    vault_inbox_path, InboxReadResult, IntakeResult,
};
use serde::Serialize;
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone)]
pub struct DesktopState {
    pub vault_dir: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxConfirmResponse {
    pub intake: IntakeResult,
    pub inbox: InboxReadResult,
}

impl DesktopState {
    pub fn from_app(app: &AppHandle) -> Result<Self, String> {
        let vault_dir = match env::var("VAULT_DIR") {
            Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
            _ => app
                .path()
                .app_data_dir()
                .map(|dir| dir.join("vault"))
                .map_err(|error| error.to_string())?,
        };

        Ok(Self { vault_dir })
    }
}

fn inbox_paths(app: &AppHandle, state: &DesktopState) -> Result<Vec<PathBuf>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;

    Ok(vec![
        app_support_inbox_path(&app_data_dir),
        vault_inbox_path(&state.vault_dir),
    ])
}

#[tauri::command]
pub async fn inbox_list_requests(app: AppHandle, state: State<'_, DesktopState>) -> Result<InboxReadResult, String> {
    read_inbox_requests(&inbox_paths(&app, state.inner())?)
}

#[tauri::command]
pub async fn inbox_confirm_request(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request_id: String,
) -> Result<InboxConfirmResponse, String> {
    let paths = inbox_paths(&app, state.inner())?;
    let inbox = read_inbox_requests(&paths)?;
    let request = inbox
        .requests
        .iter()
        .find(|item| item.get("requestId").and_then(|value| value.as_str()) == Some(request_id.as_str()))
        .ok_or_else(|| "Inbox request not found".to_string())?;
    let intake = intake_inbox_request(&state.vault_dir, request)?;

    acknowledge_inbox_requests(&paths, &[request_id])?;

    Ok(InboxConfirmResponse {
        intake,
        inbox: read_inbox_requests(&paths)?,
    })
}

#[tauri::command]
pub async fn inbox_dismiss_request(app: AppHandle, state: State<'_, DesktopState>, request_id: String) -> Result<InboxReadResult, String> {
    let paths = inbox_paths(&app, state.inner())?;

    acknowledge_inbox_requests(&paths, &[request_id])?;
    read_inbox_requests(&paths)
}
