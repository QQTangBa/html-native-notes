use crate::core::exporter::{export_vault_static_package, StaticPackageExportResult};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone)]
pub enum PublishProviderConfig {
    Disabled,
    Command {
        command: String,
        args: Vec<String>,
        required_env: Vec<String>,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderOutput {
    public_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticPublishResult {
    pub asset_id: String,
    pub publish_type: String,
    pub provider: String,
    pub public_url: String,
    pub package: StaticPackageExportResult,
    pub published_at: String,
}

pub fn publish_vault_static(vault_dir: &Path, asset_id: &str) -> Result<StaticPublishResult, String> {
    let provider = load_publish_provider_config()?;
    let PublishProviderConfig::Command {
        command,
        args,
        required_env,
    } = provider
    else {
        return Err("Publish provider is not configured".to_string());
    };

    for name in &required_env {
        if env::var(name).unwrap_or_default().is_empty() {
            return Err(format!(
                "Publish provider is missing required environment variable: {name}"
            ));
        }
    }

    let package = export_vault_static_package(vault_dir, asset_id)?;
    let output = Command::new(command)
        .args(args)
        .env("HTML_NATIVE_NOTES_PACKAGE_DIR", &package.output_dir)
        .env("HTML_NATIVE_NOTES_PUBLISH_MANIFEST", &package.manifest_path)
        .env("HTML_NATIVE_NOTES_ASSET_ID", &package.asset_id)
        .output()
        .map_err(|_| "Publish provider command failed".to_string())?;

    if !output.status.success() {
        return Err("Publish provider command failed".to_string());
    }

    let stdout = String::from_utf8(output.stdout).map_err(|_| "Publish provider returned invalid output".to_string())?;
    let provider_output: ProviderOutput =
        serde_json::from_str(stdout.trim()).map_err(|_| "Publish provider returned invalid JSON output".to_string())?;
    let public_url = validate_public_url(&provider_output.public_url)?;

    Ok(StaticPublishResult {
        asset_id: package.asset_id.clone(),
        publish_type: "static-provider".to_string(),
        provider: "command".to_string(),
        public_url,
        package,
        published_at: unix_timestamp(),
    })
}

fn load_publish_provider_config() -> Result<PublishProviderConfig, String> {
    let mode = env::var("PUBLISH_PROVIDER_MODE").unwrap_or_else(|_| "disabled".to_string());
    if mode == "disabled" || mode.trim().is_empty() {
        return Ok(PublishProviderConfig::Disabled);
    }

    if mode != "command" {
        return Err("PUBLISH_PROVIDER_MODE must be disabled or command".to_string());
    }

    let command = env::var("PUBLISH_COMMAND")
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    if command.is_empty() {
        return Err("PUBLISH_COMMAND is required when PUBLISH_PROVIDER_MODE=command".to_string());
    }

    Ok(PublishProviderConfig::Command {
        command,
        args: parse_command_args()?,
        required_env: parse_required_env(),
    })
}

fn parse_command_args() -> Result<Vec<String>, String> {
    let raw = env::var("PUBLISH_COMMAND_ARGS").unwrap_or_default();
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str::<Vec<String>>(&raw).map_err(|_| "PUBLISH_COMMAND_ARGS must be a JSON string array".to_string())
}

fn parse_required_env() -> Vec<String> {
    env::var("PUBLISH_REQUIRED_ENV")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect()
}

fn validate_public_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        return Ok(trimmed.to_string());
    }

    Err("Publish provider publicUrl must use http or https".to_string())
}

fn unix_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
