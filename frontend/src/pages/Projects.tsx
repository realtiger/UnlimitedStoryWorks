import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  PlusSignCircleIcon,
  Edit02Icon,
  Delete02Icon,
  ReloadIcon,
  FolderAddIcon,
  CheckmarkBadge01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

import projectsApi from '@/services/projects/api'
import type { CreateProjectReq, Project, UpdateProjectReq } from '@/services/projects/types'
import { useProjectStore } from '@/store/useProjectStore'

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

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const { selectedProject, selectProject } = useProjectStore()

  // ---- 查询 ----
  const {
    data: list,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const handleSelectProject = (p: Project) => {
    selectProject(p)
    toast.add({ type: 'success', title: `已选择项目「${p.name}」` })
  }

  // ---- 新建 ----
  const createMut = useMutation({
    mutationFn: (req: CreateProjectReq) => projectsApi.create(req),
    onSuccess: () => {
      toast.add({ type: 'success', title: '创建成功' })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  // ---- 编辑 ----
  const updateMut = useMutation({
    mutationFn: (p: { id: number; req: UpdateProjectReq }) =>
      projectsApi.update(p.id, p.req),
    onSuccess: () => {
      toast.add({ type: 'success', title: '保存成功' })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditTarget(null)
    },
  })

  // ---- 删除 ----
  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.remove(id),
    onSuccess: () => {
      toast.add({ type: 'success', title: '删除成功' })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteTarget(null)
    },
  })

  const projects = list ?? []

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">项目管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            所有故事、角色、分镜等资源都挂载在具体项目下。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <HugeiconsIcon
              icon={ReloadIcon}
              data-icon="inline-start"
              className={cn(isFetching && 'animate-spin')}
            />
            刷新
          </Button>
          <CreateProjectSheet
            onCreate={async (v) => await createMut.mutateAsync(v)}
            submitting={createMut.isPending}
          />
        </div>
      </div>

      {/* 卡片网格 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <HugeiconsIcon icon={FolderAddIcon} className="size-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">暂无项目</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            点击右上角「新建项目」开始创建
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const isSelected = selectedProject?.id === p.id
            return (
              <Card
                key={p.id}
                className={cn(
                  'transition-all duration-300 ease-out cursor-pointer group',
                  'hover:shadow-md hover:border-primary/50',
                  isSelected
                    ? 'border-primary border-2 ring-4 ring-primary/10 shadow-xl shadow-primary/20 -translate-y-1 bg-gradient-to-br from-background via-primary/[0.02] to-primary/[0.05]'
                    : ''
                )}
                onClick={() => handleSelectProject(p)}
              >
                <CardHeader className="relative">
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <HugeiconsIcon
                        icon={CheckmarkBadge01Icon}
                        className="size-5 text-primary"
                      />
                    </div>
                  )}
                  <CardTitle className="line-clamp-1 pr-7">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.4em]">
                    {p.description || '暂无描述'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>创建于 {formatTime(p.created_at)}</span>
                    <span>·</span>
                    <span>更新于 {formatTime(p.updated_at)}</span>
                  </div>
                </CardContent>
                <CardFooter
                  className="justify-end gap-1 border-t border-border/50 pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectProject(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} data-icon="inline-start" />
                    选择
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditTarget(p)}
                  >
                    <HugeiconsIcon icon={Edit02Icon} />
                    <span className="sr-only">编辑</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(p)}
                    className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                    <span className="sr-only">删除</span>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* 编辑 Sheet */}
      <EditProjectSheet
        project={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
        onSave={async (req) => {
          if (editTarget) await updateMut.mutateAsync({ id: editTarget.id, req })
        }}
        submitting={updateMut.isPending}
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
              项目「{deleteTarget?.name}」将被删除，其下的所有资源也将不可访问。此操作不可撤销。
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
// 新建 Sheet
// ---------------------------------------------------------------------------

function CreateProjectSheet({
  onCreate,
  submitting,
}: {
  onCreate: (v: CreateProjectReq) => Promise<unknown>
  submitting: boolean
}) {
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectReq>({ defaultValues: { name: '', description: '' } })

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <SheetTrigger
        render={(props: any) => (
          <Button size="sm" {...props}>
            <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
            新建项目
          </Button>
        )}
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>新建项目</SheetTitle>
          <SheetDescription>创建后将成为所有资源的根容器。</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 p-6 pt-2"
          onSubmit={handleSubmit(async (raw) => {
            const req: CreateProjectReq = { name: raw.name.trim() }
            if (raw.description?.trim()) req.description = raw.description.trim()
            if (raw.cover_image?.trim()) req.cover_image = raw.cover_image.trim()
            try {
              await onCreate(req)
              setOpen(false)
              reset()
            } catch {
              /* http.ts 已统一 toast */
            }
          })}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium">项目名称 *</label>
            <Input
              {...register('name', {
                required: '项目名称不能为空',
                maxLength: { value: 120, message: '最多 120 个字符' },
              })}
              placeholder="例：星之旅 第一季"
              autoFocus
            />
            {errors.name && <p className="text-[11px] text-rose-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">描述（可选）</label>
            <Textarea
              {...register('description')}
              rows={4}
              placeholder="项目简介..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">封面链接（可选）</label>
            <Input {...register('cover_image')} placeholder="https://..." />
          </div>

          <SheetFooter className="mt-auto">
            <SheetClose
              render={(props: any) => (
                <Button type="button" variant="outline" {...props}>
                  取消
                </Button>
              )}
            />
            <Button type="submit" disabled={submitting || isSubmitting}>
              {submitting || isSubmitting ? '创建中...' : '创建'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// 编辑 Sheet
// ---------------------------------------------------------------------------

function EditProjectSheet({
  project,
  open,
  onOpenChange,
  onSave,
  submitting,
}: {
  project: Project | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (req: UpdateProjectReq) => Promise<unknown>
  submitting: boolean
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectReq>()

  // project 变化时重置表单
  const [prevId, setPrevId] = useState<number | null>(null)
  if (project && project.id !== prevId) {
    setPrevId(project.id)
    reset({
      name: project.name,
      description: project.description ?? '',
      cover_image: project.cover_image ?? '',
      level: project.level,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>编辑项目</SheetTitle>
          <SheetDescription>
            修改「{project?.name}」的基础信息。
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 p-6 pt-2"
          onSubmit={handleSubmit(async (raw) => {
            const req: UpdateProjectReq = {}
            if (raw.name !== undefined) req.name = raw.name.trim() || undefined
            if (raw.description !== undefined) req.description = raw.description.trim() || undefined
            if (raw.cover_image !== undefined) req.cover_image = raw.cover_image.trim() || undefined
            if (raw.level !== undefined) req.level = raw.level
            try {
              await onSave(req)
            } catch {
              /* http.ts 已统一 toast */
            }
          })}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium">项目名称</label>
            <Input
              {...register('name', {
                maxLength: { value: 120, message: '最多 120 个字符' },
              })}
            />
            {errors.name && <p className="text-[11px] text-rose-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">描述</label>
            <Textarea {...register('description')} rows={4} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">封面链接</label>
            <Input {...register('cover_image')} />
          </div>

          <SheetFooter className="mt-auto">
            <SheetClose
              render={(props: any) => (
                <Button type="button" variant="outline" {...props}>
                  取消
                </Button>
              )}
            />
            <Button type="submit" disabled={submitting || isSubmitting}>
              {submitting || isSubmitting ? '保存中...' : '保存'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
