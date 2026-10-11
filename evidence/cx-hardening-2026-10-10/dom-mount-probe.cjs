const fs=require("fs");
const {chromium}=require("playwright");
const output="evidence/cx-hardening-2026-10-10/dom-mount-probe.json";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const runs=[];
 for(let i=0;i<30;i++){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:"reduce"});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error.message).slice(0,200)));
  page.on("console",msg=>{if(msg.type()==="error")errors.push(String(msg.text()).slice(0,170))});
  await page.addInitScript(()=>{
   window.__qaDomEvents=[];
   const find=()=>{
    const ctas=[...document.querySelectorAll('section[data-variant="hero"] a.button-primary')];
    const summaries=[...document.querySelectorAll('#journey summary')];
    if(ctas.length<2&&summaries.length<2)return;
    const describe=el=>{
       const r=el.getBoundingClientRect();
       const parents=[];
       let item=el;
       for(let j=0;j<7&&item;j++,item=item.parentElement)parents.push({tag:item.tagName,id:item.id,className:String(item.className||"").slice(0,80),hidden:item.hidden});
       return {html:el.outerHTML.slice(0,330),rect:{top:r.top,width:r.width,height:r.height},parents};
    };
    if(window.__qaDomEvents.length<12)window.__qaDomEvents.push({
      time:performance.now(),readyState:document.readyState,
      ctaCount:ctas.length,summaryCount:summaries.length,headCount:document.querySelectorAll("head").length,
      bodyCount:document.querySelectorAll("body").length,
      mainCount:document.querySelectorAll("main").length,
      ctas:ctas.slice(0,3).map(describe),summaries:summaries.slice(0,3).map(describe)
    });
   };
   new MutationObserver(find).observe(document,{childList:true,subtree:true});
   window.addEventListener("DOMContentLoaded",find);
  });
  try {
    await page.goto("http://127.0.0.1:3140/learn",{waitUntil:"domcontentloaded",timeout:18000});
    await page.waitForTimeout(360);
    const snapshot=await page.evaluate(()=>({events:window.__qaDomEvents,at360:{cta:document.querySelectorAll('section[data-variant="hero"] a.button-primary').length,summary:document.querySelectorAll('#journey summary').length}}));
    runs.push({trial:i+1,...snapshot,errors:errors.slice(0,4)});
    process.stdout.write("trial "+(i+1)+" events="+snapshot.events.length+" stable="+snapshot.at360.cta+"/"+snapshot.at360.summary+"\n");
  } catch(e){runs.push({trial:i+1,error:String(e).slice(0,200)});}
  await context.close();
 }
 await browser.close();
 const summary={source:"fixer local Next16 production build",testedAt:new Date().toISOString(),runsWithDuplicates:runs.filter(r=>r.events?.length).length,numberOfRuns:runs.length,all:runs};
 fs.writeFileSync(output,JSON.stringify(summary,null,2)+"\n");
 console.log("SUMMARY "+JSON.stringify({runs:summary.numberOfRuns,withDuplicates:summary.runsWithDuplicates}));
})().catch(e=>{console.error(e);process.exitCode=1});
