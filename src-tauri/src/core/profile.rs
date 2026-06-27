use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlProfileAsset {
    pub kind: String,
    pub src: String,
    pub alt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlProfileBlock {
    pub id: String,
    pub selector: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlProfileSource {
    pub path: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlProfileAiContext {
    pub summary: String,
    pub headings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlProfile {
    pub schema_version: u8,
    pub profile_version: u8,
    pub title: String,
    pub tags: Vec<String>,
    pub source: HtmlProfileSource,
    pub assets: Vec<HtmlProfileAsset>,
    pub blocks: Vec<HtmlProfileBlock>,
    pub ai_context: HtmlProfileAiContext,
    pub theme_vars: BTreeMap<String, String>,
}

pub fn build_html_profile(html: &str, source_path: &str, source_hash: &str) -> HtmlProfile {
    let title = tag_text(html, "title").or_else(|| tag_text(html, "h1")).unwrap_or_default();
    let tags = meta_content(html, "keywords")
        .map(|value| split_tags(&value))
        .unwrap_or_default();
    let summary = meta_content(html, "description").unwrap_or_default();
    let headings = collect_headings(html);

    HtmlProfile {
        schema_version: 1,
        profile_version: 1,
        title,
        tags,
        source: HtmlProfileSource {
            path: source_path.to_string(),
            hash: source_hash.to_string(),
        },
        assets: collect_assets(html),
        blocks: collect_blocks(html),
        ai_context: HtmlProfileAiContext { summary, headings },
        theme_vars: collect_theme_vars(html),
    }
}

pub fn embed_html_profile(html: &str, profile: &HtmlProfile) -> Result<String, String> {
    let profile_json = serde_json::to_string_pretty(profile)
        .map_err(|error| error.to_string())?
        .replace("</script", "<\\/script");
    let script = format!(
        "<script type=\"application/json\" id=\"ainote-profile\">{profile_json}</script>"
    );

    if let Some((start, end)) = profile_script_range(html) {
        let mut output = String::new();
        output.push_str(&html[..start]);
        output.push_str(&script);
        output.push_str(&html[end..]);
        return Ok(output);
    }

    if let Some(index) = html.to_lowercase().find("</head>") {
        let mut output = String::new();
        output.push_str(&html[..index]);
        output.push_str(&script);
        output.push('\n');
        output.push_str(&html[index..]);
        return Ok(output);
    }

    Ok(format!("{script}\n{html}"))
}

pub fn extract_embedded_html_profile(html: &str) -> Result<Option<HtmlProfile>, String> {
    let Some((start, end)) = profile_script_range(html) else {
        return Ok(None);
    };
    let body_start = html[start..end]
        .find('>')
        .map(|index| start + index + 1)
        .ok_or_else(|| "Invalid ainote-profile script".to_string())?;
    let body_end = html[body_start..end]
        .to_lowercase()
        .find("</script>")
        .map(|index| body_start + index)
        .ok_or_else(|| "Invalid ainote-profile script".to_string())?;
    let value: Value = serde_json::from_str(html[body_start..body_end].trim()).map_err(|error| error.to_string())?;

    if value.get("schemaVersion").and_then(Value::as_u64) == Some(1)
        && value.get("profileVersion").and_then(Value::as_u64) == Some(1)
    {
        serde_json::from_value(value).map(Some).map_err(|error| error.to_string())
    } else {
        Ok(Some(migrate_html_profile(value)))
    }
}

pub fn migrate_html_profile(value: Value) -> HtmlProfile {
    HtmlProfile {
        schema_version: 1,
        profile_version: 1,
        title: string_field(&value, "title"),
        tags: value
            .get("labels")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        source: HtmlProfileSource {
            path: string_field(&value, "sourcePath"),
            hash: string_field(&value, "sourceHash"),
        },
        assets: Vec::new(),
        blocks: Vec::new(),
        ai_context: HtmlProfileAiContext {
            summary: String::new(),
            headings: Vec::new(),
        },
        theme_vars: BTreeMap::new(),
    }
}

fn collect_assets(html: &str) -> Vec<HtmlProfileAsset> {
    let mut assets = Vec::new();

    for tag in find_opening_tags(html, "link") {
        if tag.to_lowercase().contains("stylesheet") {
            if let Some(src) = attr_value(&tag, "href") {
                assets.push(HtmlProfileAsset {
                    kind: "stylesheet".to_string(),
                    src,
                    alt: None,
                });
            }
        }
    }

    for tag in find_opening_tags(html, "img") {
        if let Some(src) = attr_value(&tag, "src") {
            assets.push(HtmlProfileAsset {
                kind: "image".to_string(),
                src,
                alt: attr_value(&tag, "alt"),
            });
        }
    }

    for tag in find_opening_tags(html, "script") {
        if tag.contains("ainote-profile") {
            continue;
        }
        if let Some(src) = attr_value(&tag, "src") {
            assets.push(HtmlProfileAsset {
                kind: "script".to_string(),
                src,
                alt: None,
            });
        }
    }

    assets
}

fn collect_blocks(html: &str) -> Vec<HtmlProfileBlock> {
    let mut blocks = Vec::new();
    let mut generated_count = 0;

    for tag_name in ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote"] {
        for (index, tag) in find_tag_blocks(html, tag_name).into_iter().enumerate() {
            let text = strip_tags(&tag.1);
            if text.is_empty() {
                continue;
            }
            if let Some(existing_id) = attr_value(&tag.0, "data-ainote-block-id") {
                blocks.push(HtmlProfileBlock {
                    id: existing_id.clone(),
                    selector: format!("[data-ainote-block-id=\"{existing_id}\"]"),
                    text,
                });
            } else {
                generated_count += 1;
                blocks.push(HtmlProfileBlock {
                    id: format!("block-{generated_count:04}"),
                    selector: format!("{tag_name}:nth-of-type({})", index + 1),
                    text,
                });
            }
        }
    }

    blocks
}

fn collect_headings(html: &str) -> Vec<String> {
    ["h1", "h2", "h3", "h4", "h5", "h6"]
        .into_iter()
        .flat_map(|tag| find_tag_blocks(html, tag))
        .map(|block| strip_tags(&block.1))
        .filter(|text| !text.is_empty())
        .collect()
}

fn collect_theme_vars(html: &str) -> BTreeMap<String, String> {
    let mut vars = BTreeMap::new();
    for (_, style_body) in find_tag_blocks(html, "style") {
        for declaration in style_body.split(';') {
            let Some((name, value)) = declaration.split_once(':') else {
                continue;
            };
            let name = name.trim();
            if name.starts_with("--") {
                vars.insert(name.to_string(), value.trim().to_string());
            }
        }
    }
    vars
}

fn split_tags(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .map(str::to_string)
        .collect()
}

fn profile_script_range(html: &str) -> Option<(usize, usize)> {
    let lower = html.to_lowercase();
    let start = lower.find("id=\"ainote-profile\"").or_else(|| lower.find("id='ainote-profile'"))?;
    let tag_start = lower[..start].rfind("<script")?;
    let tag_end = lower[start..].find("</script>")? + start + "</script>".len();
    Some((tag_start, tag_end))
}

fn meta_content(html: &str, name: &str) -> Option<String> {
    find_opening_tags(html, "meta")
        .into_iter()
        .find(|tag| attr_value(tag, "name").as_deref() == Some(name))
        .and_then(|tag| attr_value(&tag, "content"))
}

fn tag_text(html: &str, tag_name: &str) -> Option<String> {
    find_tag_blocks(html, tag_name)
        .into_iter()
        .map(|block| strip_tags(&block.1))
        .find(|text| !text.is_empty())
}

fn find_opening_tags(html: &str, tag_name: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut rest = html;
    let needle = format!("<{tag_name}");

    while let Some(start) = rest.to_lowercase().find(&needle) {
        let after_start = &rest[start..];
        let Some(end) = after_start.find('>') else {
            break;
        };
        tags.push(after_start[..=end].to_string());
        rest = &after_start[end + 1..];
    }

    tags
}

fn find_tag_blocks(html: &str, tag_name: &str) -> Vec<(String, String)> {
    let mut blocks = Vec::new();
    let mut rest = html;
    let open = format!("<{tag_name}");
    let close = format!("</{tag_name}>");

    while let Some(start) = rest.to_lowercase().find(&open) {
        let after_start = &rest[start..];
        let Some(open_end) = after_start.find('>') else {
            break;
        };
        let body_start = open_end + 1;
        let Some(close_start) = after_start[body_start..].to_lowercase().find(&close) else {
            break;
        };
        let close_abs = body_start + close_start;
        blocks.push((
            after_start[..=open_end].to_string(),
            after_start[body_start..close_abs].to_string(),
        ));
        rest = &after_start[close_abs + close.len()..];
    }

    blocks
}

fn attr_value(tag: &str, attr_name: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let pattern = format!("{attr_name}={quote}");
        if let Some(start) = tag.find(&pattern) {
            let value_start = start + pattern.len();
            let value_end = tag[value_start..].find(quote)? + value_start;
            return Some(tag[value_start..value_end].to_string());
        }
    }

    None
}

fn strip_tags(value: &str) -> String {
    let mut output = String::new();
    let mut inside = false;

    for char in value.chars() {
        match char {
            '<' => inside = true,
            '>' => inside = false,
            _ if !inside => output.push(char),
            _ => {}
        }
    }

    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn string_field(value: &Value, field: &str) -> String {
    value.get(field).and_then(Value::as_str).unwrap_or_default().to_string()
}
