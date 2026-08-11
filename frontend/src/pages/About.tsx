import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function About() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          关于 Unlimited Story Works
        </h2>
        <p className="text-sm text-muted-foreground">
          了解无限绘卷 - 本地自动化 AI 剧本生成工具
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>项目简介</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            <p>
              无限绘卷（Unlimited Story Works）是一个本地化运行的 AI 剧本自动生成工具。
              它结合了最新的大语言模型技术，帮助创作者快速、高效地生成高质量的故事剧本。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>主要功能</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                项目管理与版本控制
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                智能剧本自动生成
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                角色设定与管理
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                场景创建与编辑
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                对话生成与优化
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                最终视频合成输出
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
