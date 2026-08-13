//! 数据库初始化：连接数据库（SQLite / Postgres）+ 按 schema.sql 建表/索引。
//!
//! main.rs 只知道 `db::init(cfg, workspace) -> AnyPool`，不关心具体驱动。
//! 路径拼接 / DSN 构造等运行时逻辑都在这里完成，不污染配置层。

pub mod snowflake;

pub use snowflake::{default_level, next_id};

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context as _, Result as AnyResult};
use sqlx::AnyPool;

use crate::config::model::{AppConfig, DatabaseConfig};

/// 归一化驱动名。
fn driver_type(driver: &str) -> &'static str {
    match driver.trim().to_ascii_lowercase().as_str() {
        "postgres" | "postgre" | "pg" => "postgres",
        _ => "sqlite",
    }
}

/// sqlite 最终文件路径：`workspace / name`
fn resolve_sqlite_path(db_cfg: &DatabaseConfig, workspace: &Path) -> PathBuf {
    let name = if db_cfg.name.trim().is_empty() { "usw.db" } else { db_cfg.name.trim() };
    workspace.join(name)
}

/// postgres DSN 拼接。
fn build_postgres_url(db_cfg: &DatabaseConfig) -> AnyResult<String> {
    let host = db_cfg.host.as_deref().unwrap_or("127.0.0.1");
    let port = db_cfg.port.unwrap_or(5432);
    let user = db_cfg.username.as_deref().unwrap_or("postgres");
    let pass = db_cfg.password.as_deref().unwrap_or("");
    let db = if db_cfg.name.trim().is_empty() { "postgres" } else { db_cfg.name.trim() };
    if pass.is_empty() {
        Ok(format!("postgres://{user}@{host}:{port}/{db}"))
    } else {
        Ok(format!("postgres://{user}:{pass}@{host}:{port}/{db}"))
    }
}

/// 进程入口调用：根据 cfg.database 选择驱动，返回驱动无关的 AnyPool。
pub async fn init(cfg: &AppConfig, workspace: &Path) -> AnyResult<AnyPool> {
    // sqlx 0.8 起 AnyPool 不再自动注册驱动，必须显式调用
    sqlx::any::install_default_drivers();

    let db_cfg = cfg.database();
    match driver_type(&db_cfg.driver) {
        "postgres" => init_postgres(&db_cfg).await,
        _ => init_sqlite(&db_cfg, workspace).await,
    }
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------

async fn init_sqlite(db_cfg: &DatabaseConfig, workspace: &Path) -> AnyResult<AnyPool> {
    let db_path = resolve_sqlite_path(db_cfg, workspace);
    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| anyhow!("sqlite db 路径不是合法 UTF-8：{db_path:?}"))?;

    let url = format!("sqlite://{db_path_str}?mode=rwc");

    let pool = sqlx::any::AnyPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .after_connect(move |conn, _meta| {
            Box::pin(async move {
                use sqlx::Executor as _;
                conn.execute("PRAGMA synchronous = NORMAL;").await?;
                conn.execute("PRAGMA foreign_keys = ON;").await?;
                Ok(())
            })
        })
        .connect(&url)
        .await
        .with_context(|| format!("连接 SQLite 失败：{db_path_str}"))?;

    let schema_sql = include_str!("schema.sql");
    run_script(&pool, schema_sql)
        .await
        .context("执行 schema.sql 建表失败")?;

    Ok(pool)
}

// ---------------------------------------------------------------------------
// Postgres（打桩）
// ---------------------------------------------------------------------------

async fn init_postgres(db_cfg: &DatabaseConfig) -> AnyResult<AnyPool> {
    let url = build_postgres_url(db_cfg)?;
    let _ = url;
    Err(anyhow!(
        "PostgreSQL 驱动尚未实现：\n  \
         1) Cargo.toml → sqlx features 加上 \"postgres\" \"postgres-rustls\"\n  \
         2) src/db/mod.rs 实现 init_postgres 的真正连接"
    ))
}

// ---------------------------------------------------------------------------
// 脚本执行器
// ---------------------------------------------------------------------------

async fn run_script(pool: &AnyPool, sql: &str) -> AnyResult<()> {
    for stmt in split_statements(sql) {
        sqlx::query(stmt)
            .execute(pool)
            .await
            .with_context(|| format!("执行 SQL 语句失败：\n{stmt}"))?;
    }
    Ok(())
}

pub(crate) fn split_statements(sql: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0usize;
    let bytes = sql.as_bytes();
    let mut in_single = false;
    let mut in_double = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        let nxt = bytes.get(i + 1).copied();

        if in_line_comment {
            if c == b'\n' { in_line_comment = false; }
            i += 1;
            continue;
        }
        if in_block_comment {
            if c == b'*' && nxt == Some(b'/') {
                in_block_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }

        if !in_single && !in_double {
            if c == b'-' && nxt == Some(b'-') {
                in_line_comment = true;
                i += 2;
                continue;
            }
            if c == b'/' && nxt == Some(b'*') {
                in_block_comment = true;
                i += 2;
                continue;
            }
        }

        if !in_double && c == b'\'' {
            in_single = !in_single;
        } else if !in_single && c == b'"' {
            in_double = !in_double;
        } else if !in_single && !in_double && c == b';' {
            let seg = &sql[start..i];
            if !seg.trim().is_empty() { out.push(seg); }
            start = i + 1;
        }
        i += 1;
    }
    let tail = &sql[start..];
    if !tail.trim().is_empty() { out.push(tail); }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_statements_skips_comments() {
        let sql = r#"
            -- 这是注释
            CREATE TABLE a (id INTEGER);
            /* 块注释 ; 不应切 */
            CREATE INDEX ixa ON a(id);
        "#;
        let stmts = split_statements(sql);
        assert_eq!(stmts.len(), 2);
        assert!(stmts[0].contains("CREATE TABLE a"));
        assert!(stmts[1].contains("CREATE INDEX ixa"));
    }
}
