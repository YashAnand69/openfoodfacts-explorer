import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const out=process.argv[2];const browser=await chromium.launch({headless:true,channel:"chrome"});const page=await browser.newPage({viewport:{width:Number(process.env.MAP_WIDTH||1280),height:900},deviceScaleFactor:Number(process.env.MAP_DPR||1)});let requests=[],errors=[];
page.on('response',r=>{if(/marker-(icon|shadow)/.test(r.url()))requests.push({url:r.url(),status:r.status(),type:r.headers()['content-type']})});page.on('pageerror',e=>errors.push(e.message));
await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII=','base64')}));
await page.goto((process.env.MAP_BASE || 'http://127.0.0.1:5186')+'/__research-map',{waitUntil:'networkidle'});await page.waitForTimeout(2500);
let imgs=await page.locator('.leaflet-marker-icon,.leaflet-marker-shadow').evaluateAll(els=>els.map(el=>({tag:el.tagName,src:el.src,complete:el.complete,naturalWidth:el.naturalWidth,width:el.getBoundingClientRect().width})));
await page.screenshot({path:out+'.png',fullPage:true});await writeFile(out+'.json',JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),dpr:await page.evaluate(()=>window.devicePixelRatio),requests,errors,imgs,text:(await page.locator('body').innerText()).slice(0,700)},null,2));console.log(JSON.stringify({requests,errors,imgs}));await browser.close();
