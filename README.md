# DPG

Design Playground — 公开的交互工具与视觉实验工作空间。

本目录目前包含 V1 规范与检查骨架。`site/` 的实际页面尚待实现；本包不声称网站已经建成或已连接 GitHub。

## 先读什么

1. [仓库蓝图](docs/REPOSITORY_SPEC.md)：范围、目录、架构与确定的决策。
2. [AGENTS.md](AGENTS.md)：协作者和编码 Agent 的执行顺序。
3. [设计系统](docs/DESIGN_SYSTEM.md)、[工具标准](docs/TOOL_STANDARD.md)：做主站和导入工具时的约束。
4. [接入指南](docs/INTEGRATION_GUIDE.md)、[内容政策](docs/CONTENT_POLICY.md)、[质量清单](docs/QA_CHECKLIST.md)：从导入到发布。
5. [GitHub 工作流](docs/GITHUB_WORKFLOW.md)：阶段性版本管理与 Pages。

## V1 决策

- 主站以暗色单栏界面直接展示全部工具；首版不设分类、搜索和筛选；工具在站内独立 iframe 打开，并有独立打开入口。
- 每个工具占一个 `tools/<slug>/` 文件夹；新文件放入不自动加入站点；公开仓库中的源码仍可见。
- 静态站点，无后台上传与数据库；GitHub 是内容来源，Pages 是公开发布渠道。
- 先清理来源信息，后设计统一、验证、登记、提交；未经检查的导入文件不得进入 Git 历史。
- 主站可以统一布局与导航，工具的 HTML/CSS/JS/资源不跨工具共享或覆盖。

- 功能分支开发、PR 审核、稳定版本标记与发布记录用于追溯和回退。每次推送前先报告风险检查结果，再取得用户明确确认；不自动推送或上线。

## 接下来

提供原始文件或位置即可，由协作者自主整理、清理和补齐元数据；责任与检查流程见 [启动材料与工具交付清单](docs/INTAKE_CHECKLIST.md)。

协作者可先运行 `node scripts/verify.mjs --structure-only` 做通用检查；提交及推送前必须按 [内容政策](docs/CONTENT_POLICY.md) 配置仓库外私有规则并完成严格检查，再依 [仓库蓝图](docs/REPOSITORY_SPEC.md) 开发 `site/` 与构建脚本。首次接通仓库与 Pages 时按 [GitHub 工作流](docs/GITHUB_WORKFLOW.md) 设置。此规范可以先单独评审；无需已有工具才能使用。

当前规范审核与未决事项见 [规范审核](docs/SPEC_REVIEW.md)。

具体敏感词库不随项目分发，也不以编码形式藏在源码中。公开 CI 只验证通用结构；缺少私有词库时不能宣称完整内容检查通过。

## 首个工具

[ASCII Studio](tools/ascii-studio/index.html) 已完成本地接入，状态为 review，支持图片/视频转字符画及导出，暂未加入发布索引。使用本地 HTTP 服务预览；[接入与验收记录](docs/qa/ASCII_STUDIO.md) 列出了检查结果与限制。主站和部署尚未实现。
