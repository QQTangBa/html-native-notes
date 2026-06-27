use crate::core::vault::read_vault_manifest;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredWebService {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub start_command: String,
    pub stop_command: Option<String>,
    pub url: String,
    pub port: Option<u16>,
    pub health_check_url: Option<String>,
    pub env_hints: Vec<String>,
    pub log_path: String,
    pub started_by_app: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServiceRegistry {
    schema_version: u8,
    services: Vec<RegisteredWebService>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRuntimeResult {
    pub status: String,
    pub service_id: String,
    pub cwd: String,
    pub command: String,
    pub log_path: String,
    pub started_by_app: bool,
}

static RUNNING_SERVICES: OnceLock<Mutex<BTreeMap<String, u32>>> = OnceLock::new();

pub fn check_service_health(vault_dir: &Path, asset_id: &str) -> Result<ServiceRuntimeResult, String> {
    let service = service_for_asset(vault_dir, asset_id)?;
    let status = if health_check(&service) { "running" } else { "stopped" };

    Ok(result_for(&service, status))
}

pub fn start_service(vault_dir: &Path, asset_id: &str) -> Result<ServiceRuntimeResult, String> {
    let service = service_for_asset(vault_dir, asset_id)?;
    if health_check(&service) {
        return Ok(result_for(&service, "running"));
    }

    let log_file = open_log_file(&service.log_path)?;
    let mut command = Command::new("/bin/zsh");
    command
        .arg("-lc")
        .arg(&service.start_command)
        .current_dir(&service.cwd)
        .stdout(Stdio::from(log_file.try_clone().map_err(|error| error.to_string())?))
        .stderr(Stdio::from(log_file));

    match command.spawn() {
        Ok(mut child) => {
            let process_id = child.id();
            running_services()
                .lock()
                .map_err(|_| "Service runtime lock poisoned".to_string())?
                .insert(service.id.clone(), process_id);

            Ok(result_for(&service, "running"))
        }
        Err(error) => {
            append_log(&service.log_path, &format!("{error}\n"))?;
            Ok(result_for(&service, "failed"))
        }
    }
}

pub fn stop_service(vault_dir: &Path, asset_id: &str) -> Result<ServiceRuntimeResult, String> {
    let service = service_for_asset(vault_dir, asset_id)?;
    let maybe_process_id = running_services()
        .lock()
        .map_err(|_| "Service runtime lock poisoned".to_string())?
        .remove(&service.id);

    if let Some(process_id) = maybe_process_id {
        let _ = Command::new("/bin/zsh")
            .arg("-lc")
            .arg(format!("kill -TERM {process_id}"))
            .output();
    } else if let Some(stop_command) = &service.stop_command {
        let _ = Command::new("/bin/zsh")
            .arg("-lc")
            .arg(stop_command)
            .current_dir(&service.cwd)
            .output();
    }

    Ok(result_for(&service, "stopped"))
}

fn service_for_asset(vault_dir: &Path, asset_id: &str) -> Result<RegisteredWebService, String> {
    let service_id = service_id_for_asset(vault_dir, asset_id)?;
    let registry = read_service_registry(&registry_path_for(vault_dir))?;

    registry
        .services
        .into_iter()
        .find(|service| service.id == service_id)
        .ok_or_else(|| format!("Registered service not found for asset: {asset_id}"))
}

fn service_id_for_asset(vault_dir: &Path, asset_id: &str) -> Result<String, String> {
    let manifest = read_vault_manifest(vault_dir)?;
    let assets = manifest
        .get("assets")
        .and_then(Value::as_array)
        .ok_or_else(|| "Invalid manifest assets".to_string())?;
    let asset = assets
        .iter()
        .find(|item| string_field(item, "id").as_deref() == Some(asset_id))
        .ok_or_else(|| format!("Vault asset not found: {asset_id}"))?;

    if string_field(asset, "kind").as_deref() != Some("service") {
        return Err(format!("Vault asset is not a service: {asset_id}"));
    }

    let source_path = string_field(asset, "sourcePath").ok_or_else(|| "Missing sourcePath".to_string())?;
    let registry = read_service_registry(&registry_path_for(vault_dir))?;
    let service = registry
        .services
        .iter()
        .find(|item| item.id == asset_id || item.cwd == source_path)
        .ok_or_else(|| format!("Registered service not found for asset: {asset_id}"))?;

    Ok(service.id.clone())
}

fn read_service_registry(registry_path: &Path) -> Result<ServiceRegistry, String> {
    match fs::read_to_string(registry_path) {
        Ok(content) => serde_json::from_str(&content).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(ServiceRegistry {
            schema_version: 1,
            services: Vec::new(),
        }),
        Err(error) => Err(error.to_string()),
    }
}

fn registry_path_for(vault_dir: &Path) -> PathBuf {
    vault_dir.join(".htmlvault").join("services.json")
}

fn health_check(service: &RegisteredWebService) -> bool {
    let target = service.health_check_url.as_ref().unwrap_or(&service.url);
    let Some(address) = tcp_address_for_local_http(target) else {
        return false;
    };

    address
        .to_socket_addrs()
        .ok()
        .and_then(|mut addresses| addresses.next())
        .is_some_and(|address| TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok())
}

fn result_for(service: &RegisteredWebService, status: &str) -> ServiceRuntimeResult {
    ServiceRuntimeResult {
        status: status.to_string(),
        service_id: service.id.clone(),
        cwd: service.cwd.clone(),
        command: service.start_command.clone(),
        log_path: service.log_path.clone(),
        started_by_app: running_services()
            .lock()
            .map(|items| items.contains_key(&service.id))
            .unwrap_or(false),
    }
}

fn append_log(log_path: &str, content: &str) -> Result<(), String> {
    let mut file = open_log_file(log_path)?;
    file.write_all(content.as_bytes()).map_err(|error| error.to_string())
}

fn open_log_file(log_path: &str) -> Result<File, String> {
    let path = Path::new(log_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())
}

fn running_services() -> &'static Mutex<BTreeMap<String, u32>> {
    RUNNING_SERVICES.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn tcp_address_for_local_http(url: &str) -> Option<String> {
    let without_scheme = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))?;
    let host_port = without_scheme.split('/').next()?;
    let (host, port) = host_port.rsplit_once(':')?;

    if host != "127.0.0.1" && host != "localhost" {
        return None;
    }

    Some(format!("{host}:{port}"))
}
