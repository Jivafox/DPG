# DPG

Design Playground — 公开的交互工具与视觉实验工作空间。

V1 主站与首个工具已在本地实现：深色单栏首页，直接展示全部工具；点击进入站内运行页，可返回首页或独立打开。首版不设分类、搜索或筛选。当前尚未推送本地开发提交，也未部署到 GitHub Pages。

## 本地运行

使用 Node 22+，无需安装运行时依赖：

```sh
npm test
npm run build
npm run preview
```

构建需要仓库外私有词库；配置方式见 [内容政策](docs/CONTENT_POLICY.md)。默认预览端口 4174。检查仓库子路径可另运行 `npm run preview -- --port 4175 --base /DPG/`。完整技术组成、导航与测试说明见 [开发文档](docs/DEVELOPMENT.md)。

## 工具

[ASCII Studio](tools/ascii-studio/index.html) 支持图片/视频转字符画、自定义 SVG 字符与图片、矢量及无声视频导出。已通过本地接入验证并纳入构建，`published` 是构建资格，不表示已经上线。素材在本机处理，字体使用本机字体。详情见 [工具验收](docs/qa/ASCII_STUDIO.md) 与 [主站验收](docs/qa/SITE_V1.md)。

## 规范与协作

- [仓库蓝图](docs/REPOSITORY_SPEC.md)、[AGENTS.md](AGENTS.md)：范围、架构与执行顺序。
- [设计系统](docs/DESIGN_SYSTEM.md)、[工具标准](docs/TOOL_STANDARD.md)：视觉与工具格式。
- [材料接收](docs/INTAKE_CHECKLIST.md)、[接入指南](docs/INTEGRATION_GUIDE.md)：用户提供原件，协作者自主整理；原始材料先在仓库外清理。
- [内容政策](docs/CONTENT_POLICY.md)、[QA 清单](docs/QA_CHECKLIST.md)：私有规则、公开边界及检查要求。
- [GitHub 工作流](docs/GITHUB_WORKFLOW.md)、[版本记录模板](docs/releases/TEMPLATE.md)：功能分支、推送确认、版本识别及回退。

具体词库不随项目分发，不以编码形式写入源码。公开 CI 只做通用结构检查和构建；每次 push 前仍需本地完整风险检查与用户正式确认。分支 push 和 main 合并不自动上线；仅经确认的版本标签进入 Pages 发布流程。远端设置与真实发布尚未完成。
