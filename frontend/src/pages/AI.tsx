import { useMemo, useState } from 'react'
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
    </div>
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
    formState: { errors, isSubmitting },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(900px,92vw)] !max-w-[min(900px,92vw)] min-w-[640px] p-6 text-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? '编辑 AI 配置' : '新增 AI 配置'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEdit
              ? '修改推理后端的名称、地址、模型名、API Key 等信息。'
              : '新增一个全局 AI 推理后端配置，配置后所有项目都可以使用。'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 pt-2"
          onSubmit={handleSubmit(async (raw) => {
            if (isEdit) {
              const req: UpdateAiBackendReq = {}
              if (raw.name !== undefined) req.name = raw.name.trim() || undefined
              req.category = raw.category
              if (raw.base_url !== undefined)
                req.base_url = raw.base_url.trim()
              if (raw.model_name !== undefined)
                req.model_name = raw.model_name.trim() || undefined
              if (raw.api_key !== undefined) req.api_key = raw.api_key.trim()
              req.is_default = raw.is_default
              if (raw.extra.trim()) req.extra = raw.extra.trim()
              await onUpdate(target.id, req)
            } else {
              const req: CreateAiBackendReq = {
                name: raw.name.trim() || '未命名配置',
                category: raw.category,
                base_url: raw.base_url.trim(),
                model_name: raw.model_name.trim(),
                api_key: raw.api_key.trim(),
                is_default: raw.is_default,
              }
              if (raw.extra.trim()) req.extra = raw.extra.trim()
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
              用于存放需要透传给 SDK 的自定义参数，调用时会原样读取。
            </p>
          </div>

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
              disabled={submitting || isSubmitting}
            >
              {submitting || isSubmitting
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
