use crate::commands::inbox::DesktopState;
use crate::core::notes::{
    create_note, delete_note, duplicate_note, get_note, list_notes, save_note_content,
    CreateNoteInput, NoteContentInput, NoteMeta, NoteRecord,
};
use tauri::State;

#[tauri::command]
pub async fn note_list(state: State<'_, DesktopState>) -> Result<Vec<NoteMeta>, String> {
    list_notes(&state.vault_dir)
}

#[tauri::command]
pub async fn note_create(
    state: State<'_, DesktopState>,
    input: CreateNoteInput,
) -> Result<NoteMeta, String> {
    create_note(&state.vault_dir, input)
}

#[tauri::command]
pub async fn note_get(state: State<'_, DesktopState>, id: String) -> Result<NoteRecord, String> {
    get_note(&state.vault_dir, &id)
}

#[tauri::command]
pub async fn note_save_content(
    state: State<'_, DesktopState>,
    id: String,
    content: String,
) -> Result<NoteMeta, String> {
    save_note_content(&state.vault_dir, &id, content)
}

#[tauri::command]
pub async fn note_duplicate(
    state: State<'_, DesktopState>,
    id: String,
) -> Result<NoteMeta, String> {
    duplicate_note(&state.vault_dir, &id)
}

#[tauri::command]
pub async fn note_delete(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    delete_note(&state.vault_dir, &id)
}

#[allow(dead_code)]
fn _note_content_input_contract(input: NoteContentInput) -> String {
    input.content
}
