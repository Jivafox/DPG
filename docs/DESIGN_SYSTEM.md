# DPG 设计系统 · V2

## 视觉原则

深色、安静、内容优先。结构依靠对齐、间距、少量细线；导航低于内容层级。V2 起主站组件语言对齐 shadcn/ui 的语义 token 体系与组件规范（neutral 深色主题），高亮色为白色（主行动按钮白底深字），不引入 React/Tailwind，仍以原生 HTML/CSS/JS 实现。

## 基础 token（落地为 `site/styles/tokens.css`，工具可拷贝值而非跨目录 import）

主站采用 shadcn/ui 语义命名与 neutral 深色主题；主行动使用高亮白配深色文字，聚焦环使用白色。下表中的 token 值以当前实现为准：

| 用途 | token | V2 值 |
| --- | --- | --- |
| 页面画布 | `--background` | `oklch(0.145 0 0)` ≈ `#09090b` |
| 主文字 | `--foreground` | `oklch(0.985 0 0)` ≈ `#fafafa` |
| 卡片表面/文字 | `--card` / `--card-foreground` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` |
| 浮层 | `--popover` / `--popover-foreground` | 同 card |
| 主行动/高亮 | `--primary` / `--primary-foreground` | `oklch(0.922 0 0)` / `oklch(0.205 0 0)` |
| 次级填充/文字 | `--secondary` / `--secondary-foreground` | `oklch(0.269 0 0)` / `oklch(0.985 0 0)` |
| 弱表面/次文字 | `--muted` / `--muted-foreground` | 同 secondary / `oklch(0.708 0 0)` ≈ `#a1a1aa` |
| 悬停表面 | `--hover` / `--hover-foreground` | 同 secondary |
| 错误 | `--destructive` | `oklch(0.704 0.191 22.216)` |
| 细边 | `--border` | `oklch(1 0 0 / 10%)` |
| 输入框边 | `--input` | `oklch(1 0 0 / 15%)` |
| 聚焦环 | `--ring` | `#fff` |

圆角比例尺：基准 `--radius: 10px`，派生 `--radius-sm` 6px、`--radius-md` 8px、`--radius-lg` 10px、`--radius-xl` 14px。

字族优先系统 sans（`Inter, ui-sans-serif, system-ui, sans-serif`）；正文 14px/1.5，辅助 12–13px，区块标题 14–18px semibold，页面标题 30–40px semibold、字距 −0.02em。间距以 4px 为基础，常用 8/12/16/24/32。面板边框为 1px 细边（10% 白），工具运行框可用极轻投影；首页工具卡片无外框、底色或投影。

## 页面结构

首页为顶部标识、简短说明与全部工具卡片列表，不设分类侧栏、搜索框和筛选控件。详情页为标题与操作区、工具运行区；返回入口清晰可见。顶栏 sticky、底部分细线、背景 85% 透明 + 8px 模糊。

首页展示 Design Playground 标题与英文简介；内容容器最大宽度 1200px（含水平内距）。工具网格默认三列，宽度不超过 1100px 时两列、不超过 768px 时一列。桌面行距 44px、列距 20px；窄屏间距 16px。卡片由 4:3 封面、名称、简介和标签组成，整张卡片提供进入工具的入口。Logo 与封面替换位置见 `COVERS.md`。

## 组件与状态

| 组件 | 默认规格 | 状态要求 |
| --- | --- | --- |
| 按钮（主） | 高 36px，水平内距 16px，`--radius-md`，`--primary` 底、`--primary-foreground` 深色字 | hover 略暗、focus-visible 白色环、disabled |
| 按钮（描边/幽灵） | 同上尺寸；描边为 `--input` 边透明底，幽灵无边 | hover 落 `--hover` 表面 |
| 首页工具卡片 | 无外框、底色或投影；封面 4:3、`--radius-xl`，文字位于封面下方 | hover 封面缩放至 1.02，过渡 200ms；键盘焦点可见 |
| 徽章/标签 | 1px 细边、`--radius-md`、12px 字 | 计数用胶囊（999px）变体 |
| 输入（工具按需） | 高 36–38px，`--input` 细边 | 占位与输入对比清楚，错误可读 |
| 工具运行框 | 细边 + `--radius-xl` 卡片 | 载入/失败状态可读可重试 |

交互反馈一般 120–180ms ease-out；大区域切换 180–240ms。遵守 `prefers-reduced-motion`，避免用动效作为唯一信息。交互实验的画布可自由表达，但外围导航、参数区和通用控件沿用上述语言；不要为了统一损坏实验的核心效果。

## 响应式与无障碍

设计检查宽度至少 390 / 768 / 1280px；窄屏优先工具画布与主要动作，首页网格收为单列，详情保持纵向结构。保证键盘操作、可见焦点（2px 白色 `--ring` 描边，偏移 2px）、语义标签；文本与控件对比度按 WCAG AA 目标评估。鼠标专属效果需给触屏合理替代。内容语言可按工具定位选择，但同一界面保持一致。

## 与工具的关系

工具页面拷贝本 token 值（V2 起 7 个既有工具的样式已完成值与度量对齐：按钮 36px/8px 圆角、卡片与弹窗 8–14px、硬编码色按语义归并到 token）。各工具的特殊语义色（错误/警告/拖拽态/画布表现色）保留独立取值；画布表现不受外围 token 约束。

## 评审方法

先记录工具原始的核心体验，再标记可统一的导航、表单、面板和文字；用设计 token 重构外围，在三档宽度及交互状态下截图对照。若视觉规则与功能冲突，保留功能并在工具说明中记例外原因。
