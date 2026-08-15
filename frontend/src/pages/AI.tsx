import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  PlusSignCircleIcon,
  Edit02Icon,
  Delete02Icon,
  ReloadIcon,
  SparklesIcon,
  CheckmarkBadge01Icon,
  Book02Icon,
  PlayCircleIcon,
  CheckmarkCircle02Icon,
  Upload02Icon,
  FolderIcon,
  FolderCheckIcon,
  ArrowRightDoubleIcon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

import aiApi from '@/services/ai/api'
import {
  AI_CATEGORY_OPTIONS,
  type AiBackendConfig,
  type AiCategory,
  type CreateAiBackendReq,
  type UpdateAiBackendReq,
} from '@/services/ai/types'

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 项目中已验证可用的图标映射（避免用 hugeicons free 不存在的名字编译失败）
const CATEGORY_ICON = {
  text: Book02Icon,
  image: SparklesIcon,
  video: PlayCircleIcon,
  audio: Upload02Icon,
  embedding: ArrowRightDoubleIcon,
} as const

function categoryMeta(v: AiCategory) {
  return (
    AI_CATEGORY_OPTIONS.find((o) => o.value === v) ?? {
      value: v,
      label: v,
      desc: '',
      icon: 'text' as const,
    }
  )
}

function maskApiKey(key?: string | null): string {
  if (!key) return '—'
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

function formatTime(s?: string | null): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString()
  } catch {
    return s
  }
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function AIPage() {
  const queryClient = useQueryClient()

  const [activeCategory, setActiveCategory] = useState<AiCategory>('text')
  const [editTarget, setEditTarget] = useState<AiBackendConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AiBackendConfig | null>(null)
  const [promptTarget, setPromptTarget] = useState<AiBackendConfig | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // ---- 查询 ----
  const {
    data: list,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AiBackendConfig[]>({
    queryKey: ['ai-backends'],
    queryFn: () => aiApi.list(),
  })

  // ---- CRUD mutations ----
  const createMut = useMutation({
    mutationFn: (req: CreateAiBackendReq) => aiApi.create(req),
    onSuccess: () => {
      toast.add({ type: 'success', title: 'AI 配置已创建' })
      queryClient.invalidateQueries({ queryKey: ['ai-backends'] })
      setEditorOpen(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: (p: { id: number; req: UpdateAiBackendReq }) =>
      aiApi.update(p.id, p.req),
    onSuccess: () => {
      toast.add({ type: 'success', title: 'AI 配置已更新' })
      queryClient.invalidateQueries({ queryKey: ['ai-backends'] })
      setEditorOpen(false)
      setEditTarget(null)
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: number) => aiApi.remove(id),
    onSuccess: () => {
      toast.add({ type: 'success', title: '已删除 AI 配置' })
      queryClient.invalidateQueries({ queryKey: ['ai-backends'] })
      setDeleteTarget(null)
    },
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: number) => aiApi.setDefault(id),
    onSuccess: () => {
      toast.add({ type: 'success', title: '已设为默认' })
      queryClient.invalidateQueries({ queryKey: ['ai-backends'] })
    },
  })

  const grouped = useMemo(() => {
    const map = new Map<AiCategory, AiBackendConfig[]>()
    AI_CATEGORY_OPTIONS.forEach((o) => map.set(o.value, []))
    ;(list ?? []).forEach((cfg) => {
      if (!map.has(cfg.category)) map.set(cfg.category, [])
      map.get(cfg.category)!.push(cfg)
    })
    Array.from(map.values()).forEach((arr) =>
      arr.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
        return a.level - b.level
      }),
    )
    return map
  }, [list])

  const openingEditor = (target: AiBackendConfig | null) => {
    setEditTarget(target)
    setEditorOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            AI 配置
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            全局配置，所有项目共享。管理文本生成、图像生成、视频生成等多种推理后端。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              data-icon="inline-start"
              className={cn(isFetching && 'animate-spin')}
            />
            刷新
          </Button>
          <Button
            size="sm"
            disabled={createMut.isPending}
            onClick={() => openingEditor(null)}
          >
            <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
            新增 AI 配置
          </Button>
        </div>
      </div>

      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as AiCategory)}
      >
          <TabsList className="grid h-10 w-full grid-cols-5 text-sm">
            {AI_CATEGORY_OPTIONS.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="gap-1.5">
                <HugeiconsIcon icon={CATEGORY_ICON[c.icon]} />
                <span className="hidden sm:inline">{c.label}</span>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {(grouped.get(c.value) ?? []).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {AI_CATEGORY_OPTIONS.map((c) => (
            <TabsContent
              key={c.value}
              value={c.value}
              className="pt-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-card/60 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <HugeiconsIcon icon={CATEGORY_ICON[c.icon]} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{c.label}</h3>
                      {grouped.get(c.value)?.some((x) => x.is_default) && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          <HugeiconsIcon icon={CheckmarkBadge01Icon} />
                          已选默认
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.desc}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openingEditor(null)}
                  disabled={createMut.isPending}
                >
                  <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
                  添加 {c.label}
                </Button>
              </div>

              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-8 w-40" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (grouped.get(c.value) ?? []).length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Empty>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={SparklesIcon} />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>还没有 {c.label} 配置</EmptyTitle>
                        <EmptyDescription>
                          点击上方「添加 {c.label}」创建一个推理后端。
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {(grouped.get(c.value) ?? []).map((cfg) => (
                    <Card
                      key={cfg.id}
                      className={cn(
                        'transition-all',
                        cfg.is_default &&
                          'border-emerald-500/40 bg-emerald-500/[0.03]',
                      )}
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                        <div className="flex min-w-0 items-start gap-4">
                          <div
                            className={cn(
                              'flex size-11 shrink-0 items-center justify-center rounded-xl',
                              cfg.is_default
                                ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                : 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary',
                            )}
                          >
                            <HugeiconsIcon
                              icon={CATEGORY_ICON[categoryMeta(cfg.category).icon]}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="truncate text-base sm:text-lg">
                                {cfg.name}
                              </CardTitle>
                              {cfg.is_default && (
                                <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  <HugeiconsIcon icon={CheckmarkBadge01Icon} />
                                  默认
                                </Badge>
                              )}
                              <Badge variant="outline" className="gap-1">
                                <HugeiconsIcon icon={FolderIcon} />
                                {categoryMeta(cfg.category).label}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <HugeiconsIcon icon={Book02Icon} className="size-3.5" />
                                <span className="font-mono">{cfg.model_name}</span>
                              </span>
                              <Separator
                                orientation="vertical"
                                className="h-3"
                              />
                              <span className="flex items-center gap-1.5">
                                <HugeiconsIcon icon={FolderIcon} className="size-3.5" />
                                <span className="truncate font-mono max-w-[280px]">
                                  {cfg.base_url || '未填写'}
                                </span>
                              </span>
                              <Separator
                                orientation="vertical"
                                className="h-3 hidden sm:block"
                              />
                              <span className="flex items-center gap-1.5 hidden sm:flex">
                                <HugeiconsIcon icon={FolderCheckIcon} className="size-3.5" />
                                <span className="font-mono">
                                  {maskApiKey(cfg.api_key)}
                                </span>
                              </span>
                            </CardDescription>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              更新于 {formatTime(cfg.updated_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!cfg.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () =>
                                await setDefaultMut.mutateAsync(cfg.id)
                              }
                              disabled={setDefaultMut.isPending}
                              className="gap-1"
                            >
                              <HugeiconsIcon icon={CheckmarkBadge01Icon} />
                              <span className="hidden sm:inline">设为默认</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openingEditor(cfg)}
                          >
                            <HugeiconsIcon icon={Edit02Icon} />
                            <span className="sr-only">编辑</span>
                          </Button>
                          {cfg.category === 'text' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPromptTarget(cfg)}
                              className="gap-1 text-[11px] text-amber-700 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400 hover:bg-amber-500/10"
                            >
                              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
                              <span className="hidden sm:inline">Prompt 模板</span>
                              <span className="sm:hidden">Prompt</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(cfg)}
                            className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                            <span className="sr-only">删除</span>
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

      {/* 新增/编辑 Dialog */}
      <BackendDialog
        open={editorOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditorOpen(false)
            setEditTarget(null)
          }
        }}
        initialCategory={activeCategory}
        target={editTarget}
        onCreate={async (req) => await createMut.mutateAsync(req)}
        onUpdate={async (id, req) => await updateMut.mutateAsync({ id, req })}
        submitting={createMut.isPending || updateMut.isPending}
      />

      {/* 删除确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 AI 配置？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deleteTarget?.name}」，删除后不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMut.isPending}
              onClick={async () => {
                if (deleteTarget) await removeMut.mutateAsync(deleteTarget.id)
              }}
            >
              {removeMut.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 独立 Prompt 模板编辑 Dialog */}
      <PromptTemplateDialog
        open={promptTarget !== null}
        target={promptTarget}
        onOpenChange={(o) => {
          if (!o) setPromptTarget(null)
        }}
        onSaveSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['ai-backends'] })
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 自定义 Prompt 模板子 Dialog（专门用于编辑 4 个 Prompt 字段）
// ---------------------------------------------------------------------------

interface PromptTemplateValues {
  usr_prompt_genbyp_system: string
  usr_prompt_genbyp_user: string
  usr_prompt_genbyi_system: string
  usr_prompt_genbyi_user: string
}

function splitPromptFromExtra(
  extraJson: string | null | undefined,
): { values: PromptTemplateValues; otherExtra: Record<string, unknown> } {
  const empty: PromptTemplateValues = {
    usr_prompt_genbyp_system: '',
    usr_prompt_genbyp_user: '',
    usr_prompt_genbyi_system: '',
    usr_prompt_genbyi_user: '',
  }
  if (!extraJson) return { values: empty, otherExtra: {} }
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(extraJson) as Record<string, unknown>
  } catch {
    return { values: empty, otherExtra: {} }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { values: empty, otherExtra: {} }
  }
  const getParts = (
    key: 'usr_prompt_genbyp' | 'usr_prompt_genbyi',
  ): { system: string; user: string } => {
    const v = parsed![key]
    if (typeof v === 'string') return { system: v, user: '' }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      return {
        system: typeof o.system === 'string' ? o.system : '',
        user: typeof o.user === 'string' ? o.user : '',
      }
    }
    return { system: '', user: '' }
  }
  const byp = getParts('usr_prompt_genbyp')
  const byi = getParts('usr_prompt_genbyi')
  const clone = { ...parsed }
  delete clone.usr_prompt_genbyp
  delete clone.usr_prompt_genbyi
  return {
    values: {
      usr_prompt_genbyp_system: byp.system,
      usr_prompt_genbyp_user: byp.user,
      usr_prompt_genbyi_system: byi.system,
      usr_prompt_genbyi_user: byi.user,
    },
    otherExtra: clone,
  }
}

