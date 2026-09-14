//! Dispatch-level tests for MCP tool discovery, argument validation, and
//! connection-resolution error paths.

use super::*;
use serde_json::{json, Map, Value};

#[test]
fn every_tool_advertises_optional_json_or_toon_output() {
    let result =
        handle_list_tools(&AppConfig::default()).expect("tool discovery should succeed");
    let tools = result["tools"].as_array().expect("tools must be an array");

    assert_eq!(tools.len(), 5);
    for tool in tools {
        let output_format = &tool["inputSchema"]["properties"]["output_format"];
        assert_eq!(output_format["type"], "string");
        assert_eq!(output_format["enum"], json!(["json", "toon"]));
        assert_eq!(output_format["default"], "json");
        assert!(tool["inputSchema"]["required"]
            .as_array()
            .map_or(true, |required| !required
                .iter()
                .any(|name| name == "output_format")));
    }
}

#[tokio::test]
async fn invalid_output_format_fails_before_tool_execution() {
    let config = AppConfig::default();
    let mut audit = CallAudit::for_tool("run_query");
    let args = json!({
        "connection_id": "does-not-matter",
        "query": "SELECT 1",
        "output_format": "xml"
    });
    let err = dispatch_tool(
        "run_query",
        args.as_object(),
        &config,
        "test-session",
        &mut audit,
    )
    .await
    .expect_err("unsupported output formats must be rejected");

    assert_eq!(err.code, -32602);
    assert_eq!(
        err.message,
        "Invalid output_format: expected 'json' or 'toon'"
    );
    assert_eq!(audit.connection_id, None);
}

#[test]
fn tool_schema_advertises_configured_output_preference() {
    let config = AppConfig {
        mcp_output_format: Some("toon".to_string()),
        ..AppConfig::default()
    };
    let result = handle_list_tools(&config).expect("tool discovery should succeed");

    for tool in result["tools"].as_array().unwrap() {
        assert_eq!(
            tool["inputSchema"]["properties"]["output_format"]["default"],
            "toon"
        );
    }
}

#[test]
fn call_argument_overrides_app_output_preference() {
    let config = AppConfig {
        mcp_output_format: Some("toon".to_string()),
        ..AppConfig::default()
    };
    let args = serde_json::from_value::<serde_json::Map<String, Value>>(json!({
        "output_format": "json"
    }))
    .unwrap();

    assert_eq!(
        requested_output_format(Some(&args), &config).unwrap(),
        ToolOutputFormat::Json
    );
}

/// `list_databases` with no arguments object should surface the JSON-RPC
/// "Missing arguments" error (-32602) before any connection lookup happens.
#[tokio::test]
async fn list_databases_missing_arguments_errors() {
    let config = AppConfig::default();
    let mut audit = CallAudit::for_tool("list_databases");
    let err = dispatch_tool("list_databases", None, &config, "test-session", &mut audit)
        .await
        .expect_err("expected an error when arguments are missing");
    assert_eq!(err.code, -32602);
    assert_eq!(err.message, "Missing arguments");
}

/// `list_databases` with an arguments object that omits `connection_id`
/// should surface the "Missing connection_id" error (-32602).
#[tokio::test]
async fn list_databases_missing_connection_id_errors() {
    let config = AppConfig::default();
    let mut audit = CallAudit::for_tool("list_databases");
    let args: Map<String, Value> = Map::new();
    let err = dispatch_tool(
        "list_databases",
        Some(&args),
        &config,
        "test-session",
        &mut audit,
    )
    .await
    .expect_err("expected an error when connection_id is missing");
    assert_eq!(err.code, -32602);
    assert_eq!(err.message, "Missing connection_id");
}

/// `list_databases` pointed at a connection that does not exist should surface
/// the -32000 "Connection not found" error from resolution, and still record
/// the attempted connection id on the audit trail.
#[tokio::test]
async fn list_databases_unknown_connection_errors() {
    let config = AppConfig::default();
    let mut audit = CallAudit::for_tool("list_databases");
    let mut args: Map<String, Value> = Map::new();
    args.insert(
        "connection_id".to_string(),
        json!("__tabularis_nonexistent_mcp_test_connection__"),
    );
    let err = dispatch_tool(
        "list_databases",
        Some(&args),
        &config,
        "test-session",
        &mut audit,
    )
    .await
    .expect_err("expected an error for an unknown connection");
    assert_eq!(err.code, -32000);
    assert!(
        err.message.contains("Connection not found"),
        "unexpected error message: {}",
        err.message
    );
    assert_eq!(
        audit.connection_id.as_deref(),
        Some("__tabularis_nonexistent_mcp_test_connection__")
    );
}

/// `resolve_default_schema` (issue #614): the schema default used to key off
/// `driver == "postgres"` literally, so a postgres-compatible driver
/// registered under a different id (e.g. the standalone PostgreSQL plugin)
/// never got the `"public"` default. Exercised against the real concrete
/// driver types — not a mock — so a manifest change on any of them would
/// actually be caught here.
#[test]
fn resolve_default_schema_defaults_postgres_to_public() {
    let driver: Arc<dyn DatabaseDriver> = Arc::new(postgres::PostgresDriver::new());
    assert_eq!(resolve_default_schema(&driver, None), Some("public"));
}

#[test]
fn resolve_default_schema_prefers_a_caller_supplied_schema_on_postgres() {
    let driver: Arc<dyn DatabaseDriver> = Arc::new(postgres::PostgresDriver::new());
    assert_eq!(
        resolve_default_schema(&driver, Some("analytics")),
        Some("analytics"),
    );
}

#[test]
fn resolve_default_schema_passes_through_unchanged_on_non_postgres_drivers() {
    let mysql: Arc<dyn DatabaseDriver> = Arc::new(mysql::MysqlDriver::new());
    assert_eq!(resolve_default_schema(&mysql, None), None);
    assert_eq!(
        resolve_default_schema(&mysql, Some("whatever")),
        Some("whatever"),
    );

    let sqlite: Arc<dyn DatabaseDriver> = Arc::new(sqlite::SqliteDriver::new());
    assert_eq!(resolve_default_schema(&sqlite, None), None);
}
