# DPG

Design Playground — 公开的交互工具与视觉实验工作空间。

主站采用 V2 中性深色主题与白色高亮，通过响应式网格直接展示全部工具；点击进入站内运行页，可返回首页或独立打开。不设分类、搜索或筛选。当前工作版本包含七个工具，最新视觉、封面和 Logo 变更见 [v0.3.0 发布准备记录](docs/releases/v0.3.0.md)。源码通过功能分支与 PR 管理，线上版本以 GitHub Release 和 Pages 部署记录为准。

## 本地运行

使用 Node 22+，无需安装运行时依赖：

```sh
npm test
npm run build
npm run preview
```

构建需要仓库外私有词库；配置方式见 [内容政策](docs/CONTENT_POLICY.md)。默认预览端口 4174。检查仓库子路径可另运行 `npm run preview -- --port 4175 --base /DPG/`。完整技术组成、导航与测试说明见 [开发文档](docs/DEVELOPMENT.md)。

## 工具

更换首页工具封面：覆盖该工具的 `assets/cover.png` 后重新构建即可，详见 [封面替换说明](docs/COVERS.md)。

| 工具 | 用途 |
| --- | --- |
| [ASCII I](tools/ascii-studio/index.html) | 图片/视频转字符画，自定义 SVG 字符与图片，矢量及无声视频导出 |
| [ASCII II](tools/ascii-motion/index.html) | 动态渐变字符画 |
| [Seal](tools/wax-seal/index.html) | 火漆印章交互 |
| [Gradient I](tools/gradient/index.html) | 渐变纹理生成与 PNG 导出 |
| [Gradient II](tools/gradient-curves/index.html) | 曲线场渐变、动画与图片导出 |
| [Geometry](tools/geometry/index.html) | 几何构图与 PNG/SVG 导出 |
| [Sphere](tools/sphere/index.html) | 可旋转的三维符号球 |

以上工具已纳入本地构建；`published` 是构建资格，不表示已经上线。历史接入与验收记录保留当时的名称和视觉描述，当前视觉规范以 [设计系统 V2](docs/DESIGN_SYSTEM.md) 为准。

## 规范与协作

- [仓库蓝图](docs/REPOSITORY_SPEC.md)、[AGENTS.md](AGENTS.md)：范围、架构与执行顺序。
- [设计系统](docs/DESIGN_SYSTEM.md)、[工具标准](docs/TOOL_STANDARD.md)：视觉与工具格式。
- [材料接收](docs/INTAKE_CHECKLIST.md)、[接入指南](docs/INTEGRATION_GUIDE.md)：用户提供原件，协作者自主整理；原始材料先在仓库外清理。
- [内容政策](docs/CONTENT_POLICY.md)、[QA 清单](docs/QA_CHECKLIST.md)：私有规则、公开边界及检查要求。
- [GitHub 工作流](docs/GITHUB_WORKFLOW.md)、[版本记录模板](docs/releases/TEMPLATE.md)：功能分支、推送确认、版本识别及回退。

具体词库不随项目分发，不以编码形式写入源码。公开 CI 只做通用结构检查和构建；每次 push 前仍需本地完整风险检查与用户正式确认。分支 push 和 main 合并不自动上线；仅经确认的版本标签进入 Pages 发布流程。首版范围与回退方案见 [v0.1.0 发布记录](docs/releases/v0.1.0.md)。
