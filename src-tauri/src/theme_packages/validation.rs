use super::json::parse_bounded_json;
use jsonschema::{Draft, JSONSchema};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashSet;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Limits {
    manifest_bytes: usize,
    definition_bytes: usize,
    json_depth: usize,
    json_nodes: usize,
    path_length: usize,
    path_components: usize,
}

static LIMITS: Lazy<Limits> = Lazy::new(|| {
    serde_json::from_str(include_str!("../../../public/schemas/theme-limits-v1.json"))
        .expect("Bundled theme limits must be valid")
});

fn compile_schema(source: &str) -> Result<JSONSchema, String> {
    let schema: Value = serde_json::from_str(source).map_err(|error| error.to_string())?;
    JSONSchema::options()
        .with_draft(Draft::Draft7)
        .compile(&schema)
        .map_err(|error| error.to_string())
}

static DEFINITION: Lazy<Result<JSONSchema, String>> = Lazy::new(|| {
    compile_schema(include_str!(
        "../../../public/schemas/theme-definition-v1.json"
    ))
});
static MANIFEST: Lazy<Result<JSONSchema, String>> = Lazy::new(|| {
    compile_schema(include_str!(
        "../../../public/schemas/theme-package-v1.json"
    ))
});

fn validate_json(
    input: &[u8],
    max_bytes: usize,
    schema: &Result<JSONSchema, String>,
) -> Result<Value, String> {
    let value = parse_bounded_json(input, max_bytes, LIMITS.json_depth, LIMITS.json_nodes)?;
    let validator = schema.as_ref().map_err(Clone::clone)?;
    if let Err(mut errors) = validator.validate(&value) {
        return Err(errors
            .next()
            .map(|error| format!("Invalid theme data at {}: {}", error.instance_path, error))
            .unwrap_or_else(|| "Invalid theme data".into()));
    }
    Ok(value)
}

pub fn validate_definition_json(input: &[u8]) -> Result<Value, String> {
    validate_json(input, LIMITS.definition_bytes, &DEFINITION)
}

fn string_field<'a>(value: &'a Value, field: &str) -> Result<&'a str, String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing theme package field: {}", field))
}

pub fn validate_manifest_json(input: &[u8]) -> Result<Value, String> {
    let value = validate_json(input, LIMITS.manifest_bytes, &MANIFEST)?;
    for field in ["version", "min_runtime_version"] {
        semver::Version::parse(string_field(&value, field)?).map_err(|error| error.to_string())?;
    }
    let variants = value
        .get("theme_variants")
        .and_then(Value::as_array)
        .ok_or_else(|| "Missing theme variants".to_string())?;
    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    for variant in variants {
        if !ids.insert(string_field(variant, "id")?) {
            return Err("Duplicate theme variant ID".into());
        }
        let path = string_field(variant, "file")?;
        if !is_safe_relative_path(path) || !paths.insert(path.to_ascii_lowercase()) {
            return Err("Invalid or colliding theme definition path".into());
        }
    }
    Ok(value)
}

fn is_device_name(component: &str) -> bool {
    let stem = component
        .split('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        || ((stem.starts_with("com") || stem.starts_with("lpt"))
            && stem.len() == 4
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

/// Syntax only: extraction must separately reject links and path collisions.
pub fn is_safe_relative_path(path: &str) -> bool {
    if path.len() > LIMITS.path_length {
        return false;
    }
    if path == ".tabularium" {
        return true;
    }
    let parts: Vec<_> = path.split('/').collect();
    parts.len() <= LIMITS.path_components
        && parts.iter().all(|part| {
            part.as_bytes()
                .first()
                .is_some_and(u8::is_ascii_alphanumeric)
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
                && !part.ends_with('.')
                && !is_device_name(part)
        })
}

/// Identity is bound to configured host context, never an archive property.
pub fn registry_key(base_url: &str) -> Result<String, String> {
    let url = url::Url::parse(base_url).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "https" | "http")
        || !url.has_host()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Invalid theme registry base URL".into());
    }
    let normalized = url.as_str().trim_end_matches('/');
    Ok(format!("{:x}", Sha256::digest(normalized.as_bytes())))
}

/// Fail closed; intentionally separate from the permissive legacy driver gate.
pub fn validate_runtime_version(manifest: &Value, host_version: &str) -> Result<(), String> {
    let floor = semver::Version::parse(string_field(manifest, "min_runtime_version")?)
        .map_err(|error| error.to_string())?;
    let host = semver::Version::parse(host_version).map_err(|error| error.to_string())?;
    if host.cmp_precedence(&floor).is_lt() {
        return Err(format!(
            "Theme package requires Tabularis {} or newer",
            floor
        ));
    }
    Ok(())
}
