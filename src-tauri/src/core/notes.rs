use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub file_name: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    pub wikilinks: Option<Vec<String>>,
    pub backlinks: Option<Vec<String>>,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteRecord {
    #[serde(flatten)]
    pub meta: NoteMeta,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateNoteInput {
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NoteContentInput {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MetadataFile {
    notes: Vec<NoteMeta>,
}

struct NoteStore {
    notes_dir: PathBuf,
    trash_dir: PathBuf,
    metadata_path: PathBuf,
}

pub fn list_notes(vault_dir: &Path) -> Result<Vec<NoteMeta>, String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.list_notes()
}

pub fn create_note(vault_dir: &Path, input: CreateNoteInput) -> Result<NoteMeta, String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.create_note(input)
}

pub fn get_note(vault_dir: &Path, id: &str) -> Result<NoteRecord, String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.get_note(id)
}

pub fn save_note_content(vault_dir: &Path, id: &str, content: String) -> Result<NoteMeta, String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.save_note_content(id, content)
}

pub fn duplicate_note(vault_dir: &Path, id: &str) -> Result<NoteMeta, String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.duplicate_note(id)
}

pub fn delete_note(vault_dir: &Path, id: &str) -> Result<(), String> {
    let store = NoteStore::new(vault_dir);
    store.init()?;
    store.delete_note(id)
}

impl NoteStore {
    fn new(vault_dir: &Path) -> Self {
        let data_dir = vault_dir.join(".htmlvault").join("notes-store");
        Self {
            notes_dir: data_dir.join("notes"),
            trash_dir: data_dir.join("trash"),
            metadata_path: data_dir.join("metadata.json"),
        }
    }

    fn init(&self) -> Result<(), String> {
        fs::create_dir_all(&self.notes_dir).map_err(|error| error.to_string())?;
        fs::create_dir_all(&self.trash_dir).map_err(|error| error.to_string())?;
        if !self.metadata_path.exists() {
            self.write_metadata(&MetadataFile { notes: Vec::new() })?;
        }
        Ok(())
    }

    fn list_notes(&self) -> Result<Vec<NoteMeta>, String> {
        let metadata = self.read_metadata()?;
        let mut notes = self.hydrate_note_graph(
            metadata
                .notes
                .into_iter()
                .filter(|note| !note.archived)
                .collect(),
        )?;

        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(notes)
    }

    fn create_note(&self, input: CreateNoteInput) -> Result<NoteMeta, String> {
        let mut metadata = self.read_metadata()?;
        let now = unix_timestamp();
        let id_seed = unix_nanos();
        let title = trimmed_or_default(&input.title, "Untitled note");
        let slug = slugify(&title);
        let id = format!("note_{id_seed}");
        let file_name = format!("{slug}-{id_seed}.html");
        let note = NoteMeta {
            id,
            title: title.clone(),
            slug,
            file_name,
            created_at: now.clone(),
            updated_at: now,
            tags: input.tags.unwrap_or_default(),
            wikilinks: None,
            backlinks: None,
            archived: false,
        };

        self.write_note_file(&note.file_name, &input.content.unwrap_or_else(|| default_html(&title)))?;
        metadata.notes.insert(0, note.clone());
        self.write_metadata(&metadata)?;

        Ok(note)
    }

    fn get_note(&self, id: &str) -> Result<NoteRecord, String> {
        assert_valid_note_id(id)?;
        let notes = self.list_notes()?;
        let note = notes
            .into_iter()
            .find(|item| item.id == id)
            .ok_or_else(|| format!("Note not found: {id}"))?;
        let content = fs::read_to_string(self.resolve_note_file(&note.file_name)?).map_err(|error| error.to_string())?;

        Ok(NoteRecord { meta: note, content })
    }

    fn save_note_content(&self, id: &str, content: String) -> Result<NoteMeta, String> {
        assert_valid_note_id(id)?;
        let mut metadata = self.read_metadata()?;
        let index = metadata
            .notes
            .iter()
            .position(|note| note.id == id && !note.archived)
            .ok_or_else(|| format!("Note not found: {id}"))?;
        let mut note = metadata.notes[index].clone();

        note.updated_at = unix_timestamp();
        self.write_note_file(&note.file_name, &content)?;
        metadata.notes[index] = note.clone();
        self.write_metadata(&metadata)?;

        Ok(note)
    }

    fn duplicate_note(&self, id: &str) -> Result<NoteMeta, String> {
        let source = self.get_note(id)?;
        create_note(
            self.metadata_path
                .parent()
                .and_then(Path::parent)
                .and_then(Path::parent)
                .ok_or_else(|| "Unable to resolve Vault directory".to_string())?,
            CreateNoteInput {
                title: format!("{} copy", source.meta.title),
                content: Some(source.content),
                tags: Some(source.meta.tags),
            },
        )
    }

    fn delete_note(&self, id: &str) -> Result<(), String> {
        assert_valid_note_id(id)?;
        let mut metadata = self.read_metadata()?;
        let index = metadata
            .notes
            .iter()
            .position(|note| note.id == id && !note.archived)
            .ok_or_else(|| format!("Note not found: {id}"))?;
        let note = metadata.notes.remove(index);

        fs::rename(
            self.resolve_note_file(&note.file_name)?,
            self.resolve_trash_file(&note.file_name)?,
        )
        .map_err(|error| error.to_string())?;
        self.write_metadata(&metadata)
    }

