import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { chromium } from "playwright";

const tenant="qa-first-academy",liveProgram="qa-mary-premium",everProgram="qa-mary-evergreen";
const base="http://127.0.0.1:3191",project=process.env.GCLOUD_PROJECT ?? "";
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "";
const storeHost=process.env.FIRESTORE_EMULATOR_HOST ?? "";
if(!project.startsWith("demo-")||!authHost.startsWith("127.0.0.1:")||!storeHost.startsWith("127.0.0.1:")||
  process.env.NEXT_PUBLIC_LUMA_QA_EMULATOR!=="true"||process.env.LUMA_LEARNING_TENANT_ID!==tenant||
  process.env.LUMA_LEARNING_ACCESS_MODE!=="entitled")throw Error("REFUSE_PRODUCTION_BROWSER_QA");
const app=initializeApp({projectId:project},"qa-browser-"+randomUUID());
const auth=getAuth(app),actors=[],password="QaBrowser"+randomUUID().replaceAll("-","")+"_9!";
const date=new Date().toISOString();
const artifact="evidence/first-client-browser-qa-2026-10-14";
mkdirSync(artifact+"/screenshots",{recursive:true});
const report={date,sourceCommit:"5332b8ed8b5c6bdee81f9c09ce83fde40cbe624c",project,environment:"isolated QA source overlay + Next dev on localhost + Firebase emulators",checks:[],status:"RUNNING",pageErrors:[],requests:[]};
async function actor(label,claims){
 const a=await auth.createUser({email:`qa-${label}-${randomUUID().slice(0,8)}@example.test`,password,emailVerified:true});
 actors.push(a);if(claims)await auth.setCustomUserClaims(a.uid,claims);return a;
}
async function getToken(user){
 const resp=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-demo`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:user.email,password,returnSecureToken:true})});
 const obj=await resp.json();assert.equal(resp.status,200,JSON.stringify(obj));return obj.idToken;
}
async function api(method,path,token,body,headers={}){
 const h={...headers};if(token)h.authorization=`Bearer ${token}`;
 if(body!==undefined)h["content-type"]="application/json";
 const resp=await fetch(base+path,{method,headers:h,...body===undefined?{}:{body:JSON.stringify(body)}});
 const raw=await resp.text();let value;try{value=JSON.parse(raw)}catch{value={raw:raw.slice(0,120)}}
 return {status:resp.status,data:value};
}
function code(res,n){assert.equal(res.status,n,JSON.stringify(res.data).slice(0,400));return res.data;}
async function check(id,fn){
 try{const d=await fn();report.checks.push({id,result:"PASS",detail:d});console.log("PASS",id,JSON.stringify(d).slice(0,350));}
 catch(e){report.checks.push({id,result:"FAIL",error:String(e.stack||e).slice(0,600)});console.error("FAIL",id,String(e.message||e).slice(0,430));throw e;}
}
const nextWeek=new Date(Date.now()+7*864e5).toISOString();
async function browserLogin(context,user){
 const page=await context.newPage();
 page.setDefaultTimeout(25000);
 page.on("pageerror",err=>report.pageErrors.push({url:page.url(),message:err.message.slice(0,260)}));
 page.on("console",msg=>{if(msg.type()==="error")report.pageErrors.push({url:page.url(),message:msg.text().slice(0,260)});});
 page.on("request",req=>{
   const url=req.url();
   if(!url.includes("/api/learning/plan")&&!url.includes("/api/coach/learners")&&!url.includes("/api/coach/interventions"))return;
   const h=req.headers();report.requests.push({route:new URL(url).pathname,selectedProgram:h["x-luma-program-id"] ?? null,status:"requested"});
 });
 await page.goto(base+"/qa-emulator-login",{waitUntil:"domcontentloaded",timeout:60000});
 // Wait for React hydration so a test click cannot issue a native GET form submit.
 await page.waitForFunction(() => document.documentElement.dataset.lumaQaHydrated === "true",null,{timeout:45000});
 await page.getByLabel("QA email").fill(user.email);
 await page.getByLabel("QA password").fill(password);
 await page.getByRole("button",{name:"Sign in to emulator"}).click();
 await page.waitForURL(/\/learn(?:\?|$)/,{timeout:45000});
 return page;
}
let browser;
try{
 const owner=await actor("owner",{role:"admin",admin:true,adminTenantIds:[tenant]});
 const coach=await actor("marycoach",{role:"coach",coach:true,coachTenantIds:[tenant]});
 const foreignCoach=await actor("foreigncoach",{role:"coach",coach:true,coachTenantIds:["qa-other-academy"]});
 const learner=await actor("multilearner");
 const [ownerToken,learnerToken]=await Promise.all([getToken(owner),getToken(learner)]);
 await check("SETUP demo institution, Mary offerings, grants, live session",async()=>{
   const common={tenantId:tenant,timezone:"America/Guatemala",coachIds:[coach.uid],status:"active"};
   const live=code(await api("POST","/api/programs/admin/offerings",ownerToken,{...common,programId:liveProgram,cohortKey:"qa-live-2026",title:"QA Mary Premium Live",deliveryMode:"live"}),200).offering;
   const ever=code(await api("POST","/api/programs/admin/offerings",ownerToken,{...common,programId:everProgram,cohortKey:"qa-evergreen-2026",title:"QA Mary Evergreen",deliveryMode:"asynchronous"}),200).offering;
   code(await api("POST",`/api/programs/admin/offerings/${live.offeringId}/sessions`,ownerToken,{title:"QA Mary First Live Class",startsAt:nextWeek,durationMinutes:90,classroomProvider:"livekit",classroomCapacity:25,recordingPolicy:"none"}),200);
   const grant={tenantId:tenant,reason:"E2E synthetic browser QA",expiresAt:new Date(Date.now()+200*864e5).toISOString(),email:learner.email};
   code(await api("POST","/api/enrollments/institutional",ownerToken,{...grant,programId:liveProgram,offeringId:live.offeringId}),201);
   code(await api("POST","/api/enrollments/institutional",ownerToken,{...grant,programId:everProgram,offeringId:ever.offeringId}),201);
   code(await api("PUT","/api/learning/plan",learnerToken,{onboarding:{goal:"emotions",diagnostic:"b",confidence:2,minutes:12,createdAt:date}},{"x-luma-program-id":liveProgram}),200);
   return {liveProgram,everProgram,scheduledLive:true,learnerHasTwoEntitlements:true};
 });
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const learnerCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:"reduce"});
 const learnerPage=await browserLogin(learnerCtx,learner);
 await check("LEARNER-01 first sign-in sees only enrolled programs",async()=>{
  const combo=learnerPage.getByRole("combobox",{name:"Programa asignado"});
  await combo.waitFor({timeout:40000});
  const choices=await combo.locator("option").allTextContents();
  assert.ok(choices.some(x=>x.includes("QA Mary Premium Live")),JSON.stringify(choices));
  assert.ok(choices.some(x=>x.includes("QA Mary Evergreen")),JSON.stringify(choices));
  assert.equal(await combo.inputValue(),"");
  await learnerPage.screenshot({path:artifact+"/screenshots/01-learner-first-two-courses-mobile.png",fullPage:false});
  return {options:choices,initialSelection:"requires_choice"};
 });
 await check("LEARNER-02 live course selection scopes plan and agenda",async()=>{
  await learnerPage.getByRole("combobox",{name:"Programa asignado"}).selectOption(liveProgram);
  await learnerPage.getByText("QA Mary First Live Class").waitFor({timeout:35000});
  const geometries=[];
  for(const theme of ["se","light","dark"]){
    await learnerPage.evaluate((id)=>{
      document.documentElement.dataset.theme=id;
      window.localStorage.setItem("luma-theme-v1",id);
      window.dispatchEvent(new Event("luma-theme-change"));
    },theme);
    await learnerPage.waitForTimeout(90);
    const geometry=await learnerPage.evaluate(()=>{
      const cta=document.querySelector('section[data-variant="hero"] a.button-primary');
      const nav=document.querySelector('nav[aria-label="Navegacion movil"],nav[aria-label="Navegación móvil"]');
      if(!cta||!nav)return {missing:true,ctaExists:Boolean(cta),navExists:Boolean(nav)};
      const c=cta.getBoundingClientRect(),n=nav.getBoundingClientRect();
      const cx=c.left+c.width/2,cy=c.top+c.height/2;
      const hit=document.elementFromPoint(cx,cy);
      return {ctaTop:c.top,ctaBottom:c.bottom,ctaHeight:c.height,navTop:n.top,clearance:n.top-c.bottom,horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,hitTest:hit===cta||cta.contains(hit),scrollY:window.scrollY};
    });
    geometries.push({theme,...geometry});
    assert.ok(!geometry.missing&&geometry.ctaTop>=0&&geometry.ctaHeight>=44&&geometry.clearance>=8&&geometry.horizontalOverflow<=0&&geometry.hitTest,JSON.stringify({theme,geometry}));
    if(theme!=="se")await learnerPage.screenshot({path:artifact+`/screenshots/02-learner-live-${theme}-mobile.png`,fullPage:false});
  }
  await learnerPage.evaluate(()=>{document.documentElement.dataset.theme="se";window.localStorage.setItem("luma-theme-v1","se");window.dispatchEvent(new Event("luma-theme-change"));});
  await learnerPage.screenshot({path:artifact+"/screenshots/02-learner-live-course-mobile.png",fullPage:false});
  assert.ok(report.requests.some(x=>x.route==="/api/learning/plan"&&x.selectedProgram===liveProgram));
  return {selected:liveProgram,liveClassVisible:true,learningPlanRequestScoped:true,geometries};
 });
 await check("LEARNER-02b compact and tablet viewport CTA remains reachable",async()=>{
  const measured=[];
  for(const [width,height] of [[320,568],[360,740],[390,844],[428,926],[768,1024]]){
    await learnerPage.setViewportSize({width,height});
    await learnerPage.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await learnerPage.waitForTimeout(120);
    const cta=learnerPage.locator('section[data-variant="hero"] a.button-primary');
    await cta.scrollIntoViewIfNeeded();
    await learnerPage.waitForTimeout(100);
    let rect=await learnerPage.evaluate(()=>{
      const el=document.querySelector('section[data-variant="hero"] a.button-primary');
      const nav=document.querySelector('nav[aria-label="Navegación móvil"]');
      const c=el.getBoundingClientRect(),n=nav?.getBoundingClientRect();
      const target= document.elementFromPoint(c.left+c.width/2,c.top+c.height/2);
      return {top:c.top,bottom:c.bottom,height:c.height,navTop:(n&&n.width>1&&n.height>1&&getComputedStyle(nav).position==="fixed")?n.top:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,hitTest:target===el||el.contains(target),scrollY:window.scrollY};
    });
    if(rect.navTop!==null && rect.navTop-rect.bottom<8){
      const dy=rect.bottom-rect.navTop+16;
      await learnerPage.evaluate((pixels)=>window.scrollBy({top:pixels,behavior:"instant"}),dy);
      await learnerPage.waitForTimeout(120);
      rect=await learnerPage.evaluate(()=>{
        const el=document.querySelector('section[data-variant="hero"] a.button-primary');
        const nav=document.querySelector('nav[aria-label="Navegación móvil"]');
        const c=el.getBoundingClientRect(),n=nav?.getBoundingClientRect();
        const target=document.elementFromPoint(c.left+c.width/2,c.top+c.height/2);
        return {top:c.top,bottom:c.bottom,height:c.height,navTop:(n&&n.width>1&&n.height>1&&getComputedStyle(nav).position==="fixed")?n.top:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,hitTest:target===el||el.contains(target),scrollY:window.scrollY};
      });
    }
    const minClearance=rect.navTop===null?height-rect.bottom:rect.navTop-rect.bottom;
    assert.ok(rect.top>=0 && minClearance>=8 && rect.height>=44 && rect.overflow===0 && rect.hitTest,JSON.stringify({width,height,rect,minClearance}));
    const { height: ctaHeight, ...rest } = rect;
    measured.push({width,viewportHeight:height,ctaHeight,...rest,minClearance});
  }
  await learnerPage.setViewportSize({width:390,height:844});
  await learnerPage.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  return measured;
 });
 await check("LEARNER-03 switching evergreen hides unrelated live sessions and restores",async()=>{
  const combo=learnerPage.getByRole("combobox",{name:"Programa asignado"});
  await combo.selectOption(everProgram);
  await learnerPage.waitForTimeout(650);
  assert.equal(await learnerPage.getByText("QA Mary First Live Class").count(),0);
  await learnerPage.reload({waitUntil:"domcontentloaded"});
  await combo.waitFor({timeout:35000});
  assert.equal(await combo.inputValue(),everProgram);
  assert.equal(await learnerPage.getByText("QA Mary First Live Class").count(),0);
  await learnerPage.screenshot({path:artifact+"/screenshots/03-learner-evergreen-session-restored-mobile.png",fullPage:false});
  return {selected:everProgram,liveClassAbsent:true,sameBrowserReloadRestores:true};
 });
 await learnerCtx.close();
 const coachCtx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const coachPage=await browserLogin(coachCtx,coach);
 await coachPage.goto(base+"/studio",{waitUntil:"domcontentloaded"});
 await check("COACH-01 select authorized live program and read roster",async()=>{
  const combo=coachPage.getByRole("combobox",{name:"Programa asignado"});
  await combo.waitFor({timeout:35000});
  const choices=await combo.locator("option").allTextContents();
  assert.ok(choices.some(x=>x.includes("QA Mary Premium Live")));
  await combo.selectOption(liveProgram);
  await coachPage.getByText("Prioridades de acompañamiento").waitFor({timeout:35000});
  await coachPage.waitForTimeout(500);
  assert.ok(report.requests.some(x=>x.route==="/api/coach/learners"&&x.selectedProgram===liveProgram));
  await coachPage.screenshot({path:artifact+"/screenshots/04-coach-live-1440.png",fullPage:false});
  return {courseOptions:choices,selected:liveProgram,coachReadScoped:true};
 });
 await coachCtx.close();
 const foreignCtx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const foreignPage=await browserLogin(foreignCtx,foreignCoach);
 await foreignPage.goto(base+"/studio",{waitUntil:"domcontentloaded"});
 await check("COACH-02 cross-tenant actor denied",async()=>{
  await foreignPage.getByText("Esta cuenta no tiene autorización para consultar estos programas.").waitFor({timeout:35000});
  assert.equal(await foreignPage.getByRole("combobox",{name:"Programa asignado"}).count(),0);
  await foreignPage.screenshot({path:artifact+"/screenshots/05-foreign-coach-denied.png",fullPage:false});
  return {coachPickerDenied:true};
 });
 await foreignCtx.close();
}catch(error){report.error=String(error.stack||error).slice(0,1500)}finally{
 if(browser)await browser.close();
 let failedCleanup=0;
 for(const person of actors){try{await auth.deleteUser(person.uid)}catch{failedCleanup++}}
 report.status=report.error?"FAIL":"PASS";
 report.summary={pass:report.checks.filter(x=>x.result==="PASS").length,fail:report.checks.filter(x=>x.result==="FAIL").length,actorCount:actors.length};
 report.cleanup=failedCleanup===0?"All emulator identities deleted; emulator runtime discarded after execution":`Failed identity cleanup count ${failedCleanup}`;
 writeFileSync(artifact+"/results.json",JSON.stringify(report,null,2)+"\n");
 await deleteApp(app);
}
console.log("QA_BROWSER_FINAL",JSON.stringify({status:report.status,summary:report.summary,pageErrors:report.pageErrors.length,cleanup:report.cleanup}));
if(report.error)throw Error(report.error);
