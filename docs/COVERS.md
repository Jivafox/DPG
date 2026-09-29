# 工具封面替换

每个工具的封面默认放在 `tools/<slug>/assets/cover.png`，首页会实际读取这张图片。

| 工具 | 替换路径 |
| --- | --- |
| ASCII I | `tools/ascii-studio/assets/cover.png` |
| ASCII II | `tools/ascii-motion/assets/cover.png` |
| Seal | `tools/wax-seal/assets/cover.png` |
| Gradient I | `tools/gradient/assets/cover.png` |
| Gradient II | `tools/gradient-curves/assets/cover.png` |
| Geometry | `tools/geometry/assets/cover.png` |
| Sphere | `tools/sphere/assets/cover.png` |

当前七张封面为更新后的图片素材，尺寸均为 640 × 480px；直接替换对应 PNG 即可。首页以 4:3 比例显示封面，圆角为 14px，卡片文字位于图片下方。

替换步骤：

1. 准备可公开的 PNG 图片，先在仓库外检查图片可见内容及元数据。
2. 覆盖对应工具的 `assets/cover.png`，保持路径和文件名不变。
3. 运行 `npm run build`，刷新本地首页；仍看到旧图时强制刷新。不要修改 dist 中的副本，下一次构建会覆盖它。

推荐 640 × 480px 或更大的 4:3 图片；主体留在中间，四周留出余量。卡片在不同屏幕宽度下会居中裁切，不会拉伸。图片只用于工具卡片，不改变工具运行画面。

已配置的工具无需修改任何代码或 JSON。新增工具时由协作者提供默认封面，并在 tool.json 设置 `"cover": "assets/cover.png"`。如果想使用 JPG、WebP、SVG 或 AVIF，提供图片后由协作者同步修改 cover 字段；不要只改文件扩展名来伪装格式。

构建会将 cover 字段写入 catalog，并复制图片。省略 cover 时显示编号占位；已配置但文件不存在时阻断构建；网络或图片解码失败时回退为编号，工具入口仍可使用。封面和名称已在同一卡片内呈现，因此图片为装饰内容，不重复播报名称。

更新公开网站仍需重新构建、检查和经确认发布，仅替换本地图片不会自动推送或上线。

## Logo

站点 Logo 位于 `site/assets/mark.svg`，由顶栏标识与浏览器 favicon 共用。当前图形为白色放射形标记与圆点。替换时保留 SVG 文件名与有效 viewBox，检查小尺寸辨识度、透明背景及深色页面上的对比；先审核可见图形和元数据，再重新构建，检查顶栏与浏览器图标。不要直接修改 `dist/assets/mark.svg`。
