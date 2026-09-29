const {chromium}=require(process.env.DPG_PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path');
const os=require('node:os');
const rootURL=process.env.DPG_QA_URL || 'http://127.0.0.1:4174/';
const subpathURL=process.env.DPG_QA_SUBPATH_URL || 'http://127.0.0.1:4175/DPG/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.DPG_BROWSER_PATH || undefined,headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const page=await context.newPage();const errors=[];const failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 const check=(v,msg)=>{if(!v)throw Error(msg)};
 for(const base of [rootURL,subpathURL]){
  await page.goto(base);await page.locator('.tool-card[data-tool=ascii-studio]').waitFor();check(await page.locator('iframe').count()===0,'homepage loads iframe');
  check(await page.locator('.tool-card').count()===(await (await page.request.get(base+'catalog.json')).json()).tools.length,'catalog tool count');
  await page.locator('.tool-card[data-tool=ascii-studio]').click();await page.locator('iframe').waitFor();const frame=page.frameLocator('iframe');await frame.locator('#textGlyphs').waitFor();
  check(page.url()===base+'?tool=ascii-studio','detail URL');
  await frame.locator('#textGlyphs').fill('TEST');await page.reload();await page.frameLocator('iframe').locator('#textGlyphs').waitFor();
  check(await page.locator('#detail-title').textContent()==='ASCII Studio','detail refresh');
  const popup=context.waitForEvent('page');await page.locator('#open-tool').click();const standalone=await popup;await standalone.waitForLoadState();check(standalone.url()===base+'tools/ascii-studio/index.html','standalone URL');await standalone.close();
  await page.locator('.back-link').click();check(await page.locator('iframe').count()===0,'return iframe cleanup');check(page.url()===base,'return home URL');
  await page.goBack();await page.frameLocator('iframe').locator('#textGlyphs').waitFor();await page.goForward();await page.locator('.tool-card[data-tool=ascii-studio]').waitFor();
  await page.locator('.tool-card[data-tool=ascii-studio]').focus();await page.keyboard.press('Enter');await page.frameLocator('iframe').locator('#mediaUpload').waitFor();
  const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=90;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,120,90);return c.toDataURL().split(',')[1]}),'base64');
  await page.frameLocator('iframe').locator('#mediaUpload').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:image});
  await page.frameLocator('iframe').locator('#exportSvg').waitFor({state:'visible'});await page.waitForTimeout(200);
  const download=page.waitForEvent('download');await page.frameLocator('iframe').locator('#exportSvg').click();await download;
  await page.goto(base+'?tool=not-a-tool');await page.locator('#not-found').waitFor({state:'visible'});await page.locator('#not-found [data-home]').click();await page.locator('.tool-card[data-tool=ascii-studio]').waitFor();
 }
 for(const width of [390,768,1280]){
  await page.setViewportSize({width,height:900});await page.goto(rootURL);await page.locator('.tool-card[data-tool=ascii-studio]').waitFor();await page.screenshot({path:path.join(os.tmpdir(), `dpg-home-${width}.png`),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home overflow');
  await page.locator('.tool-card[data-tool=ascii-studio]').click();await page.frameLocator('iframe').locator('#textGlyphs').waitFor();await page.screenshot({path:path.join(os.tmpdir(), `dpg-detail-${width}.png`),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'detail overflow');
 }
 // Empty and failure states are controlled responses, not changes to the project.
 await page.route('**/catalog.json',r=>r.fulfill({json:{tools:[]}}));await page.goto(rootURL);await page.getByText('工具正在准备中，过段时间再来看看。').waitFor();check(await page.locator('iframe').count()===0,'empty iframe');await page.unroute('**/catalog.json');
 await page.route('**/catalog.json',r=>r.abort());await page.reload();await page.locator('#retry-catalog').waitFor({state:'visible'});await page.unroute('**/catalog.json');await page.locator('#retry-catalog').click();await page.locator('.tool-card[data-tool=ascii-studio]').waitFor();
 await page.route('**/tools/ascii-studio/index.html',r=>r.abort());await page.locator('.tool-card[data-tool=ascii-studio]').click();await page.locator('#retry-tool').waitFor({state:'visible'});await page.unroute('**/tools/ascii-studio/index.html');await page.locator('#retry-tool').click();await page.frameLocator('iframe').locator('#textGlyphs').waitFor();
 check(errors.length===0,'page errors '+errors.join(','));check(failed.length===0,'HTTP errors '+failed.join(','));
 console.log(JSON.stringify({passed:['home/list','enter/detail','reload deep link','back link','browser back/forward','independent open','keyboard enter','iframe upload/download','unknown slug','root and actual /DPG/ serving','390/768/1280 layout','empty catalog','catalog retry','tool retry'],errors,failed,browser:browser.version()}));
 await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