function buildPromptExtra(
  otherExtra: Record<string, unknown>,
  v: PromptTemplateValues,
): string | undefined {
  const merged: Record<string, unknown> = { ...otherExtra }
  const s1 = v.usr_prompt_genbyp_system.trim()
  const u1 = v.usr_prompt_genbyp_user.trim()
  const s2 = v.usr_prompt_genbyi_system.trim()
  const u2 = v.usr_prompt_genbyi_user.trim()
  if (s1 || u1) {
    const obj: Record<string, string> = {}
    if (s1) obj.system = s1
    if (u1) obj.user = u1
    merged.usr_prompt_genbyp =
      Object.keys(obj).length === 1 && obj.system
        ? obj.system
        : (obj as unknown as Record<string, unknown>)
  }
  if (s2 || u2) {
    const obj: Record<string, string> = {}
    if (s2) obj.system = s2
    if (u2) obj.user = u2
    merged.usr_prompt_genbyi =
      Object.keys(obj).length === 1 && obj.system
        ? obj.system
        : (obj as unknown as Record<string, unknown>)
  }
  if (Object.keys(merged).length === 0) return undefined
  return JSON.stringify(merged, null, 2)
}

function PromptTemplateDialog({
  open,
  target,
  onOpenChange,
  onSaveSuccess,
}: {
  open: boolean
  target: AiBackendConfig | null
  onOpenChange: (o: boolean) => void
  onSaveSuccess: () => void
}) {
  const [prevId, setPrevId] = useState<number | null>(null)
  const [otherExtra, setOtherExtra] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const {
    register,
    reset,
    handleSubmit,
    watch,
  } = useForm<PromptTemplateValues>({
    defaultValues: {
      usr_prompt_genbyp_system: '',
      usr_prompt_genbyp_user: '',
      usr_prompt_genbyi_system: '',
      usr_prompt_genbyi_user: '',
    },
  })

  useEffect(() => {
    if (open && target) {
      const uid = target.id ?? 0
      if (uid !== prevId) {
        setPrevId(uid)
        const { values, otherExtra: rest } = splitPromptFromExtra(target.extra)
        setOtherExtra(rest)
        reset(values)
      }
    }
  }, [open, target, prevId, reset])

  const wBypSys = watch('usr_prompt_genbyp_system')
  const wBypUser = watch('usr_prompt_genbyp_user')
  const wByiSys = watch('usr_prompt_genbyi_system')
  const wByiUser = watch('usr_prompt_genbyi_user')
  const filledCount = [wBypSys, wBypUser, wByiSys, wByiUser].filter(
    (s) => s.trim().length > 0,
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(1100px,94vw)] !max-w-[min(1100px,94vw)] !h-[min(820px,88vh)] !max-h-[min(820px,88vh)] min-h-[520px] flex flex-col overflow-hidden p-6 text-sm">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <HugeiconsIcon icon={SparklesIcon} className="text-amber-500" />
            自定义 Prompt 模板 · {target?.name ?? '未命名配置'}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            针对这个推理后端，单独定制 system / user prompt。
            <span className="text-foreground"> 留空的字段将继续使用系统默认</span>，
            只有你填写了的才会覆盖。当前已填写{' '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {filledCount} / 4
            </span>{' '}
            个模板字段。
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-1 flex-col gap-5 overflow-y-auto pr-2 pt-2"
          onSubmit={handleSubmit(async (raw) => {
            if (!target?.id) return
            const finalExtra = buildPromptExtra(otherExtra, raw)
            setSaving(true)
            try {
              await aiApi.update(target.id, { extra: finalExtra })
              toast.add({
                type: 'success',
                title: '自定义 Prompt 模板已保存',
                description: finalExtra
                  ? '下一次剧本生成时将优先使用本模板'
                  : '4 个模板均为空，已回退到系统默认 Prompt',
              })
              onSaveSuccess()
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          })}
        >
          <Tabs defaultValue="by-prompt" className="flex-1 flex flex-col">
            <TabsList className="grid h-9 w-full grid-cols-2 text-xs">
              <TabsTrigger value="by-prompt">模式 A · 故事大纲生成</TabsTrigger>
              <TabsTrigger value="by-import">模式 B · 小说导入改编</TabsTrigger>
            </TabsList>

            <TabsContent value="by-prompt" className="flex-1 space-y-3 pt-3">
              <Alert variant="default" className="border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
                <AlertTitle className="flex items-center gap-1.5 text-xs">
                  <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
                  可用变量（直接写到模板里，例如 {'{outline}'}）
                </AlertTitle>
                <AlertDescription className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-5">
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{outline}'}
                    </code>{' '}
                    故事大纲（原文）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{style}'}
                    </code>{' '}
                    风格：现代 / 古风 / 奇幻 / 日常（中文）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{genre}'}
                    </code>{' '}
                    类型：剧情 / 喜剧 / 冒险（中文）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{count}'}
                    </code>{' '}
                    生成集数（1-100）
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  System Prompt 覆盖
                  <span className="ml-1.5 font-normal">
                    （留空 → 系统默认；填写 → 完全替换系统默认 system）
                  </span>
                </label>
                <Textarea
                  {...register('usr_prompt_genbyp_system')}
                  value={wBypSys}
                  rows={11}
                  placeholder={[
                    '示例：你是一位资深漫剧剧本总编剧，擅长以三幕式结构把 {style} 类型的 {genre} 故事展开成 {count} 集。',
                    '请严格基于以下大纲生成：{outline}。要求只返回长度 = {count} 的 JSON 数组，每项 {title, content, duration_seconds}。',
                  ].join('\n')}
                  className="min-h-[260px] p-3 font-mono text-[12px] leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  User Prompt 覆盖
                  <span className="ml-1.5 font-normal">
                    （留空 → 系统默认；填写 → 完全替换系统默认 user）
                  </span>
                </label>
                <Textarea
                  {...register('usr_prompt_genbyp_user')}
                  value={wBypUser}
                  rows={6}
                  placeholder={[
                    '示例：',
                    '故事大纲：{outline}',
                    '风格：{style} / 类型：{genre} / 集数：{count}',
                    '请根据以上信息生成 {count} 集剧本，并以 JSON 数组返回。',
                  ].join('\n')}
                  className="min-h-[160px] p-3 font-mono text-[12px] leading-relaxed"
                />
              </div>
            </TabsContent>

            <TabsContent value="by-import" className="flex-1 space-y-3 pt-3">
              <Alert variant="default" className="border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
                <AlertTitle className="flex items-center gap-1.5 text-xs">
                  <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
                  可用变量（直接写到模板里，例如 {'{body}'}）
                </AlertTitle>
                <AlertDescription className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-5">
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{file_ext}'}
                    </code>{' '}
                    文件扩展名：txt / md / markdown
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{chars}'}
                    </code>{' '}
                    正文字数（汉字数）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{style_hint}'}
                    </code>{' '}
                    风格提示（无则写“自行判断”）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{genre_hint}'}
                    </code>{' '}
                    类型提示（无则写“自行判断”）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{est_count}'}
                    </code>{' '}
                    建议集数（原文字数 / 2500，clamp 1-100）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{style_line}'}
                    </code>{' '}
                    预渲染好的「风格：xxx」整行中文
                  </div>
                  <div className="col-span-2">
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{body}'}
                    </code>{' '}
                    小说正文全文（注意：放到 system 里会很容易触发超长，一般只放到 user prompt）
                  </div>
                  <div>
                    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                      {'{genre_line}'}
                    </code>{' '}
                    预渲染好的「类型：xxx」整行中文
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  System Prompt 覆盖
                  <span className="ml-1.5 font-normal">
                    （留空 → 系统默认；填写 → 完全替换系统默认 system）
                  </span>
                </label>
                <Textarea
                  {...register('usr_prompt_genbyi_system')}
                  value={wByiSys}
                  rows={11}
                  placeholder={[
                    '示例：你是一位漫剧剧本改编总编剧，擅长把长篇小说压缩为节奏紧凑的剧集，保留主线与名场面。',
                    '风格：{style_line}；类型：{genre_line}；建议拆分为 {est_count} 集（±20%）。',
                    '每集字段：title(3-12 字，不要“第X集”) / content(≥600 字，场景+动作+对白) / duration_seconds(180-600)。',
                    '必须只返回 JSON 数组，直接以 [ 开头，] 结尾，不要 markdown 或解释。',
                  ].join('\n')}
                  className="min-h-[260px] p-3 font-mono text-[12px] leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  User Prompt 覆盖
                  <span className="ml-1.5 font-normal">
                    （留空 → 系统默认；一般把 {'{body}'} 放到这里）
                  </span>
                </label>
                <Textarea
                  {...register('usr_prompt_genbyi_user')}
                  value={wByiUser}
                  rows={6}
                  placeholder={[
                    '示例：',
                    '文件类型：{file_ext}，字数约 {chars}，风格提示：{style_hint}，类型提示：{genre_hint}',
                    '建议拆成 {est_count} 集左右。小说正文如下：',
                    '{body}',
                  ].join('\n')}
                  className="min-h-[160px] p-3 font-mono text-[12px] leading-relaxed"
                />
              </div>
            </TabsContent>
          </Tabs>

          <details className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium text-foreground/80">
              预览合并后写入 backend.extra 的 JSON（只读）
            </summary>
            <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-foreground/5 p-2 font-mono text-[11px] text-foreground/80">
              {buildPromptExtra(otherExtra, {
                usr_prompt_genbyp_system: wBypSys,
                usr_prompt_genbyp_user: wBypUser,
                usr_prompt_genbyi_system: wByiSys,
                usr_prompt_genbyi_user: wByiUser,
              }) ?? '(empty → 不写 extra)'}
            </pre>
          </details>

          <DialogFooter>
            <DialogClose
              render={(props: any) => (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-4 text-sm"
                  {...props}
                  disabled={saving}
                >
                  取消
                </Button>
              )}
            />
            <Button
              type="submit"
              className="h-9 px-5 text-sm"
              disabled={saving}
            >
              {saving ? '保存中...' : '保存 Prompt 模板'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 新增/编辑 Dialog
// ---------------------------------------------------------------------------

function BackendDialog({
  open,
  onOpenChange,
  initialCategory,
  target,
  onCreate,
  onUpdate,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initialCategory: AiCategory
  target: AiBackendConfig | null
  onCreate: (req: CreateAiBackendReq) => Promise<unknown>
  onUpdate: (id: number, req: UpdateAiBackendReq) => Promise<unknown>
  submitting: boolean
}) {
  const isEdit = !!(target && target.id)
  const [prevId, setPrevId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<{
    name: string
    category: AiCategory
    base_url: string
    model_name: string
    api_key: string
    is_default: boolean
    extra: string
  }>({
    defaultValues: {
      name: '',
      category: initialCategory,
      base_url: '',
      model_name: '',
      api_key: '',
      is_default: false,
      extra: '',
    },
  })

  if (open) {
    const uid = isEdit ? target.id : 0
    if (uid !== prevId) {
      setPrevId(uid)
      if (isEdit) {
        reset({
          name: target.name ?? '',
          category: target.category ?? initialCategory,
          base_url: target.base_url ?? '',
          model_name: target.model_name ?? '',
          api_key: target.api_key ?? '',
          is_default: target.is_default ?? false,
          extra: target.extra ?? '',
        })
      } else {
        reset({
          name: '',
          category: initialCategory,
          base_url: '',
          model_name: '',
          api_key: '',
          is_default: false,
          extra: '',
        })
      }
    }
  }

  const activeCat = watch('category')
  const watchExtra = watch('extra')

  const normalizeExtra = (rawExtra: string): string | undefined => {
    const t = rawExtra.trim()
    if (!t) return undefined
    try {
      const p = JSON.parse(t) as unknown
      if (
        p === null ||
        (typeof p === 'object' &&
          !Array.isArray(p) &&
          Object.keys(p as Record<string, unknown>).length === 0)
      ) {
        return undefined
      }
      return JSON.stringify(p, null, 2)
    } catch {
      // 不是合法 JSON → 包到一个 __raw_extra key 里避免丢数据
      return JSON.stringify({ __raw_extra: t }, null, 2)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(820px,92vw)] !max-w-[min(820px,92vw)] min-w-[600px] p-6 text-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? '编辑 AI 配置' : '新增 AI 配置'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEdit
              ? '修改推理后端的名称、地址、模型名、API Key 等基本信息。'
              : '新增一个全局 AI 推理后端配置，配置后所有项目都可以使用。'}
            {isEdit && activeCat === 'text' && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                文本类后端的自定义 Prompt 模板，请回到卡片右侧点击「Prompt 模板」按钮单独编辑。
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 pt-2"
          onSubmit={handleSubmit(async (raw) => {
            const cleanWs = (s?: string | null) => (s ?? '').replace(/\s+/g, '')
            const finalExtra = normalizeExtra(raw.extra)
            if (isEdit) {
              const req: UpdateAiBackendReq = {}
              if (raw.name !== undefined) req.name = raw.name.trim() || undefined
              req.category = raw.category
              if (raw.base_url !== undefined)
                req.base_url = raw.base_url.trim()
              if (raw.model_name !== undefined)
                req.model_name = raw.model_name.trim() || undefined
              if (raw.api_key !== undefined) req.api_key = cleanWs(raw.api_key)
              req.is_default = raw.is_default
              if (finalExtra) req.extra = finalExtra
              await onUpdate(target.id, req)
            } else {
              const req: CreateAiBackendReq = {
                name: raw.name.trim() || '未命名配置',
                category: raw.category,
                base_url: raw.base_url.trim(),
                model_name: raw.model_name.trim(),
                api_key: cleanWs(raw.api_key),
                is_default: raw.is_default,
              }
              if (finalExtra) req.extra = finalExtra
              await onCreate(req)
            }
          })}
        >
          <div className="grid gap-5 sm:grid-cols-12">
            <div className="space-y-2 sm:col-span-8">
              <label className="text-sm font-medium">
                名称 <span className="text-rose-600">*</span>
              </label>
              <Input
                {...register('name', {
                  required: '请输入配置名称',
                  maxLength: { value: 100, message: '最多 100 个字符' },
                })}
                placeholder="例如：GPT-4o 剧本生成、Midjourney 人物设定..."
                autoFocus
                className="h-9 px-3 text-sm"
              />
              {errors.name && (
                <p className="text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-4">
              <label className="text-sm font-medium">
                类型 <span className="text-rose-600">*</span>
              </label>
              <Select
                items={AI_CATEGORY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={watch('category')}
                onValueChange={(v) => v && setValue('category', v as AiCategory)}
              >
                <SelectTrigger className="h-9 w-full px-3 text-sm">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex items-center gap-2">
                          <HugeiconsIcon icon={CATEGORY_ICON[o.icon]} />
                          <div className="flex flex-col">
                            <span className="text-sm">{o.label}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {o.desc}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <HugeiconsIcon icon={FolderIcon} />
                Base URL <span className="text-rose-600">*</span>
              </label>
              <Input
                {...register('base_url', {
                  required: '请输入 Base URL',
                })}
                placeholder="https://api.example.com/v1"
                className="h-9 px-3 text-sm font-mono"
              />
              {errors.base_url && (
                <p className="text-xs text-rose-600">
                  {errors.base_url.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <HugeiconsIcon icon={Book02Icon} />
                Model Name <span className="text-rose-600">*</span>
              </label>
              <Input
                {...register('model_name', {
                  required: '请输入模型名称',
                })}
                placeholder="gpt-4o / llama-3.1-70b-instruct / flux.1-dev ..."
                className="h-9 px-3 text-sm font-mono"
              />
              {errors.model_name && (
                <p className="text-xs text-rose-600">
                  {errors.model_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <HugeiconsIcon icon={FolderCheckIcon} />
              API Key <span className="text-rose-600">*</span>
            </label>
            <Input
              type="password"
              {...register('api_key', {
                required: '请输入 API Key',
              })}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="h-9 px-3 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              仅保存在本地配置中，不会上传到任何第三方服务器。
            </p>
            {errors.api_key && (
              <p className="text-xs text-rose-600">{errors.api_key.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <HugeiconsIcon
                icon={CheckmarkBadge01Icon}
                className="mt-0.5 text-amber-500"
              />
              <div>
                <p className="text-sm font-medium">设为该类型默认后端</p>
                <p className="text-xs text-muted-foreground">
                  当前类型：
                  <span className="font-medium text-foreground">
                    {categoryMeta(activeCat).label}
                  </span>
                  。启用后，后续生成{categoryMeta(activeCat).desc.replace(
                    /用于/,
                    '',
                  )}
                  将默认使用本配置。
                </p>
              </div>
            </div>
            <Toggle
              variant="outline"
              size="lg"
              pressed={watch('is_default')}
              onPressedChange={(pressed: boolean) =>
                setValue('is_default', !!pressed)
              }
              className="min-w-[92px] border-2"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              <span>{watch('is_default') ? '已启用' : '已关闭'}</span>
            </Toggle>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <HugeiconsIcon icon={PlayCircleIcon} />
              额外参数（可选，JSON/任意文本）
            </label>
            <Textarea
              {...register('extra')}
              rows={4}
              placeholder={`例如：\n{\n  "organization": "my-org",\n  "project": "my-project"\n}`}
              className="p-3 font-mono text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              用于存放需要透传给 SDK 的自定义参数（JSON 对象）。
              {activeCat === 'text' && (
                <>
                  {' '}
                  自定义 Prompt 模板请回到卡片右侧点击「Prompt 模板」按钮单独编辑，
                  不在这里填写。
                </>
              )}
            </p>
          </div>

          {watchExtra.trim() && (
            <details className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              <summary className="cursor-pointer select-none font-medium text-foreground/80">
                预览将写入 backend.extra 的 JSON（只读）
              </summary>
              <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-foreground/5 p-2 font-mono text-[11px] text-foreground/80">
                {(() => {
                  const preview = normalizeExtra(watchExtra)
                  return preview ?? '(empty)'
                })()}
              </pre>
            </details>
          )}

          <DialogFooter className="mt-1">
            <DialogClose
              render={(props: any) => (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-4 text-sm"
                  {...props}
                >
                  取消
                </Button>
              )}
            />
            <Button
              type="submit"
              className="h-9 px-4 text-sm"
              disabled={submitting}
            >
              {submitting
                ? '保存中...'
                : isEdit
                  ? '保存修改'
                  : '创建配置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
