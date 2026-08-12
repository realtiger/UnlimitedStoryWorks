import { useQuery } from '@tanstack/react-query'
import { Settings01Icon, Alert01Icon, PlayCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import http from '@/services/http'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// TS 类型：严格和 backend/src/config/model.rs 的 Rust struct 一一对应
// ---------------------------------------------------------------------------

export interface ServerConfig {
  host: string
  port: number
  graceful_shutdown_secs: number
}

export interface CorsConfig {
  allow_any_origin: boolean
  allow_origins: string[]
  allow_methods: string[]
  allow_headers: string[]
  allow_credentials: boolean
  max_age_secs: number
}

export interface SiteFeature {
  key: string
  name: string
  enabled: boolean
}

export interface SiteInfoConfig {
  name: string
  name_zh: string
  slogan: string
  description: string
  version: string
  environment: string
  features: SiteFeature[]
}

export interface LoggingConfig {
  level: string
  target: string
  file_dir: string
  file_prefix: string
  format: string
  keep_days: number
}

export interface AppConfig {
  server: ServerConfig
  cors: CorsConfig
  site_info: SiteInfoConfig
  logging: LoggingConfig
}

async function fetchAppConfig(): Promise<AppConfig> {
  return await http.get<AppConfig>('/api/v1/config')
}

export default function Settings() {
  const {
    data: cfg,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['settings', 'config'],
    queryFn: fetchAppConfig,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Settings01Icon}
              className="h-6 w-6 text-primary"
              data-icon="inline-start"
            />
            <h2 className="text-2xl font-semibold tracking-tight">
              系统设置
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            实时读取后端
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              config.yaml
            </code>
            的内容，证明 Axum 接口已打通 ✅
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className={cn(
            'h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow',
            'transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          {isRefetching ? '刷新中…' : '刷新'}
        </button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive">接口请求失败</CardTitle>
            <CardDescription>
              请先启动 Rust 后端（<code>cd backend && cargo run</code>），端口 5000
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <pre className="overflow-auto rounded bg-muted/50 p-3 text-xs text-destructive-foreground">
              {String(error)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 站点信息 */}
        <Card className="md:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {isLoading ? (
                <Skeleton className="h-5 w-36" />
              ) : (
                cfg?.site_info.name_zh
              )}
            </CardTitle>
            <CardDescription>
              {isLoading ? (
                <Skeleton className="mt-1 h-4 w-64" />
              ) : (
                <>
                  <span className="mr-2 font-medium">
                    v{cfg?.site_info.version}
                  </span>
                  <span className="mr-2 text-muted-foreground">·</span>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs',
                      cfg?.site_info.environment === 'production'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    )}
                  >
                    env={cfg?.site_info.environment}
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV k="英文名" isLoading={isLoading} v={cfg?.site_info.name} />
            <KV k="Slogan" isLoading={isLoading} v={cfg?.site_info.slogan} />
            <KV
              k="Description"
              isLoading={isLoading}
              v={cfg?.site_info.description}
            />

            <div className="pt-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                功能开关
              </div>
              <div className="flex flex-wrap gap-2">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-24 rounded-full" />
                    ))
                  : cfg?.site_info.features.map((f) => (
                      <span
                        key={f.key}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs',
                          f.enabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            f.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                          )}
                        />
                        {f.name}
                        <span className="ml-0.5 text-[10px] text-muted-foreground/70">
                          ({f.key})
                        </span>
                      </span>
                    ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Server</CardTitle>
            <CardDescription>
              监听地址与端口（config.yaml → server）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV k="Host" isLoading={isLoading} v={cfg?.server.host} mono />
            <KV
              k="Port"
              isLoading={isLoading}
              v={cfg?.server.port?.toString()}
              mono
            />
            <KV
              k="Listen"
              isLoading={isLoading}
              v={
                cfg ? `http://${cfg.server.host}:${cfg.server.port}` : undefined
              }
              mono
            />
            <KV
              k="Graceful shutdown"
              isLoading={isLoading}
              v={
                cfg
                  ? `${cfg.server.graceful_shutdown_secs}s`
                  : undefined
              }
            />
            <div className="pt-2 space-y-1">
              <a
                href="/swagger-ui/"
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                → 打开 Swagger UI（/swagger-ui/）
              </a>
              <a
                href="/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                → 查看 OpenAPI JSON schema
              </a>
            </div>
          </CardContent>
        </Card>

        {/* CORS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CORS</CardTitle>
            <CardDescription>跨域白名单配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV
              k="Allow any origin"
              isLoading={isLoading}
              v={cfg?.cors.allow_any_origin ? '✅ 开启' : '仅限白名单'}
            />
            {!cfg?.cors.allow_any_origin && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  白名单
                </div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="mt-1 h-4 w-48" />
                  </>
                ) : (
                  <ul className="space-y-0.5 font-mono text-xs">
                    {!cfg || cfg.cors.allow_origins.length === 0 ? (
                      <li className="text-muted-foreground">(空)</li>
                    ) : (
                      cfg.cors.allow_origins.map((o) => (
                        <li key={o}>• {o}</li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
            <KV
              k="Methods"
              isLoading={isLoading}
              v={cfg?.cors.allow_methods.join(', ')}
            />
            <KV
              k="Headers"
              isLoading={isLoading}
              v={cfg?.cors.allow_headers.join(', ')}
            />
            <KV
              k="Credentials"
              isLoading={isLoading}
              v={cfg?.cors.allow_credentials ? '允许' : '禁止'}
            />
            <KV
              k="Max-Age"
              isLoading={isLoading}
              v={cfg ? `${cfg.cors.max_age_secs}s` : undefined}
            />
          </CardContent>
        </Card>

        {/* Logging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Logging</CardTitle>
            <CardDescription>日志输出目标与格式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV
              k="Level"
              isLoading={isLoading}
              v={cfg?.logging.level?.toUpperCase()}
              mono
            />
            <KV
              k="Target"
              isLoading={isLoading}
              v={cfg?.logging.target}
              mono
            />
            <KV
              k="Format"
              isLoading={isLoading}
              v={cfg?.logging.format}
              mono
            />
            <KV
              k="File dir"
              isLoading={isLoading}
              v={cfg?.logging.file_dir}
              mono
            />
            <KV
              k="File prefix"
              isLoading={isLoading}
              v={cfg?.logging.file_prefix}
              mono
            />
            <KV
              k="File pattern"
              isLoading={isLoading}
              v={
                cfg
                  ? `${cfg.logging.file_prefix}.YYYY-MM-DD`
                  : undefined
              }
              mono
            />
            <KV
              k="Keep days"
              isLoading={isLoading}
              v={
                cfg
                  ? cfg.logging.keep_days > 0
                    ? `${cfg.logging.keep_days} 天`
                    : '默认 7 天（缺省 / 0）'
                  : undefined
              }
            />
          </CardContent>
        </Card>

        {/* 连通性自检 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">连通性自检</CardTitle>
            <CardDescription>
              Axum（:5000） ↔ Vite 代理（:5173）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2',
                isLoading
                  ? 'bg-muted'
                  : error
                    ? 'bg-destructive/10'
                    : 'bg-emerald-500/10'
              )}
            >
              <span className="font-medium">
                GET /api/v1/config
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  isLoading
                    ? 'bg-muted text-muted-foreground'
                    : error
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-emerald-600 text-white'
                )}
              >
                {isLoading
                  ? 'Loading…'
                  : error
                    ? '✗ Failed'
                    : '✓ OK (200)'}
              </span>
            </div>
            {cfg && !error && (
              <pre className="overflow-auto rounded bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
{`{
  "code":    "S00000",
  "success": true,
  "message": "ok",
  "data":    ${JSON.stringify(
    {
      name: cfg.site_info.name,
      port: cfg.server.port,
      logging_target: cfg.logging.target,
      keep_days: cfg.logging.keep_days,
    },
    null,
    2
  ).replace(/^\s*|\s*$/gm, '')}
  ...
}`}
              </pre>
            )}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={Alert01Icon}
                  className="inline size-4 -translate-y-[1px] text-amber-500"
                />{' '}
                错误提示演示：点击下方按钮，会触发 <code className="rounded bg-muted px-1">GET /api/v1/error-demo</code>，
                <span className="text-destructive"> http.ts 会自动 toast.error 鸣响提示</span>。
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  http.get('/api/v1/error-demo', {
                    params: { kind: 'invalid_param' },
                  }).catch(() => {
                    /* 接口约定：错误 toast + beep 已经在 http.ts 全局处理；
                       调用方如果不想让用户看到这个 Promise 跑空
                       就空 catch。业务场景下这里应该改成表单内联展示，
                       那时候把 swallowError=true 即可。 */
                  })
                }
              >
                <HugeiconsIcon icon={PlayCircleIcon} className="size-4" />
                触发错误提示（演示 toast 鸣响）
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 小组件：K-V 列表一行 + loading skeleton
// ---------------------------------------------------------------------------

function KV({
  k,
  v,
  isLoading,
  mono,
}: {
  k: string
  v?: string | number | boolean | undefined
  isLoading: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {k}
      </span>
      {isLoading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : (
        <span
          className={cn(
            'truncate text-right',
            mono &&
              'font-mono text-xs text-foreground/90 bg-muted/50 rounded px-1.5 py-0.5'
          )}
        >
          {v === undefined || v === '' || v === null ? '—' : String(v)}
        </span>
      )}
    </div>
  )
}
