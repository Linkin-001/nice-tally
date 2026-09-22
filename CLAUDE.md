# 小金账：Claude 工作指南

在修改本仓库前，先遵守 [Agent.md](Agent.md) 中的全部工程、视觉、跨平台与验收规则。本文件补充本项目的执行约束，不与其重复定义规范。

## 代码地图

- `pages/xiaojin/index.uvue`：当前小金账 UI、页面状态和交互编排。
- `common/xiaojin/model.ts`：账本、记录、字段、查询、统计的领域规则。
- `common/xiaojin/vault.ts`：本地加密容器、PIN、备份、恢复与迁移兼容。
- `common/xiaojin/xiaojin.css`：小金账共享样式；须遵守 Vapor 单 class 选择器规则。
- `components/`：可复用 UI 组件；新增展示能力优先拆到这里。
- `uni_modules/xj-security/`：安全窗口等平台原生能力。调用前检查条件编译与失败行为。
- `pages/tally/`、`common/tally/`：旧版功能，除非任务明确要求，否则不要重构或改变存储格式。

## 工作方式

1. 先定位真实问题：Harmony `appfreeze` 以主线程栈为准；UTS CSS 的 `_decoded` 通常是插件未展示原始 CSS 告警后的次生错误，检查最近改动的非单类选择器和不支持的样式值。
2. 做最小、可回滚的改动。不要因为格式化工具而重写整份 CSS、UVue 或业务文件。
3. 修改 CSS 后，确认每个规则对 Vapor 原生端有效；如果只是 Web 增强，使用 WEB 条件编译隔离。
4. 修改加密或异步流程后，验证错误密码、取消、锁屏、并发触发和旧数据/旧备份。安全设计的改变必须写明兼容策略与风险取舍。
5. 完成后运行 `npm test`。若修改用户流程，补充或运行浏览器回归；若修改 Harmony 行为，明确标注是否已真机验证。

## 按钮与布局的固定约定

- 小金账 button 只使用 `.primary-btn`、`.outline-btn`、`.soft-btn`、`.cancel-btn` 或新增的单一语义 class。
- button 的高度、行高、上下内边距必须同步：例如 50px 高按钮使用 `height: 50px; line-height: 50px; padding-top: 0; padding-bottom: 0; text-align: center;`。
- 不用裸 `button`、`uni-button`、`.container button`、`button[disabled]` 等选择器；也不通过 flex 属性对齐 button 内置文本。
- 表单、弹层和页面主体必须能在 320px 宽与短屏下滚动到所有操作；宽屏增强不能破坏单栏手机布局。

## Android、iOS、HarmonyOS 发布约束

- 所有 UI 功能视为 Android、iOS、HarmonyOS 的共同能力。不要只在 HarmonyOS 上验证后就宣称 App 端完成。
- 涉及安全区、键盘、返回、选择文件、文件写入、后台/前台、原生安全窗口或手势时，分别列出 Android、iOS、HarmonyOS 的验证结果；未验证的平台必须明确标注“待验收”。
- 原生实现必须放进精确的平台条件编译块：`APP-ANDROID`、`APP-IOS` 或 `APP-HARMONY`。可跨原生端的代码使用 `APP`；绝不在共享 UTS/UVue 逻辑中直接引用某个平台 SDK。
- 如果某个能力无法在 iOS 或 HarmonyOS 实现，保留数据安全性与可恢复性优先于界面一致性：禁用入口并说明原因，不制造看似成功的假操作。

## 手势与页面返回

- 二级及更深页面必须同时支持顶部返回、系统返回和从左右屏幕边缘向内滑动的返回上一层；三个入口调用同一回退逻辑，确保草稿确认、弹层关闭与敏感数据锁定行为一致。
- 边缘返回只监听边缘起点，不能抢占列表横滑、图表拖拽、轮播或滚动手势。删除、归档等破坏性动作不得仅依赖横滑触发。
- iOS 侧滑、Android/HarmonyOS 系统手势与应用内手势可能由运行时接管。实现前确认平台能力；若无法可靠接管，保留始终可见且可触达的顶部返回按钮，并在真机上验证。

## UI 风格红线

- 小金账是私人的移动记账产品，不是管理后台、企业平台、BI 看板或 SaaS 控制台。
- 禁止 KPI 卡片矩阵、仪表盘首屏、密集图表、表格化设置、图标宫格导航、厚重边框、强阴影、炫彩渐变、面包屑以及把所有功能平铺成卡片。
- 用“今天需要做什么”组织首页，用留白、层级、柔和分组和渐进披露引导任务；一个页面只突出一个核心动作，统计内容必须服务于具体记账决策。

## 常用命令

```powershell
npm install
npm test
$env:HBUILDERX_PATH = 'HBuilderX 安装目录'
npm run build:web
npm run preview
```

HBuilderX 运行或真机安装由 IDE 完成。构建缓存问题优先使用 IDE 的清理缓存/重新运行能力；不要删除用户数据目录、证书、签名配置或本地账本来“修复”构建。
