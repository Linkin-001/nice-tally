const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.TALLY_NODE_MODULES+'/playwright');
const url='http://127.0.0.1:4173';
(async()=>{
  fs.mkdirSync('artifacts/xiaojin',{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))external.push(r.url())});
  const text=s=>page.getByText(s,{exact:true});const shot=s=>page.screenshot({path:'artifacts/xiaojin/'+s+'.png',style:'.toast{visibility:hidden}'});
  const tab=async s=>page.locator('.tab-item').filter({hasText:s}).click();
  const entry=async()=>page.getByText('记一笔',{exact:true}).first().click();
  const edgeBack=async side=>page.evaluate(side=>{const root=document.querySelector('.xj-app');if(!root)throw Error('missing app root');const startX=side==='left'?3:387,endX=side==='left'?112:278,y=280;const point=x=>new Touch({identifier:1,target:root,clientX:x,clientY:y,screenX:x,screenY:y});const fire=(type,x,active)=>root.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:active?[point(x)]:[],changedTouches:[point(x)]}));fire('touchstart',startX,true);fire('touchmove',endX,true);fire('touchend',endX,false)},side);
  const pin=async s=>{for(const k of s)await page.locator('.number-key').filter({hasText:new RegExp('^'+k+'$')}).click();await page.waitForTimeout(700)};
  try {
    await page.goto(url);await text('开始使用').waitFor();await shot('01-welcome');
    await text('开始使用').click();await text('设置空间密码').click();await pin('123456');await pin('123456');
    await text('还没有账本').waitFor();await shot('02-books-empty');
    await text('＋ 创建账本').click();await page.locator('.form-input input').fill('日常账本');await page.locator('.primary-btn').click();
    await text('从第一笔开始').waitFor();await shot('03-home-empty');
    await entry();await text('保存记录').waitFor();await edgeBack('left');await text('从第一笔开始').waitFor();
    await entry();await text('保存记录').waitFor();await edgeBack('right');await text('从第一笔开始').waitFor();
    await entry();await page.locator('.amount-field input').fill('36.80');await edgeBack('left');await text('离开记账？').waitFor();await page.locator('.cancel-btn').click();await text('餐饮').click();
    await page.locator('.inline-input input').fill('午餐测试');
    await text('保存记录').click();await text('记录详情').waitFor();await shot('04-detail');
    await page.locator('.back-action').click();
    if(await page.locator('.sheet').count())await text('放弃本次修改').click();
    if(!await page.locator('.tabbar').count()){await page.locator('.back-action').click()}
    await tab('首页');await shot('05-home');
    await tab('统计');await shot('06-stats');await page.locator('.legend-row').first().click();await text('记录明细').waitFor();assert.match(await page.locator('body').innerText(),/1 条原始记录/);
    await page.locator('.back-action').click();await tab('我的');await text('主题设置').click();await text('湖蓝').click();await text('使用这个主题').click();await shot('07-theme');
    await page.locator('.back-action').click();await text('安全与隐私').click();await text('创建独立空间').click();await text('设置空间密码').click();await pin('654321');await pin('654321');await text('还没有账本').waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(),/日常账本|午餐测试/);
    await tab('我的');await text('锁定并退出').click();await shot('08-lock');await pin('111111');await text('密码不正确').waitFor();await pin('123456');await text('日常账本 ⌄').waitFor();
    await tab('我的');await text('备份与恢复').click();await text('导出加密备份').click();await text('备份已生成').waitFor();await shot('09-backup');
    const raw=await page.locator('.transfer-panel textarea').inputValue();assert.ok(raw.includes('xiaojin-backup'));assert.ok(!raw.includes('日常账本'));
    await text('从备份恢复').click();await page.locator('.text-area textarea').fill(raw);await page.locator('.form-input input').fill('123456');await text('校验并预览').click();await text('备份内容').waitFor();await shot('11-restore-preview');
    await page.locator('.text-area textarea').fill(raw+' ');await page.locator('.restore-preview').waitFor({state:'hidden'});await text('校验并预览').click();await text('备份内容').waitFor();await text('确认恢复').click();await text('执行恢复').click();await text('日常账本 ⌄').waitFor();assert.match(await page.locator('body').innerText(),/本月 1 笔记录/);
    await tab('我的');await text('字段配置').click();await text('＋ 添加自定义字段').click();await page.locator('.form-input input').first().fill('项目');await page.locator('.setting-row').filter({hasText:/^必填$/}).locator('uni-switch').click();await text('保存字段').click();await text('项目').waitFor();await shot('12-fields');
    for(let i=0;i<4&&!await page.locator('.tabbar').count();i++)await page.locator('.back-action').click();
    await tab('首页');await entry();await page.locator('.amount-field input').fill('20');await text('交通').click();await text('保存记录').click();assert.match(await page.locator('body').innerText(),/请填写项目/);await text('更多字段').click();await page.locator('.dynamic-field input').fill('出差');await shot('13-entry-custom');await text('保存记录').click();await text('记录详情').waitFor();await text('出差').waitFor();await page.locator('.back-action').click();
    const storage=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!storage.includes('午餐测试'));assert.ok(!storage.includes('日常账本'));
    await tab('首页');await page.setViewportSize({width:768,height:1024});await shot('14-tablet');await page.setViewportSize({width:1280,height:900});await page.locator('.side-nav').waitFor();await shot('10-desktop');
    await page.setViewportSize({width:390,height:844});await page.reload();await text('欢迎回来').waitFor();await pin('123456');await text('日常账本 ⌄').waitFor();
    await page.evaluate(async()=>{await navigator.serviceWorker.ready});await context.setOffline(true);await page.reload();await text('欢迎回来').waitFor();await pin('123456');await text('日常账本 ⌄').waitFor();await context.setOffline(false);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS mobile/tablet/desktop, creation, transaction, chart drill, theme, isolated spaces, wrong PIN, encrypted backup/restore, preview invalidation, required custom field, offline reload, zero external requests');
  } catch(e){console.error('BODY',await page.locator('body').innerText());await shot('failure');throw e} finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
