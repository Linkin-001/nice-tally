# 待补资源

原有同名 SVG 文件保留为占位兼容；当前所有界面资源均已生成并接入对应 PNG：logo、welcome、book、home、family、travel、work、shield、lock、dining、shopping、transport、chart、record、user、empty、backup、coin。新增图片后将资源名称加入 `common/xiaojin/assets.ts` 的 suppliedAssets，并在 raster 映射中指定扩展名。尺寸由 xj-asset 控制，无需修改业务页面。

logo 88×88；welcome 320×180；账本图标 book/home/family/travel/work 48×48；分类 dining/shopping/transport 40×40；shield/lock/backup/empty 64×64；底栏 home/chart/record/user 24×24。建议 SVG viewBox 0 0 48 48、透明背景，不烘焙文字。占位组件保留布局但不会加载空文件。
