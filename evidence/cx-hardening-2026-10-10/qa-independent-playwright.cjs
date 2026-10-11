/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS QA evidence harness; application lint remains enforced. */
/* Independent guest-surface QA at exact PR commit; never uses production credentials. */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const outdir = path.resolve("evidence/cx-hardening-2026-10-10");
const origin = process.env.QA_BASE_URL || "http://127.0.0.1:3124";
const sizes = [[320,568],[360,740],[390,844],[428,926],[768,1024],[1440,900]];
const themes = ["se","light","dark"];
const routes = ["/learn","/login","/onboarding","/learn/experiences","/learn/session/pas","/studio"];
const results = { meta: { time: new Date().toISOString(), commit:process.env.QA_SOURCE_COMMIT || "fixer-working-tree-based-on-7d1715c", baseUrl:origin, browser:"Chromium Playwright", mode:"localhost QA, guest, isolated contexts, no credentials", network:"native/no throttle", webVitals:"lab only, PerformanceObserver not field p75" }, geometry:[], axe:[], probes:[], stress:[], perf:[], failures:[] };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function sample(page) {
 return page.evaluate(() => {
  const q = s => document.querySelectorAll(s);
  const ctas = [...q('section[data-variant="hero"] a.button-primary')];
  const navs = [...q('nav[aria-label="Navegación móvil"]')];
  const button = ctas.find(el => {
    const r=el.getBoundingClientRect();
    return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=="hidden";
  }) || ctas[0];
  const visibleNav = navs.find(el => {const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.height>0&&s.display!=="none"&&s.visibility!=="hidden"});
  const rect = el => {if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
  const action=rect(button), nav=rect(visibleNav);
  const hit=action && action.top>=0&&action.bottom<=innerHeight ? document.elementFromPoint(action.left+action.width/2,action.top+action.height/2) : null;
  const interactive=[...q('main button, main a[href], main input, nav button, nav a[href], nav summary')].filter(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0 && r.height>0 && s.visibility!=="hidden" && s.display!=="none";}).map(el=>{const r=el.getBoundingClientRect();return {type:el.tagName.toLowerCase(),width:r.width,height:r.height,text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,65)}})
  return {url:location.pathname, theme:document.documentElement.dataset.theme, action,nav,clearance:action&&nav?nav.top-action.bottom:null, hitCenter:!!hit&&!!button&&(hit===button||button.contains(hit)), ctaCount:ctas.length, navCount:navs.length, journeySummaryCount:q("#journey summary").length, pageOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth), viewport:{width:document.documentElement.clientWidth,height:innerHeight}, smallTargets:interactive.filter(x=>x.width<44||x.height<44).slice(0,35),smallTargetCount:interactive.filter(x=>x.width<44||x.height<44).length, interactiveCount:interactive.length, bodyHeight:document.body.scrollHeight};
 });
}
async function run() {
 const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 results.meta.browserVersion = browser.version();
 try {
   for(const [width,height] of sizes) {
    for(const theme of themes) {
      const mobile=width<800; const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,reducedMotion:"reduce"});
      const page=await context.newPage();
      await page.addInitScript((id)=>localStorage.setItem("luma-theme-v1",id),theme);
      const id=width+"x"+height+"-"+theme;
      try{
       const response=await page.goto(origin+"/learn",{waitUntil:"domcontentloaded",timeout:30000});
       const immediate=await sample(page);
       await page.locator('section[data-variant="hero"]').first().waitFor({state:"visible",timeout:10000});
       await sleep(550);
       let stable=await sample(page);
       const firstScreen=width===390||width===428;
       if(width===320||width===360) {
         const button=page.locator('section[data-variant="hero"] a.button-primary').first();
         await button.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
         await sleep(130);
         stable=await sample(page);
       }
       let fail=[];
       if(response.status()!==200)fail.push("http_"+response.status());
       if(stable.theme!==theme)fail.push("theme_mismatch");
       if(stable.ctaCount!==1)fail.push("cta_count_"+stable.ctaCount);
       if(stable.journeySummaryCount!==1)fail.push("journey_count_"+stable.journeySummaryCount);
       if(stable.pageOverflow>0)fail.push("horizontal_overflow_"+stable.pageOverflow);
       if(stable.action && stable.action.height<44)fail.push("cta_under_44");
       if(stable.nav && width<=428 && (firstScreen||width<=360)) {
         if(stable.action.top<0||stable.action.bottom>stable.nav.top-8)fail.push("CTA_nav_clearance");
         if(!stable.hitCenter)fail.push("CTA_hit_testing");
       }
       if(!stable.action)fail.push("cta_absent");
       if(width===390 && theme==="dark" || width===320 && theme==="se" || width===1440 && theme==="light") {
          await page.screenshot({path:path.join(outdir,"screenshots",id+".png"),fullPage:false});
       }
       await page.reload({waitUntil:"domcontentloaded",timeout:30000});
       await sleep(250);
       const afterReload=await sample(page);
       if(afterReload.theme!==theme)fail.push("theme_not_persistent");
       results.geometry.push({id,firstScreen,initial:immediate,stable,afterReload:{theme:afterReload.theme,ctaCount:afterReload.ctaCount},result:fail.length?"FAIL":"PASS",fail});
       process.stdout.write("[geometry] "+id+" "+(fail.length?"FAIL "+fail.join(","):"PASS")+" clear="+stable.clearance+"\n");
      } catch(e){results.geometry.push({id,result:"ERROR",error:String(e).slice(0,300)});process.stdout.write("[geometry] "+id+" ERROR "+String(e).slice(0,90)+"\n");}
      await context.close();
    }
   }
   for(const route of routes) for(const theme of themes) {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.addInitScript(id=>localStorage.setItem("luma-theme-v1",id),theme);
    const id=route+"@"+theme;
    try{
      const response=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:30000});
      await sleep(350);
      const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
      const violations=report.violations.map(v=>({id:v.id,impact:v.impact,description:v.help,nodes:v.nodes.slice(0,6).map(n=>({target:n.target,summary:n.failureSummary?.slice(0,200)})),totalNodes:v.nodes.length}));
      const serious=violations.filter(v=>["serious","critical"].includes(v.impact)).length;
      results.axe.push({id,status:response.status(),serious,violations});
      process.stdout.write("[axe] "+id+" http="+response.status()+" violations="+violations.length+" serious="+serious+"\n");
    }catch(e){results.axe.push({id,error:String(e).slice(0,300)});process.stdout.write("[axe] "+id+" ERROR\n");}
    await context.close();
   }
   for(let n=0;n<15;n++){
     const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
     const page=await context.newPage();
     await page.addInitScript(()=>localStorage.setItem("luma-theme-v1","dark"));
     try{
       await page.goto(origin+"/learn",{waitUntil:"domcontentloaded",timeout:30000});
       const counts=[];
       for(const wait of [0,30,80,200,500]){if(wait)await sleep(wait); const s=await sample(page);counts.push({ms:wait,cta:s.ctaCount,journey:s.journeySummaryCount});}
       const bad=counts.some(x=>x.cta!==1||x.journey!==1);
       results.stress.push({trial:n+1,counts,bad});
       process.stdout.write("[stress] "+(n+1)+" "+JSON.stringify(counts)+"\n");
     }catch(e){results.stress.push({trial:n+1,error:String(e).slice(0,200)});}
     await context.close();
   }
   // Guest API authorization is safe and does not create learning records.
   const probeContext=await browser.newContext();
   for(const methodPath of [["GET","/api/learning/plan"],["PUT","/api/learning/plan"],["POST","/api/learning/events"],["GET","/api/coach/learners"]]){
      const [method,url]=methodPath;
      try{const response=await probeContext.request.fetch(origin+url,{method,headers:method==="GET"?{}:{"content-type":"application/json"},data:method==="GET"?undefined:"{}"}); const body=(await response.text()).slice(0,240);results.probes.push({method,url,status:response.status(),body});process.stdout.write("[api] "+method+" "+url+" "+response.status()+"\n");}
      catch(e){results.probes.push({method,url,error:String(e).slice(0,180)});}
   }
   await probeContext.close();
   // Lab-only Web Vitals: network unthrottled, repeat 3, no user-field inference.
   for (const size of [[390,844],[1440,900]]) {
      for(let n=0;n<3;n++){
         const mobile=size[0]<800, context=await browser.newContext({viewport:{width:size[0],height:size[1]},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
         const page=await context.newPage();
         await page.addInitScript(()=>{
             window.__qaVitals={lcp:null,cls:0,entries:[]};
             try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__qaVitals.lcp=e.startTime}).observe({type:"largest-contentful-paint",buffered:true})}catch{}
             try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__qaVitals.cls+=e.value}).observe({type:"layout-shift",buffered:true})}catch{}
         });
         try{
           await page.goto(origin+"/learn",{waitUntil:"load",timeout:30000});await sleep(900);
           const metrics=await page.evaluate(()=>{
            const nav=performance.getEntriesByType("navigation")[0];
            return {vitals:window.__qaVitals,domContentLoadedMs:nav?.domContentLoadedEventEnd,loadMs:nav?.loadEventEnd,responseEndMs:nav?.responseEnd,resourceCount:performance.getEntriesByType("resource").length};
           });
           results.perf.push({id:size[0]+"x"+size[1],iteration:n+1,metrics});process.stdout.write("[perf] "+size[0]+" iteration "+(n+1)+" lcp="+metrics.vitals?.lcp+" cls="+metrics.vitals?.cls+"\n");
         }catch(e){results.perf.push({id:size[0]+"x"+size[1],iteration:n+1,error:String(e).slice(0,200)});}
         await context.close();
      }
   }
 } finally {await browser.close();fs.writeFileSync(path.join(outdir,"independent-results.json"),JSON.stringify(results,null,2)+"\n");}
}
run().catch(e=>{console.error(e);process.exitCode=1});
