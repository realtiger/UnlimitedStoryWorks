import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SparklesIcon, Book02Icon, PlayCircleIcon, PlusSignCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { toast } from '@/components/ui/toast'

export default function Home() {
  const handleCreateStory = () => {
    toast.add({
      type: 'success',
      title: '创建成功',
      description: '已开始创建新的故事项目',
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            欢迎来到 Unlimited Story Works
          </h2>
          <p className="text-sm text-muted-foreground">
            无限绘卷 - 本地自动化 AI 剧本生成工具
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={Book02Icon} data-icon="inline-start" />
            查看文档
          </Button>
          <Button size="sm" onClick={handleCreateStory}>
            <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
            新建故事
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={SparklesIcon} className="size-5 text-primary" />
              <CardTitle>AI 剧本生成</CardTitle>
            </div>
            <CardDescription>使用先进的 AI 模型快速生成高质量剧本</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• 多模型支持</li>
              <li>• 自定义风格设定</li>
              <li>• 批量生成能力</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Book02Icon} className="size-5 text-primary" />
              <CardTitle>角色与场景</CardTitle>
            </div>
            <CardDescription>灵活管理你的角色设定和场景配置</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• 角色档案管理</li>
              <li>• 场景库搭建</li>
              <li>• 关系图谱可视化</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={PlayCircleIcon} className="size-5 text-primary" />
              <CardTitle>视频合成</CardTitle>
            </div>
            <CardDescription>一键将剧本合成为最终视频作品</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• 多格式输出</li>
              <li>• 字幕自动生成</li>
              <li>• 背景音乐匹配</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