    fn hydrate_note_graph(&self, notes: Vec<NoteMeta>) -> Result<Vec<NoteMeta>, String> {
        let mut hydrated = Vec::new();
        for mut note in notes {
            let content = fs::read_to_string(self.resolve_note_file(&note.file_name)?).unwrap_or_default();
            let extracted = extract_note_metadata(&content);
            note.tags = unique_strings(note.tags.into_iter().chain(extracted.tags).collect());
            note.wikilinks = Some(extracted.wikilinks);
            note.backlinks = Some(Vec::new());
            hydrated.push(note);
        }

        let mut targets = BTreeMap::<String, usize>::new();
        for (index, note) in hydrated.iter().enumerate() {
            targets.insert(normalize_graph_key(&note.title), index);
            targets.insert(normalize_graph_key(&note.slug), index);
        }

        let sources: Vec<(String, Vec<String>)> = hydrated
            .iter()
            .map(|note| (note.title.clone(), note.wikilinks.clone().unwrap_or_default()))
            .collect();
        for (source_title, wikilinks) in sources {
            for target in wikilinks {
                if let Some(target_index) = targets.get(&normalize_graph_key(&target)).copied() {
                    let backlinks = hydrated[target_index].backlinks.get_or_insert_with(Vec::new);
                    *backlinks = unique_strings(backlinks.iter().cloned().chain([source_title.clone()]).collect());
                }
            }
        }

        Ok(hydrated)
    }

    fn read_metadata(&self) -> Result<MetadataFile, String> {
        let content = fs::read_to_string(&self.metadata_path).map_err(|error| error.to_string())?;
        let parsed: MetadataFile = serde_json::from_str(&content).unwrap_or(MetadataFile { notes: Vec::new() });
        Ok(parsed)
    }

    fn write_metadata(&self, metadata: &MetadataFile) -> Result<(), String> {
        let content = serde_json::to_string_pretty(metadata).map_err(|error| error.to_string())?;
        atomic_write(&self.metadata_path, &format!("{content}\n"))
    }

    fn write_note_file(&self, file_name: &str, content: &str) -> Result<(), String> {
        atomic_write(&self.resolve_note_file(file_name)?, content)
    }

    fn resolve_note_file(&self, file_name: &str) -> Result<PathBuf, String> {
        resolve_scoped_path(&self.notes_dir, file_name)
    }

    fn resolve_trash_file(&self, file_name: &str) -> Result<PathBuf, String> {
        resolve_scoped_path(&self.trash_dir, file_name)
    }
}

struct ExtractedNoteMetadata {
    tags: Vec<String>,
    wikilinks: Vec<String>,
}

fn extract_note_metadata(html: &str) -> ExtractedNoteMetadata {
    let mut tags = Vec::new();
    let mut wikilinks = Vec::new();

    collect_data_attribute(html, "data-tag", &mut tags);
    collect_data_attribute(html, "data-wikilink", &mut wikilinks);
    for word in html.split(|character: char| character.is_whitespace() || "<>()[]{}.,;:".contains(character)) {
        if let Some(tag) = word.strip_prefix('#').filter(|value| !value.is_empty()) {
            tags.push(tag.to_string());
        }
    }

    ExtractedNoteMetadata {
        tags: unique_strings(tags),
        wikilinks: unique_strings(wikilinks),
    }
}

fn collect_data_attribute(html: &str, attr_name: &str, values: &mut Vec<String>) {
    let lower = html.to_lowercase();
    let needle = format!("{attr_name}=");
    let mut offset = 0;

    while let Some(relative_start) = lower[offset..].find(&needle) {
        let start = offset + relative_start + needle.len();
        let Some(quote) = html[start..].chars().next() else {
            break;
        };
        if quote != '"' && quote != '\'' {
            offset = start;
            continue;
        }
        let value_start = start + quote.len_utf8();
        let Some(relative_end) = html[value_start..].find(quote) else {
            break;
        };
        let value_end = value_start + relative_end;
        values.push(html[value_start..value_end].trim().to_string());
        offset = value_end + quote.len_utf8();
    }
}

fn assert_valid_note_id(id: &str) -> Result<(), String> {
    if id.starts_with("note_") && id.chars().all(|item| item.is_ascii_alphanumeric() || item == '_' || item == '-') {
        return Ok(());
    }

    Err(format!("Invalid note id: {id}"))
}

fn resolve_scoped_path(parent: &Path, file_name: &str) -> Result<PathBuf, String> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Invalid note file name".to_string());
    }
    Ok(parent.join(file_name))
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, content).map_err(|error| error.to_string())?;
    fs::rename(temp_path, path).map_err(|error| error.to_string())
}

fn default_html(title: &str) -> String {
    format!(
        "{}\n{}\n{}\n{}\n{}\n",
        "<!doctype html>",
        format!("<html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>{}</title></head>", escape_html(title)),
        "<body><article>",
        format!("<h1>{}</h1><p>开始写你的 HTML 笔记。</p>", escape_html(title)),
        "</article></body></html>"
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn slugify(title: &str) -> String {
    let slug = title
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || ('\u{4e00}'..='\u{9fa5}').contains(&character) {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if slug.is_empty() {
        "note".to_string()
    } else {
        slug
    }
}

fn unique_strings(values: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut result = Vec::new();

    for value in values {
        let normalized = value.trim().to_string();
        let key = normalized.to_lowercase();
        if !normalized.is_empty() && seen.insert(key) {
            result.push(normalized);
        }
    }

    result
}

fn normalize_graph_key(value: &str) -> String {
    value.trim().to_lowercase().split_whitespace().collect::<Vec<_>>().join("-")
}

fn trimmed_or_default(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn unix_timestamp() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    format!("unix:{millis}")
}

fn unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}
