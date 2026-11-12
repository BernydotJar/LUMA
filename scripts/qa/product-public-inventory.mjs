import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.env.LUMA_ACCEPTANCE_ORIGIN ?? 'https://luma.lch-app.cloud';
const parsed = new URL(base);
if (!['https://luma.lch-app.cloud', 'https://luma--luma-learning-intelligence.us-central1.hosted.app'].includes(parsed.origin) || parsed.pathname !== '/') {
  throw new Error('REFUSE_UNKNOWN_ACCEPTANCE_ORIGIN');
}
const paths=['/','/learn','/studio','/studio/programs','/studio/enrollments','/academia/solicitud','/plataforma/solicitudes','/academia/primer-curso','/api/academic/offerings/invalid/curriculum-draft'];
const out='evidence/product-acceptance-2026-10-19/public-ui-readonly.json';
const versionPath='evidence/product-acceptance-2026-10-19/published-version.json';
mkdirSync('evidence/product-acceptance-2026-10-19',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={origin:parsed.origin,checkedAt:new Date().toISOString(),mode:'UNAUTHENTICATED READ_ONLY',routes:[]};
try {
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  for (const path of paths){
    const page=await c.newPage();
    let httpStatus=0, browserNavigationError;
    try {
      const response=await fetch(parsed.origin+path, {method:'GET',redirect:'follow',signal:AbortSignal.timeout(16_000)});
      httpStatus=response.status;
    } catch(error) {browserNavigationError=String(error).slice(0,150);}
    try {
      try {await page.goto(parsed.origin+path,{waitUntil:'commit',timeout:20_000});}
      catch(error){browserNavigationError=String(error).slice(0,250);}
      await page.waitForTimeout(1600);
      const snapshot=await page.evaluate(()=>({
        title:document.title,
        headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent?.trim().slice(0,120)).slice(0,9),
        actions:[...document.querySelectorAll('button, input[type=submit], a')].filter(e=>e.getClientRects().length)
          .map(e=>({kind:e.tagName,label:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80),href:e.tagName==='A'?e.getAttribute('href'):undefined,disabled:e.hasAttribute('disabled')}))
          .filter(x=>x.label).slice(0,75),
        formCount:document.querySelectorAll('form').length,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      }));
      report.routes.push({path,httpStatus,browserUrl:page.url(),browserNavigationError,...snapshot});
      console.log(path,httpStatus,'DOM',page.url(),snapshot.headings.join(' / ').slice(0,115),'actions',snapshot.actions.length);
    } catch(error) {
      report.routes.push({path,httpStatus,browserUrl:page.url(),browserNavigationError,error:String(error).slice(0,280)});
      console.log(path,httpStatus,'DOM_BLOCKED',String(error).slice(0,100));
    } finally {await page.close();}
  }
  await c.close();
} finally {await browser.close();}
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('PUBLIC_UI_REPORT',out);
try {
  const r=await fetch(parsed.origin+'/api/version',{cache:'no-store',signal:AbortSignal.timeout(16_000)});
  const version=await r.json();
  if(r.status!==200 || !/^[a-f0-9]{40}$/.test(version.gitSha||''))throw Error('INVALID_VERSION_RESPONSE');
  writeFileSync(versionPath,JSON.stringify({schemaVersion:1,origin:parsed.origin,checkedAt:new Date().toISOString(),status:r.status,
    repository:version.repository,gitSha:version.gitSha,runId:version.runId,commitTime:version.commitTime},null,2)+'\n');
  console.log('PUBLISHED_VERSION',version.gitSha);
} catch(error){
  writeFileSync(versionPath,JSON.stringify({origin:parsed.origin,checkedAt:new Date().toISOString(),error:String(error)},null,2)+'\n');
  console.log('PUBLISHED_VERSION_BLOCKED',String(error).slice(0,150));
}
