const { chromium } = require(process.env.DPG_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.DPG_QA_SUBPATH_URL || 'http://127.0.0.1:4181/DPG/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.DPG_BROWSER_PATH || undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], failed = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
    page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) external.push(r.url()); });
    await page.goto(base);
    assert.equal(await page.locator('.tool-card').count(), 3);
    for (const slug of ['ascii-motion', 'wax-seal']) {
      await page.locator(`[data-tool="${slug}"]`).click();
      const ready = slug === 'ascii-motion' ? '#outputCanvas' : '#inscription';
      await page.frameLocator('iframe').locator(ready).waitFor();
      await page.reload();
      await page.frameLocator('iframe').locator(ready).waitFor();
      const popup = page.waitForEvent('popup');
      await page.locator('#open-tool').click();
      const standalone = await popup;
      await standalone.locator(ready).waitFor();
      await standalone.close();
      await page.locator('.back-link').click();
      assert.equal(await page.locator('iframe').count(), 0);
      await page.goBack();await page.frameLocator('iframe').locator(ready).waitFor();
      await page.goForward();await page.locator(`[data-tool="${slug}"]`).waitFor();
    }
    await page.goto(base+'tools/ascii-motion/index.html');
    await page.locator('#playToggle').click();
    const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 100"><path d="M10 20H110V120H10Z"/></svg>';
    const unsafe = '<svg xmlns="http://www.w3.org/2000/svg" onload="window.injected=true"><style>body{display:none}</style><script>window.injected=true</script><image href="https://example.invalid/x"/><rect width="100" height="100"/></svg>';
    await page.locator('#glyphUpload').setInputFiles([{ name:'square.svg', mimeType:'image/svg+xml', buffer:Buffer.from(safe) },{ name:'unsafe.svg', mimeType:'image/svg+xml', buffer:Buffer.from(unsafe) }]);
    await page.waitForFunction(() => document.querySelectorAll('[data-glyph-index]').length === 2);
    assert.equal(await page.evaluate(() => !!window.injected), false);
    assert.equal(await page.locator('.glyph-preview script,.glyph-preview style,.glyph-preview image,.glyph-preview [onload]').count(), 0);
    await page.locator('#glyphUpload').setInputFiles({ name:'again.svg', mimeType:'image/svg+xml', buffer:Buffer.from(safe) });
    await page.waitForFunction(() => document.querySelector('#exportStatus').textContent.includes('已载入 0'));
    await page.locator('[data-move-glyph="0"][data-direction="1"]').click();
    assert.match(await page.locator('[data-glyph-index="1"]').getAttribute('title'), /square/);
    await page.locator('#glyphUpload').setInputFiles({name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('not svg')});
    await page.waitForFunction(() => document.querySelector('#exportStatus').textContent.includes('读取失败'));
    await page.locator('#lockAspect').uncheck();
    for(const [id,value] of [['frameWidth','320'],['frameHeight','256']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).press('Tab');}
    const download=page.waitForEvent('download');await page.locator('[data-export-png="1"]').click();assert.match((await download).suggestedFilename(),/320x256\.png$/);
    await page.locator('#resetAll').click();assert.equal(await page.locator('#textGlyphs').inputValue(),'01');
    await page.emulateMedia({ reducedMotion:'reduce' });await page.reload();assert.equal(await page.locator('#playToggle').getAttribute('aria-label'),'播放动画');
    for (const width of [390,768,1280]) {
      await page.setViewportSize({width,height:900});
      for (const slug of ['ascii-motion','wax-seal']) {await page.goto(base+'tools/'+slug+'/index.html');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    }
    await page.locator('#inscription').fill('DPG');await page.locator('#seal').focus();await page.keyboard.down('Space');await page.waitForTimeout(400);await page.keyboard.up('Space');
    const progress = Number(await page.locator('#seal').getAttribute('data-progress'));assert(progress>0&&progress<1);
    await page.waitForTimeout(200);assert.equal(Number(await page.locator('#seal').getAttribute('data-progress')),progress);
    await page.locator('#wax-hex').fill('bad');assert.equal(await page.locator('#wax-hex').getAttribute('aria-invalid'),'true');
    await page.locator('#wax-hex').fill('#1783FF');await page.locator('#grain-enabled').check();assert.equal(await page.locator('#grain').isDisabled(),false);
    await page.locator('#reset').click();assert.equal(await page.locator('#seal').getAttribute('data-state'),'ready');
    await page.locator('#inscription').fill('');assert.equal(await page.locator('#seal').getAttribute('aria-disabled'),'true');
    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const touch=await mobile.newPage();
    await touch.goto(base+'tools/wax-seal/index.html');await touch.locator('#inscription').fill('DPG');
    const box=await touch.locator('#wax').boundingBox();const session=await mobile.newCDPSession(touch);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await touch.waitForTimeout(500);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(Number(await touch.locator('#seal').getAttribute('data-progress'))>0);assert.equal(await touch.locator('#seal').getAttribute('data-state'),'paused');
    await mobile.close();
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
    console.log(JSON.stringify({passed:true,checks:['three-tool catalog','iframe/refresh/back/standalone','SVG filtering/dedup/order/error','PNG','reduced motion','responsive widths','seal keyboard/touch/pause/reset/material'],errors,failed,external}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
