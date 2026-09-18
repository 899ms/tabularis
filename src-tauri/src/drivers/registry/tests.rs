use super::*;
use crate::drivers::driver_trait::DriverCapabilities;

fn fake_manifest(id: &str) -> PluginManifest {
    PluginManifest {
        id: id.to_string(),
        name: id.to_string(),
        version: "0.0.0".to_string(),
        description: String::new(),
        default_port: None,
        capabilities: DriverCapabilities::default(),
        is_builtin: false,
        engine: None,
        paradigms: Vec::new(),
        default_username: String::new(),
        color: String::new(),
        icon: String::new(),
        settings: Vec::new(),
        ui_extensions: None,
        explain_parsers: None,
        type_mappings: HashMap::new(),
        deprecated: None,
    }
}

/// Uses a UI-only manifest, which needs no `DatabaseDriver` implementation,
/// to exercise `is_registered` without spinning up a fake driver process.
#[tokio::test]
async fn is_registered_reflects_manifest_registration() {
    let id = "__test_is_registered_manifest__";
    assert!(!is_registered(id).await);

    register_manifest(fake_manifest(id)).await;
    assert!(is_registered(id).await);

    unregister_manifest(id).await;
    assert!(!is_registered(id).await);
}

#[tokio::test]
async fn is_registered_is_false_for_an_unknown_id() {
    assert!(!is_registered("__test_is_registered_unknown__").await);
}
