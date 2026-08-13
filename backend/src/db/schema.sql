-- ============================================================================
-- Unlimited Story Works — SQLite Schema (STRICT)
-- 所有表的通用列（业务约束，不是外键级别，只是代码级约定）：
--   id         INTEGER PRIMARY KEY  -- 雪花算法 63-bit i64（前端 JS Number 安全）
--   level      INTEGER NOT NULL     -- 预留层级/排序，默认 = 当前毫秒时间戳
--   status     TEXT    NOT NULL     -- 字符串状态：active / frozen / deleted / ...
--   created_at TEXT    NOT NULL     -- RFC3339 UTC
--   updated_at TEXT    NOT NULL     -- RFC3339 UTC
--
-- 业务说明：
--   * 软删除 = 改 status = 'deleted'，不是 SET deleted_at。
--   * 正常物理删除 = DELETE FROM ... WHERE id = ?（极少用，仅数据清理）。
--   * 查询默认排除 status = 'deleted'（除非明确传 status=all 或需要回收站）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 001 projects：所有故事/角色/分镜等业务资源的根隔离单元。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY,
    level         INTEGER NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'active',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    description   TEXT,
    cover_image   TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at   ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_level        ON projects(level);
CREATE INDEX IF NOT EXISTS idx_projects_name         ON projects(name);
