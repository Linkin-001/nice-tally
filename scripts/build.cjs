const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const hx = process.env.HBUILDERX_PATH;
if (!hx) { console.error('请设置 HBUILDERX_PATH 为 HBuilderX 安装目录，或在 HBuilderX 中直接运行项目。'); process.exit(1); }
const compiler = path.join(hx, 'plugins/uniapp-cli-vite');
const bin = path.join(compiler, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js');
if (!fs.existsSync(bin)) { console.error('请先在 HBuilderX 中安装 uni-app 编译器。'); process.exit(1); }
const platform = process.argv[2] || 'h5';
if (!['h5', 'mp-weixin'].includes(platform)) throw new Error('Supported local builds: h5, mp-weixin');
const result = cp.spawnSync(process.execPath, [bin, 'build', '--platform', platform], { cwd: compiler, stdio: 'inherit', env: { ...process.env, HX_APP_ROOT: hx, UNI_INPUT_DIR: root, UNI_OUTPUT_DIR: path.join(root, 'unpackage/dist/build', platform === 'h5' ? 'web' : platform), UNI_APP_X: 'true', UNI_PLATFORM: platform } });
if (result.status === 0 && platform === 'h5') require('./cache-web.cjs');
process.exit(result.status ?? 1);
