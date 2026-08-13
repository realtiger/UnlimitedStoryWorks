//! 雪花 ID（Snowflake）生成器。
//!
//! 53-bit 总宽，保证前端 `JSON.parse → Number` 不丢精度：
//!
//!   41-bit 毫秒时间戳（相对于 2024-01-01 UTC，可用 ~69 年）
//! +  5-bit  datacenter id (0..=31)
//! +  5-bit  worker id     (0..=31)
//! +  2-bit  seq           (0..=3)
//! = 53-bit
//!
//! 每毫秒最多 4 个 ID；单机够用。

use std::sync::Mutex;

/// 时间戳起点：2024-01-01 00:00:00 UTC（毫秒）
pub const SNOWFLAKE_EPOCH_MS: u64 = 1_704_067_200_000;
/// 默认 datacenter id（单机使用用 0）
pub const SNOWFLAKE_DATACENTER_ID: u64 = 0;
/// 默认 worker id（单机使用用 0）
pub const SNOWFLAKE_WORKER_ID: u64 = 0;

struct SnowflakeState {
    last_ms: u64,
    seq: u64,
}

static SNOWFLAKE: Mutex<SnowflakeState> = Mutex::new(SnowflakeState { last_ms: 0, seq: 0 });

/// 生成一颗雪花 ID（i64，正整数，53-bit 内 → JS 安全）。
pub fn next_id() -> i64 {
    let mut s = SNOWFLAKE.lock().expect("雪花 ID 锁被毒化（进程内 panic 过）");
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("系统时钟早于 1970")
        .as_millis() as u64;

    let cur_ms = now_ms.max(s.last_ms);
    if cur_ms == s.last_ms {
        s.seq = (s.seq + 1) & 0b11;
        if s.seq == 0 {
            // 本毫秒 4 个用完 → 等下一毫秒
            s.last_ms = cur_ms + 1;
        } else {
            s.last_ms = cur_ms;
        }
    } else {
        s.seq = 0;
        s.last_ms = cur_ms;
    }

    let ts = s.last_ms.saturating_sub(SNOWFLAKE_EPOCH_MS);
    let ts_part = ts & ((1u64 << 41) - 1);
    let dc_part = (SNOWFLAKE_DATACENTER_ID & 0b11111) << 7;
    let wk_part = (SNOWFLAKE_WORKER_ID & 0b11111) << 2;
    let sq_part = s.seq & 0b11;

    let id = (ts_part << 12) | dc_part | wk_part | sq_part;
    id as i64
}

/// `level` 默认值：当前毫秒时间戳（= 创建顺序的自然排序）。
pub fn default_level() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_id_is_positive_and_safe_53_bit() {
        const MAX_SAFE: i64 = (1i64 << 53) - 1;
        for _ in 0..200 {
            let id = next_id();
            assert!(id > 0, "雪花 ID 必须正数");
            assert!(
                id <= MAX_SAFE,
                "雪花 ID 必须 <= 2^53-1，否则 JS 丢精度：{id}"
            );
        }
    }

    #[test]
    fn next_id_is_strictly_monotonic_in_batch() {
        let mut prev = 0i64;
        for _ in 0..200 {
            let n = next_id();
            assert!(n > prev, "雪花 ID 不递增：{prev} >= {n}");
            prev = n;
        }
    }
}
