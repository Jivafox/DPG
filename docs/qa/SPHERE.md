# Sphere 接入审核

日期：2026-09-29。范围：本地开发与预览，尚未推送或部署。

## 接收与公开边界

用户提供 React + react-three-fiber 原件（仓库外 `toolbox/Sphere/`，自称 Symbol Sphere），确认可公开。按仓库约定移植为原生工具 `tools/sphere/`（index.html 86 行 + styles.css + app.js 840 行），未导入脚手架与 npm 依赖。Three.js 为合法必需依赖：按 package-lock 固定 **0.184.0**，vendor 官方未修改构建 `three.module.min.js` + `three.core.min.js`（r167+ 官方拆分双文件），MIT 许可头原样保留，并附 `NOTICE.txt` 声明版本、来源与许可。封面由工具运行画面截取（符号大小 0.12）。

## 内容、依赖与修正

- 零网络请求（three 为同源相对引用）、零外部字体、零 localStorage、无追踪；标题 "Symbol Sphere" 替换为 Sphere / DPG / 07；UI 全部中文。
- 渲染算法逐行移植：11 种默认符号纹理、Park-Miller 种子大陆分布、闪烁与背面压暗、背景漂浮符号；拖拽 + 惯性（pointer events 统一鼠标与触摸）。
- 修复移植中发现的缺陷：`.gl-fallback` 的 `display:flex` 覆盖 `hidden` 属性导致 WebGL 降级提示常驻，补 `[hidden]{display:none}`；原作画布上传/占比为弹窗，改为 DPG 非阻塞面板；新增无 WebGL 中文降级提示与上传类型/2MB 校验。

## 实际验证

桌面浏览器，本地 HTTP 预览：

- 初始渲染（479 符号 · 半径 2.0 · 种子 42）、拖拽旋转（大陆图案明显转动）、滑杆与数值框联动（符号大小 0.05→0.12 实时变大）、暂停/随机种子按钮、上传弹窗打开与关闭通过。
- 390px：舞台吸顶在上、面板在下，WebGL 正常，无横向溢出；页面无脚本错误、无外部请求。

## 限制

尚未部署本版；Safari、Firefox、真实手机未全面验证；文件选择器上传路径（真实图片 → 纹理 → 占比）未经端到端点击验证（代码走查 + 弹窗 UI 实测）；高密度（10000）在低端设备上可能掉帧。符号与参数不持久化，刷新重置。
