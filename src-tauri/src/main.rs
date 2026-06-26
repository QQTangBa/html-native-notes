#[tauri::command]
fn app_health() -> &'static str {
    "HTML Native Notes desktop shell ok"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_health])
        .run(tauri::generate_context!())
        .expect("error while running HTML Native Notes desktop shell");
}

fn main() {
    run();
}
