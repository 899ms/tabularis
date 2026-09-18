//! Dispatch-level tests for the MCP tool router, focused on the argument and
//! connection-resolution error paths of `list_databases`.

use super::*;
use serde_json::{json, Map, Value};

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

/// `cooldown_elapsed` gates `resolve_db_driver`'s plugin-directory rescan on
/// a registry miss (issue #783), so a connection whose driver id is
/// genuinely wrong can't force a filesystem scan on every call from a tight
/// retry loop. Exercised on synthetic `Instant`s, not real sleeps.
#[test]
fn cooldown_elapsed_is_true_with_no_prior_attempt() {
    let now = std::time::Instant::now();
    assert!(cooldown_elapsed(
        None,
        now,
        std::time::Duration::from_secs(2)
    ));
}

#[test]
fn cooldown_elapsed_is_false_immediately_after_an_attempt() {
    let now = std::time::Instant::now();
    assert!(!cooldown_elapsed(
        Some(now),
        now,
        std::time::Duration::from_secs(2)
    ));
}

#[test]
fn cooldown_elapsed_is_false_just_before_the_cooldown_ends() {
    let cooldown = std::time::Duration::from_secs(2);
    let last = std::time::Instant::now();
    let now = last + cooldown - std::time::Duration::from_millis(1);
    assert!(!cooldown_elapsed(Some(last), now, cooldown));
}

#[test]
fn cooldown_elapsed_is_true_once_the_cooldown_has_fully_passed() {
    let cooldown = std::time::Duration::from_secs(2);
    let last = std::time::Instant::now();
    let now = last + cooldown;
    assert!(cooldown_elapsed(Some(last), now, cooldown));
}

/// `resolve_driver_for_params` used to treat any `Err` from
/// `get_connection_driver` as a registry miss, including a `for_connection`
/// failure on a driver that *is* registered (e.g. a `get_connection_metadata`
/// RPC error). That triggered a pointless plugin rescan and repeated the
/// same failing RPC call. It should instead recognize the driver is
/// registered and surface the error straight away.
#[tokio::test]
async fn resolve_driver_for_params_does_not_retry_on_a_registered_drivers_own_failure() {
    let driver_id = "test-mcp-issue784-for-connection-failure";
    let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let calls_for_driver = calls.clone();
    let driver = plugins::driver::with_test_driver_id(
        plugins::driver::test_driver_result(move |_request| {
            calls_for_driver.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Err("simulated connection metadata discovery failure".to_string())
        })
        .with_connection_metadata(true),
        driver_id,
    );
    driver_registry::register_driver(driver).await;

    let db_params = ConnectionParams {
        driver: driver_id.to_string(),
        ..Default::default()
    };
    let err = match resolve_driver_for_params(&db_params).await {
        Ok(_) => panic!("expected the for_connection failure to surface"),
        Err(err) => err,
    };

    assert!(
        err.message
            .contains("simulated connection metadata discovery failure"),
        "unexpected error message: {}",
        err.message
    );
    assert_eq!(
        calls.load(std::sync::atomic::Ordering::SeqCst),
        1,
        "a registered driver's own for_connection failure should not be retried"
    );
}
