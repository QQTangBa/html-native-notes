mod commands;
mod core;

use commands::inbox::DesktopState;

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
            commands::inbox::inbox_list_requests,
            commands::inbox::inbox_confirm_request,
            commands::inbox::inbox_dismiss_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running HTML Native Notes desktop shell");
}

fn main() {
    run();
}
