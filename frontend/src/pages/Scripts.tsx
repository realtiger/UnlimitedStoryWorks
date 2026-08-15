import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  PlusSignCircleIcon,
  Edit02Icon,
  Delete02Icon,
  ReloadIcon,
  SparklesIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Upload02Icon,
  Book02Icon,
  PlayCircleIcon,
  FolderAddIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

import scriptsApi, { type GenerateHeartbeat } from '@/services/scripts/api'
import aiApi from '@/services/ai/api'
import {
  GENRE_VALUE_TO_LABEL,
  STORY_GENRE_OPTIONS,
  STORY_STYLE_OPTIONS,
  STYLE_VALUE_TO_LABEL,
  type CreateEpisodeReq,
  type Episode,
  type GenerateEpisodesByImportReq,
  type GenerateEpisodesByPromptReq,
  type GenerateMode,
  type StoryGenre,
  type StoryStyle,
  type UpdateEpisodeReq,
} from '@/services/scripts/types'
import { useProjectStore } from '@/store/useProjectStore'
import type { AiBackendConfig } from '@/services/ai/types'

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function formatTime(s?: string | null): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString()
  } catch {
    return s
  }
}

function formatDuration(sec?: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}分${s > 0 ? s + '秒' : ''}` : `${s}秒`
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function ScriptsPage() {
  const queryClient = useQueryClient()
  const { selectedProject, selectedEpisode, selectEpisode } = useProjectStore()
  const projectId = selectedProject?.id ?? null

  const [editTarget, setEditTarget] = useState<Episode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Episode | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genProgress, setGenProgress] = useState<GenerateHeartbeat | null>(null)

  // ---- 查询 ----
  const {
    data: list,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Episode[]>({
    queryKey: ['episodes', projectId],
    queryFn: () => scriptsApi.list({ project_id: projectId! }),
    enabled: projectId !== null,
  })

  // ---- 新建 ----
  const createMut = useMutation({
    mutationFn: (req: CreateEpisodeReq) => scriptsApi.create(req),
    onSuccess: () => {
      toast.add({ type: 'success', title: '添加成功' })
      queryClient.invalidateQueries({ queryKey: ['episodes', projectId] })
    },
  })

  // ---- 编辑 ----
  const updateMut = useMutation({
    mutationFn: (p: { id: number; req: UpdateEpisodeReq }) =>
      projectId ? scriptsApi.update(projectId, p.id, p.req) : Promise.reject(),
    onSuccess: () => {
      toast.add({ type: 'success', title: '保存成功' })
      queryClient.invalidateQueries({ queryKey: ['episodes', projectId] })
      setEditTarget(null)
    },
  })

  // ---- 删除 ----
  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      projectId ? scriptsApi.remove(projectId, id) : Promise.reject(),
    onSuccess: () => {
      toast.add({ type: 'success', title: '删除成功' })
      queryClient.invalidateQueries({ queryKey: ['episodes', projectId] })
      setDeleteTarget(null)
    },
  })

  // ---- 上下移动 ----
  const moveMut = useMutation({
    mutationFn: (p: { id: number; direction: 'up' | 'down' }) =>
      projectId
        ? scriptsApi.move(projectId, p.id, { project_id: projectId, direction: p.direction })
        : Promise.reject(),
    onSuccess: () => {
      toast.add({ type: 'success', title: '已调整顺序' })
      queryClient.invalidateQueries({ queryKey: ['episodes', projectId] })
    },
  })

  // ---- 自动生成 ----
  const genMut = useMutation({
    mutationFn: (req: GenerateEpisodesByPromptReq | GenerateEpisodesByImportReq) => {
      setGenProgress({ elapsed_ms: 0, stage: 'prepare_prompt' })
      return 'file_ext' in req
        ? scriptsApi.generateByImportStream(req as GenerateEpisodesByImportReq, (hb) =>
            setGenProgress(hb),
          )
        : scriptsApi.generateByPromptStream(req as GenerateEpisodesByPromptReq, (hb) =>
            setGenProgress(hb),
          )
    },
    onSuccess: () => {
      toast.add({ type: 'success', title: '生成任务已提交并写入剧集列表' })
      queryClient.invalidateQueries({ queryKey: ['episodes', projectId] })
      setGenProgress(null)
      setGenOpen(false)
    },
    onError: () => {
      setGenProgress(null)
    },
  })

  const episodes = useMemo(
    () =>
      [...(list ?? [])]
        .sort((a, b) => a.level - b.level)
        .map((ep, idx) => ({ ep, no: idx + 1 })),
    [list],
  )
  const hasProject = projectId !== null

  useEffect(() => {
    if (!hasProject || !selectedEpisode) return
    const exists = episodes.some(({ ep }) => ep.id === selectedEpisode.id)
    if (!exists) selectEpisode(null)
  }, [episodes, selectedEpisode, hasProject, selectEpisode])

  return (
    <div className="flex flex-col gap-6">
      {/* 标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            剧本管理
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasProject
              ? `当前项目：${selectedProject?.name} · 共 ${episodes.length} 集`
              : '请先在项目管理中选择一个项目'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={!hasProject || isFetching}
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              data-icon="inline-start"
              className={cn(isFetching && 'animate-spin')}
            />
            刷新
          </Button>
          <GenerateDialog
            open={genOpen}
            onOpenChange={setGenOpen}
            disabled={!hasProject || genMut.isPending}
            submitting={genMut.isPending}
            projectId={projectId}
            onSubmit={async (req) => await genMut.mutateAsync(req)}
            progress={genProgress}
          />
          <Button
            size="sm"
            disabled={!hasProject || createMut.isPending}
            onClick={() => setEditTarget({ id: 0 } as Episode)}
          >
            <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
            添加一集
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      {!hasProject ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Empty>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={FolderAddIcon} />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>暂未选择项目</EmptyTitle>
                <EmptyDescription>
                  剧本与项目绑定，请先前往项目管理选择或创建一个项目。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-5 w-56" />
                  </div>
                  <Skeleton className="h-8 w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Empty>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Book02Icon} />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>暂无剧集</EmptyTitle>
                <EmptyDescription>
                  点击右上角「自动生成」批量创建，或通过「添加一集」手动添加。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
            <div className="mt-6 flex items-center gap-2">
              <GenerateDialog
                open={false}
                onOpenChange={(o) => setGenOpen(o)}
                disabled={genMut.isPending}
                submitting={genMut.isPending}
                projectId={projectId}
                onSubmit={async (req) => await genMut.mutateAsync(req)}
                progress={genProgress}
                inline
              />
              <Button
                size="sm"
                disabled={createMut.isPending}
                onClick={() => setEditTarget({} as any)}
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
                添加一集
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {episodes.map(({ ep, no }, idx) => {
            const canMoveUp = idx > 0
            const canMoveDown = idx < episodes.length - 1
            const isSelected = selectedEpisode?.id === ep.id
            return (
              <Card
                key={ep.id}
                onClick={() => selectEpisode(ep)}
                className={cn(
                  'transition-all duration-200 cursor-pointer',
                  'hover:shadow-sm hover:border-border/80',
                  isSelected && 'ring-2 ring-primary/60 border-primary/60 shadow-sm',
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                      <span className="text-sm font-bold tabular-nums">
                        {String(no).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="truncate text-base sm:text-lg">
                          {ep.title || `第 ${no} 集（未命名）`}
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px]">
                          第 {no} 集
                        </Badge>
                      </div>
                      <CardDescription className="mt-1 line-clamp-2">
                        {ep.content
                          ? `${ep.content.slice(0, 80)}${ep.content.length > 80 ? '...' : ''}`
                          : '暂无剧本内容'}
                      </CardDescription>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>时长 {formatDuration(ep.duration_seconds)}</span>
                        <span>·</span>
                        <span>更新于 {formatTime(ep.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(props: any) => (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={moveMut.isPending}
                            {...props}
                          >
                            <HugeiconsIcon
                              icon={ArrowUp01Icon}
                              className={cn(!canMoveUp && 'opacity-40')}
                            />
                            <span className="sr-only">排序</span>
                          </Button>
                        )}
                      />
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          disabled={!canMoveUp || moveMut.isPending}
                          onClick={async () => {
                            await moveMut.mutateAsync({ id: ep.id, direction: 'up' })
                          }}
                        >
                          <HugeiconsIcon icon={ArrowUp01Icon} data-icon="inline-start" />
                          上移
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canMoveDown || moveMut.isPending}
                          onClick={async () => {
                            await moveMut.mutateAsync({ id: ep.id, direction: 'down' })
                          }}
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} data-icon="inline-start" />
                          下移
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditTarget(ep)}
                    >
                      <HugeiconsIcon icon={Edit02Icon} />
                      <span className="sr-only">编辑</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(ep)}
                      className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      <span className="sr-only">删除</span>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      {/* 编辑/新建 单集 Dialog */}
      <EpisodeEditDialog
        episode={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
        projectId={projectId}
        onCreate={async (req) => await createMut.mutateAsync(req)}
        onUpdate={async (id, req) => await updateMut.mutateAsync({ id, req })}
        submitting={createMut.isPending || updateMut.isPending}
      />

      {/* 删除确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deleteTarget?.title}」。
              删除后不可撤销，确定继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={async () => {
                if (deleteTarget) await deleteMut.mutateAsync(deleteTarget.id)
              }}
            >
              {deleteMut.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 自动生成 Dialog
// ---------------------------------------------------------------------------

interface GenerateFormByPrompt {
  story_outline: string
  style: StoryStyle
  genre: StoryGenre
  episode_count: number
  ai_backend_id: number | null
}

interface GenerateFormByImport {
  file_name: string
  file_content: string
  style: StoryStyle
  genre: StoryGenre
  episode_count: number
  ai_backend_id: number | null
}

function GenerateDialog({
  open,
  onOpenChange,
  disabled,
  submitting,
  projectId,
  onSubmit,
  progress,
  inline = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  disabled?: boolean
  submitting: boolean
  projectId: number | null
  onSubmit: (req: GenerateEpisodesByPromptReq | GenerateEpisodesByImportReq) => Promise<unknown>
  progress?: GenerateHeartbeat | null
  inline?: boolean
}) {
  const [mode, setMode] = useState<GenerateMode>('prompt')
  const [localOpen, setLocalOpen] = useState(open)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const StageLabel: Record<GenerateHeartbeat['stage'], string> = {
    prepare_prompt: '正在准备系统 Prompt …',
    calling_llm: '正在调用大模型推理生成剧本 …',
    bulk_create: '正在批量写入剧集列表 …',
  }
  function ProgressBox({
    progress,
    className,
  }: {
    progress?: GenerateHeartbeat | null
    className?: string
  }) {
    const p = progress?.progress ?? 0
    const stage = progress ? StageLabel[progress.stage] : '初始化任务 …'
    const seconds = progress
      ? (progress.elapsed_ms / 1000).toFixed(progress.elapsed_ms >= 60_000 ? 0 : 1)
      : '0.0'
    return (
      <div className={cn('rounded-lg border border-muted bg-muted/30 p-4', className)}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-foreground">{stage}</span>
          </div>
          <div>已耗时 {seconds}s</div>
        </div>
        <div className="mt-3">
          <Progress value={Math.min(99, p)} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div>
            {progress?.stage === 'calling_llm'
              ? '生成时间随集数、大模型响应速度而定，每 3 秒发送一次心跳，连接不会中断'
              : progress?.stage === 'bulk_create'
                ? '将生成的剧集批量写入数据库'
                : '初始化 Prompt 模板与后端配置'}
          </div>
          <div className="font-mono tabular-nums">{Math.min(99, p)}%</div>
        </div>
      </div>
    )
  }

  const { data: textBackends, isFetching: isBackendsLoading } = useQuery<
    AiBackendConfig[],
    unknown
  >({
    queryKey: ['ai-backends', 'text'],
    queryFn: async () => {
      try {
        return await aiApi.list({ category: 'text', limit: 100 })
      } catch {
        return []
      }
    },
    enabled: localOpen,
    staleTime: 30_000,
  })

  const defaultBackend = useMemo(
    () => textBackends?.find((b) => b.is_default),
    [textBackends],
  )

  if (localOpen !== open) setLocalOpen(open)

  const promptForm = useForm<GenerateFormByPrompt>({
    defaultValues: {
      story_outline: '',
      style: 'modern',
      genre: 'drama',
      episode_count: 3,
      ai_backend_id: null,
    },
  })

  const importForm = useForm<GenerateFormByImport>({
    defaultValues: {
      file_name: '',
      file_content: '',
      style: 'modern',
      genre: 'drama',
      episode_count: 3,
      ai_backend_id: null,
    },
  })

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? ''
      importForm.setValue('file_name', file.name)
      importForm.setValue('file_content', text)
    }
    reader.readAsText(file)
  }

  const fileExtOf = (name: string) => {
    const idx = name.lastIndexOf('.')
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : 'txt'
  }

  const submitPrompt = promptForm.handleSubmit(async (raw) => {
    if (!projectId) return
    const req: GenerateEpisodesByPromptReq = {
      project_id: projectId,
      outline: raw.story_outline,
      style: STYLE_VALUE_TO_LABEL[raw.style],
      genre: GENRE_VALUE_TO_LABEL[raw.genre],
      count: raw.episode_count,
      ai_backend_id: raw.ai_backend_id ?? undefined,
    }
    try {
      await onSubmit(req)
      promptForm.reset()
    } catch {
      /* toast already */
    }
  })

  const submitImport = importForm.handleSubmit(async (raw) => {
    if (!projectId) return
    if (!raw.file_content) {
      toast.add({ type: 'error', title: '请先上传小说文件' })
      return
    }
    const req: GenerateEpisodesByImportReq = {
      project_id: projectId,
      file_ext: fileExtOf(raw.file_name || 'novel.txt'),
      content: raw.file_content,
      style_hint: STYLE_VALUE_TO_LABEL[raw.style],
      genre_hint: GENRE_VALUE_TO_LABEL[raw.genre],
      ai_backend_id: raw.ai_backend_id ?? undefined,
    }
    try {
      await onSubmit(req)
      importForm.reset()
    } catch {
      /* toast already */
    }
  })

  if (inline) {
    return (
      <Button size="sm" disabled={disabled} onClick={() => onOpenChange(true)}>
        <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
        自动生成
      </Button>
    )
  }

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        onClick={() => onOpenChange(true)}
      >
        <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
        自动生成
      </Button>
      <Dialog
        open={localOpen}
        onOpenChange={(o) => {
          setLocalOpen(o)
          onOpenChange(o)
          if (!o) {
            promptForm.reset()
            importForm.reset()
            setMode('prompt')
          }
        }}
      >
        <DialogContent className="!w-[min(1000px,92vw)] !max-w-[min(1000px,92vw)] !h-[min(680px,85vh)] !max-h-[min(680px,85vh)] min-w-[640px] min-h-[480px] flex flex-col overflow-hidden p-6 text-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">自动生成剧集</DialogTitle>
          <DialogDescription className="text-sm">
            根据故事大纲或已有小说批量生成剧本，所有集数将自动归属当前项目。
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as GenerateMode)}
          className="mt-3 flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid h-10 w-full grid-cols-2 text-sm">
            <TabsTrigger value="prompt">
              <HugeiconsIcon icon={Book02Icon} data-icon="inline-start" />
              故事大纲
            </TabsTrigger>
            <TabsTrigger value="import">
              <HugeiconsIcon icon={Upload02Icon} data-icon="inline-start" />
              导入小说
            </TabsTrigger>
          </TabsList>

          {/* 方式 A：故事大纲 */}
          <TabsContent value="prompt" className="flex-1 overflow-y-auto pr-2">
            <form
              className="flex flex-col gap-5 pt-3"
              onSubmit={submitPrompt}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">故事大概 *</label>
                <Textarea
                  {...promptForm.register('story_outline', {
                    required: '请输入故事大概',
                    minLength: { value: 10, message: '至少 10 个字' },
                  })}
                  rows={10}
                  className="min-h-[220px] p-3 text-sm leading-relaxed"
                  placeholder="例如：平凡的高中生意外获得穿越时空的能力，在现代与古代之间穿梭解决谜团，最终领悟珍惜当下的意义..."
                />
                {promptForm.formState.errors.story_outline && (
                  <p className="text-xs text-rose-600">
                    {promptForm.formState.errors.story_outline.message}
                  </p>
                )}
              </div>

              <StyleAndGenreAndCount
                styleValue={promptForm.watch('style')}
                genreValue={promptForm.watch('genre')}
                episodeCount={promptForm.watch('episode_count')}
                textBackends={textBackends ?? []}
                defaultBackend={defaultBackend}
                isBackendsLoading={isBackendsLoading}
                aiBackendId={promptForm.watch('ai_backend_id')}
                onAiBackendChange={(v) => promptForm.setValue('ai_backend_id', v)}
                onStyleChange={(v) => promptForm.setValue('style', v as StoryStyle)}
                onGenreChange={(v) => promptForm.setValue('genre', v as StoryGenre)}
                onCountChange={(v) => promptForm.setValue('episode_count', v)}
              />

              {submitting && (
                <ProgressBox progress={progress} className="mt-5" />
              )}

              <DialogFooter className="mt-2">
                <DialogClose
                  render={(props: any) => (
                    <Button type="button" variant="outline" className="h-9 px-4 text-sm" {...props}>
                      取消
                    </Button>
                  )}
                />
                <Button
                  type="submit"
                  className="h-9 px-4 text-sm"
                  disabled={
                    submitting ||
                    promptForm.formState.isSubmitting ||
                    !projectId
                  }
                >
                  <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
                  {submitting ? '生成中...' : '开始生成'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* 方式 B：导入小说 */}
          <TabsContent value="import" className="flex-1 overflow-y-auto pr-2">
            <form
              className="flex flex-col gap-5 pt-3"
              onSubmit={submitImport}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">小说文件 *</label>
                <div
                  className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <HugeiconsIcon
                    icon={PlayCircleIcon}
                    className="size-12 text-muted-foreground/70"
                  />
                  {importForm.watch('file_name') ? (
                    <div className="flex flex-col items-center gap-2">
                      <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                        <HugeiconsIcon icon={PlayCircleIcon} />
                        {importForm.watch('file_name')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {importForm.watch('file_content').length.toLocaleString()} 字 · 点击重新选择
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <p className="text-base font-medium">
                        点击上传 .txt / .md 文件
                      </p>
                      <p className="text-xs text-muted-foreground">
                        支持纯文本格式，字数越多生成效果越好
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFile(f)
                    }}
                  />
                </div>
              </div>

              <StyleAndGenreAndCount
                styleValue={importForm.watch('style')}
                genreValue={importForm.watch('genre')}
                episodeCount={importForm.watch('episode_count')}
                textBackends={textBackends ?? []}
                defaultBackend={defaultBackend}
                isBackendsLoading={isBackendsLoading}
                aiBackendId={importForm.watch('ai_backend_id')}
                onAiBackendChange={(v) => importForm.setValue('ai_backend_id', v)}
                onStyleChange={(v) => importForm.setValue('style', v as StoryStyle)}
                onGenreChange={(v) => importForm.setValue('genre', v as StoryGenre)}
                onCountChange={(v) => importForm.setValue('episode_count', v)}
                showEpisodeCount={false}
              />

              {submitting && (
                <ProgressBox progress={progress} className="mt-5" />
              )}

              <DialogFooter className="mt-2">
                <DialogClose
                  render={(props: any) => (
                    <Button type="button" variant="outline" className="h-9 px-4 text-sm" {...props}>
                      取消
                    </Button>
                  )}
                />
                <Button
                  type="submit"
                  className="h-9 px-4 text-sm"
                  disabled={
                    submitting ||
                    importForm.formState.isSubmitting ||
                    !projectId
                  }
                >
                  <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
                  {submitting ? '生成中...' : '开始生成'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// 共用：风格、类型、集数选择 + 本次推理模型选择
// ---------------------------------------------------------------------------

function StyleAndGenreAndCount({
  styleValue,
  genreValue,
  episodeCount,
  textBackends,
  defaultBackend,
  isBackendsLoading,
  aiBackendId,
  onAiBackendChange,
  onStyleChange,
  onGenreChange,
  onCountChange,
  showEpisodeCount = true,
}: {
  styleValue: StoryStyle
  genreValue: StoryGenre
  episodeCount: number
  textBackends: AiBackendConfig[]
  defaultBackend?: AiBackendConfig
  isBackendsLoading?: boolean
  aiBackendId: number | null
  onAiBackendChange: (v: number | null) => void
  onStyleChange: (v: StoryStyle) => void
  onGenreChange: (v: StoryGenre) => void
  onCountChange: (v: number) => void
  showEpisodeCount?: boolean
}) {
  const backendItems = useMemo(() => {
    const arr: { value: string; label: string; hint?: string }[] = [
      {
        value: '',
        label: defaultBackend ? `默认（${defaultBackend.name} · ${defaultBackend.model_name}）` : '默认后端',
        hint: defaultBackend ? '使用 text 类当前 is_default 的配置' : '未配置默认，请前往 AI 配置',
      },
    ]
    for (const b of textBackends ?? []) {
      if (defaultBackend && b.id === defaultBackend.id) continue
      arr.push({
        value: String(b.id),
        label: `${b.name} · ${b.model_name}${b.is_default ? '（默认）' : ''}`,
        hint: b.base_url,
      })
    }
    return arr
  }, [textBackends, defaultBackend])
  const currentBackendValue = aiBackendId ? String(aiBackendId) : ''
  const currentBackendLabel = backendItems.find((it) => it.value === currentBackendValue)?.label

  const currentStyleLabel = STORY_STYLE_OPTIONS.find((o) => o.value === styleValue)?.label
  const currentGenreLabel = STORY_GENRE_OPTIONS.find((o) => o.value === genreValue)?.label

  const topColSpan = showEpisodeCount ? 'sm:col-span-6' : 'sm:col-span-6'

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-12">
        <div className={`space-y-2 ${topColSpan}`}>
          <label className="text-sm font-medium">故事风格</label>
          <Select
            value={styleValue}
            onValueChange={(v) => v && onStyleChange(v as StoryStyle)}
          >
            <SelectTrigger className="h-9 w-full px-3 text-sm">
              <SelectValue placeholder="选择风格">{currentStyleLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {STORY_STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className={`space-y-2 ${topColSpan}`}>
          <label className="text-sm font-medium">类型</label>
          <Select
            value={genreValue}
            onValueChange={(v) => v && onGenreChange(v as StoryGenre)}
          >
            <SelectTrigger className="h-9 w-full px-3 text-sm">
              <SelectValue placeholder="选择类型">{currentGenreLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {STORY_GENRE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

      </div>

      {showEpisodeCount && (
        <div className="space-y-2 sm:col-span-4">
          <label className="text-sm font-medium">生成集数</label>
          <Input
            type="number"
            min={1}
            max={100}
            step={1}
            value={episodeCount}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n)) return
              const clamped = Math.max(1, Math.min(100, Math.floor(n)))
              onCountChange(clamped)
            }}
            className="h-9 px-3 text-sm"
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            建议 1–100 集。实际生成受 LLM context 限制，过多集数可能被截断。
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center justify-between">
          <span>模型推理配置</span>
          <a
            href="/ai-config"
            className="text-[11px] font-normal text-muted-foreground underline-offset-2 hover:underline"
          >
            管理
          </a>
        </label>
        <Select
          value={aiBackendId ? String(aiBackendId) : ''}
          onValueChange={(v) =>
            onAiBackendChange(v && v.length > 0 ? Number(v) : null)
          }
        >
          <SelectTrigger className="h-9 w-full px-3 text-sm">
            <SelectValue
              placeholder={
                isBackendsLoading ? '加载模型列表…' : '选择本次推理用哪个配置'
              }
            >
              {currentBackendLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-w-lg">
            <SelectGroup>
              {backendItems.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col gap-0.5 text-left">
                    <div className="font-medium leading-5">{opt.label}</div>
                    {opt.hint && (
                      <div className="truncate text-[11px] leading-4 text-muted-foreground">
                        {opt.hint}
                      </div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-[11px] leading-4 text-muted-foreground">
          留空使用「文本生成」类的默认后端。如果某个后端下配置了自定义 Prompt 模板，会自动覆盖系统默认 Prompt。
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 添加/编辑 单集 Dialog
// ---------------------------------------------------------------------------

function EpisodeEditDialog({
  episode,
  open,
  onOpenChange,
  projectId,
  onCreate,
  onUpdate,
  submitting,
}: {
  episode: Episode | null
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId: number | null
  onCreate: (req: CreateEpisodeReq) => Promise<unknown>
  onUpdate: (id: number, req: UpdateEpisodeReq) => Promise<unknown>
  submitting: boolean
}) {
  const isEdit = !!(episode && episode.id)
  const [prevId, setPrevId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<{
    title: string
    content: string
    duration_minutes: number
    duration_seconds: number
  }>({
    defaultValues: {
      title: '',
      content: '',
      duration_minutes: 0,
      duration_seconds: 0,
    },
  })

  if (open) {
    const uid = isEdit ? episode.id : -1
    if (uid !== prevId) {
      setPrevId(uid)
      if (isEdit) {
        const totalSec = episode.duration_seconds ?? 0
        reset({
          title: episode.title ?? '',
          content: episode.content ?? '',
          duration_minutes: Math.floor(totalSec / 60),
          duration_seconds: totalSec % 60,
        })
      } else {
        reset({
          title: '',
          content: '',
          duration_minutes: 0,
          duration_seconds: 0,
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(1000px,92vw)] !max-w-[min(1000px,92vw)] !h-[min(680px,85vh)] !max-h-[min(680px,85vh)] min-w-[640px] min-h-[480px] flex flex-col overflow-hidden p-6 text-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{isEdit ? '编辑剧集' : '添加一集'}</DialogTitle>
          <DialogDescription className="text-sm">
            {isEdit
              ? '修改当前集的标题、剧本内容和时长。'
              : '新的一集将归属到当前项目，并排在现有剧集的最后。'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-1 flex-col gap-5 pt-2 overflow-y-auto pr-2"
          onSubmit={handleSubmit(async (raw) => {
            if (!projectId) return
            const duration_seconds =
              (raw.duration_minutes || 0) * 60 + (raw.duration_seconds || 0)

            if (isEdit) {
              const req: UpdateEpisodeReq = {}
              if (raw.title !== undefined) req.title = raw.title.trim() || undefined
              if (raw.content !== undefined) req.content = raw.content.trim() || undefined
              req.duration_seconds = duration_seconds
              await onUpdate(episode.id, req)
            } else {
              const req: CreateEpisodeReq = {
                project_id: projectId,
                title: raw.title.trim() || '未命名剧集',
              }
              if (raw.content.trim()) req.content = raw.content.trim()
              await onCreate(req)
              onOpenChange(false)
            }
          })}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">
              标题 {!isEdit && '*'}
            </label>
            <Input
              {...register('title', {
                maxLength: { value: 200, message: '最多 200 个字符' },
              })}
              placeholder="例：意外的相遇"
              autoFocus
              className="h-9 px-3 text-sm"
            />
            {errors.title && (
              <p className="text-xs text-rose-600">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">剧本内容（可选）</label>
            <Textarea
              {...register('content')}
              placeholder="本集完整剧本内容，包含场景、台词、动作说明等..."
              className="min-h-[280px] resize-y p-3 font-mono text-sm leading-relaxed"
            />
            {isEdit && (
              <div className="rounded-lg bg-muted/40 p-4">
                <Progress value={Math.min(100, (watch('content')?.length ?? 0) / 50)} />
                <p className="mt-2 text-xs text-muted-foreground">
                  内容字数：{watch('content')?.length?.toLocaleString() ?? 0} 字
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">时长 · 分钟</label>
              <Input
                type="number"
                min={0}
                {...register('duration_minutes', { valueAsNumber: true })}
                onChange={(e) => setValue('duration_minutes', Number(e.target.value) || 0)}
                className="h-9 px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">时长 · 秒</label>
              <Input
                type="number"
                min={0}
                max={59}
                {...register('duration_seconds', { valueAsNumber: true })}
                onChange={(e) => setValue('duration_seconds', Number(e.target.value) || 0)}
                className="h-9 px-3 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="mt-1">
            <DialogClose
              render={(props: any) => (
                <Button type="button" variant="outline" className="h-9 px-4 text-sm" {...props}>
                  取消
                </Button>
              )}
            />
            <Button
              type="submit"
              className="h-9 px-4 text-sm"
              disabled={submitting || isSubmitting || !projectId}
            >
              {submitting || isSubmitting
                ? '保存中...'
                : isEdit
                  ? '保存修改'
                  : '添加剧集'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
