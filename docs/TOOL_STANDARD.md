# 工具目录与元数据标准

## 一个目录，一个入口

`tools/<slug>/index.html` 为必需入口。slug 用小写英文、数字和连字符，创建后尽量不变。资源放该工具目录内，使用 `./assets/...` 等相对路径；不要用域名根路径、父目录引用或依赖另一工具文件。工具自己的 CSS/JS 可以内联，也可以分文件。

`tool.json` 示例：

```json
{
  "id": "color-grid",
  "name": "Color Grid",
  "description": "从图片中提取颜色网格。",
  "tags": ["color", "image"],
  "entry": "index.html",
  "version": "1.0.0",
  "created": "2026-09-28",
  "updated": "2026-09-28",
  "status": "published"
}
```

必填字段如示例，`id` 必须等于目录名；状态仅 `draft | review | ready | published`；日期为 ISO 格式；版本为 `MAJOR.MINOR.PATCH`。`description` 一句话说明用途，不写来源项目或内部信息。可选 `cover` 必须是工具目录内相对路径；可选 `capabilities` 枚举如 `camera`、`clipboard`、`download`，供站内提示。

新增工具默认提供 `assets/cover.png`，并设置 `"cover": "assets/cover.png"`。用户更新封面只需替换同路径图片并重新构建。推荐 640 × 480px，支持 PNG/JPG/WebP/SVG/AVIF；已填写的 cover 必须指向真实图片文件，不能是外部 URL。具体说明见 [封面替换](COVERS.md)。

V1 不要求 `category`，也不读取它生成分类；已有工具可保留该字段，后续分类方案另行确认。`tags` 必须为字符串数组，允许为空。工具 HTML 的 `<title>` 和可见标题与 `name` 对应；文件名与路径不使用空格、中文或临时版本号。

根 `tools.json` 只登记已发布工具的 slug 且顺序即展示顺序。新增目录默认 `draft`，无需登记；进入 `ready` 仍不进入站点产物。只有 QA 通过后才能改 `published` 并登记。校验器应阻断索引不存在、重复、状态不一致、入口缺失和越界路径。

## 运行约束

- 在本地 HTTP 服务、Pages 子路径、站内 iframe、独立页面四种环境检查；不要只靠 `file://` 成功判断。
- 不从工具向主站写 DOM、全局 CSS 或 storage 共用键；本地存储键使用 `dpg:<slug>:` 前缀。
- 外链和依赖需写明来源、许可及离线失败时的表现；不得放入凭据或私有 API。
- 从旧工具迁移时，清理遗留品牌、文件名、注释、meta、logo、favicon、追踪、内部链接与构建产物。视觉统一只调整非核心表达。
- 工具必须可被 iframe 容纳，默认内容不应假设完整窗口；若必须全屏、特殊权限或跨域策略，保留站内说明和独立打开入口。

`published` 仅表示已通过工具 QA 并纳入下一次构建；实际上线以部署成功和公开网址验证为准。`draft/review/ready` 不进入站点产物，但提交到公开仓库后源码仍会公开；保密或未清理材料始终留在仓库外。工具版本独立于站点发布版本。
