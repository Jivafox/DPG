# 工具封面替换

每个工具的封面默认放在 `tools/<slug>/assets/cover.png`。ASCII Studio 对应 `tools/ascii-studio/assets/cover.png`，首页会实际读取这张图片。

- ASCII Studio 2.0：`tools/ascii-motion/assets/cover.png`
- Wax Seal：`tools/wax-seal/assets/cover.png`

这两张默认封面由工具自身画布生成，尺寸为 640 × 480px；直接替换对应 PNG 即可。

替换步骤：

1. 准备可公开的 PNG 图片，先在仓库外检查图片可见内容及元数据。
2. 覆盖对应工具的 `assets/cover.png`，保持路径和文件名不变。
3. 运行 `npm run build`，刷新本地首页；仍看到旧图时强制刷新。不要修改 dist 中的副本，下一次构建会覆盖它。

推荐 640 × 480px 或更大的 4:3 图片；主体留在中间，四周留出余量。卡片在不同屏幕宽度下会居中裁切，不会拉伸。图片只用于工具卡片，不改变工具运行画面。

已配置的工具无需修改任何代码或 JSON。新增工具时由协作者提供默认封面，并在 tool.json 设置 `"cover": "assets/cover.png"`。如果想使用 JPG、WebP、SVG 或 AVIF，提供图片后由协作者同步修改 cover 字段；不要只改文件扩展名来伪装格式。

构建会将 cover 字段写入 catalog，并复制图片。省略 cover 时显示编号占位；已配置但文件不存在时阻断构建；网络或图片解码失败时回退为编号，工具入口仍可使用。封面和名称已在同一卡片内呈现，因此图片为装饰内容，不重复播报名称。

更新公开网站仍需重新构建、检查和经确认发布，仅替换本地图片不会自动推送或上线。
