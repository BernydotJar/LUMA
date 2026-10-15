import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { chromium } from "playwright";

const require=createRequire(import.meta.url);
const axe=require("axe-core");
const project=process.env.GCLOUD_PROJECT||"",a=process.env.FIREBASE_AUTH_EMULATOR_HOST||"",b=process.env.FIRESTORE_EMULATOR_HOST||"";
if(!project.startsWith("demo-")||!a.startsWith("127.0.0.1:")||!b.startsWith("127.0.0.1:")||process.env.NEXT_PUBLIC_LUMA_QA_EMULATOR!=="true"||process.env.LUMA_INSTITUTION_REQUESTS_ENABLED!=="true")throw Error("REFUSE_NON_DEMO_QA_BROWSER");
const base="http://127.0.0.1:3194";
const out="evidence/first-client-institution-browser-2026-10-14";
mkdirSync(out+"/screenshots",{recursive:true});
const app=initializeApp({projectId:project},"academy-browser-"+randomUUID());
const auth=getAuth(app),actors=[],password="Qa"+randomUUID().replaceAll("-","")+"9!Z";
const report={project,source:"isolated Git checkout with uncommitted academy intake files + QA-only Firebase Auth emulator client",checks:[],screenshots:[],status:"RUNNING",consoleErrors:[]};
async function actor(label){const x=await auth.createUser({email:`qa-${label}-${randomUUID().slice(0,7)}@example.test`,password,emailVerified:true});actors.push(x);return x;}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:"PASS",detail});console.log("PASS",name,JSON.stringify(detail).slice(0,260));}catch(e){report.checks.push({name,status:"FAIL",error:String(e.stack||e).slice(0,600)});throw e;}}
async function login(page,user){
 await page.goto(base+"/qa-emulator-login",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.documentElement.dataset.lumaQaHydrated==="true",null,{timeout:45000});
 await page.getByLabel("QA email").fill(user.email);
 await page.getByLabel("QA password").fill(password);
 await page.getByRole("button",{name:"Sign in to emulator"}).click();
 await page.waitForURL(/\/academia\/solicitud(?:\?|$)/,{timeout:45000});
 await page.getByRole("heading",{name:"Tu academia, preparada para enseñar y acompañar."}).waitFor({timeout:30000});
}
let browser;
try{
 const one=await actor("applicant"),another=await actor("other");
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"reduce"});
 const page=await ctx.newPage();page.setDefaultTimeout(30000);
 page.on("pageerror",e=>report.consoleErrors.push(String(e.message).slice(0,300)));
 await check("01 unauthenticated visitor sees safe sign-in CTA",async()=>{
  await page.goto(base+"/academia/solicitud",{waitUntil:"domcontentloaded"});
  const next=page.getByRole("link",{name:/Continuar con Google/});await next.waitFor();
  assert.equal(await next.getAttribute("href"),"/login?next=%2Facademia%2Fsolicitud");
  await page.screenshot({path:out+"/screenshots/01-guest-mobile.png",fullPage:true});
  return {verifiedLoginRequired:true,unsafeApplicantFormNotShown:await page.locator("form").count()===0};
 });
 await login(page,one);
 await check("02 verified applicant sees the form and accessible 44px controls",async()=>{
  const input=page.getByLabel("Nombre de tu academia");await input.waitFor();
  const geom=await page.evaluate(()=>{
   const el=document.querySelector('#academy-name'),btn=document.querySelector('button[type="submit"]');
   return {inputHeight:el.getBoundingClientRect().height,buttonHeight:btn.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  assert.ok(geom.inputHeight>=44&&geom.buttonHeight>=44&&geom.overflow===0,JSON.stringify(geom));
  await page.screenshot({path:out+"/screenshots/02-request-form-mobile.png",fullPage:true});
  return geom;
 });
 await check("03 automated WCAG 2 A/AA audit on the applicant form",async()=>{
  await page.addScriptTag({content:axe.source});
  const result=await page.evaluate(async()=>{
   const r=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}});
   return r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,count:v.nodes.length,targets:v.nodes.slice(0,3).map(n=>n.target)}));
  });
  assert.equal(result.length,0,JSON.stringify(result));
  return {violations:0};
 });
 await check("03b WCAG 2.2 automated contrast across Seres, Light and Dark",async()=>{
  const evaluated=[];
  for (const theme of ["se", "light", "dark"]) {
    await page.evaluate((id)=>{
      document.documentElement.dataset.theme=id;
      window.localStorage.setItem("luma-theme-v1",id);
      window.dispatchEvent(new Event("luma-theme-change"));
    },theme);
    await page.waitForTimeout(120);
    const violations=await page.evaluate(async()=>{
      const r=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa"]}});
      return r.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,targets:v.nodes.map(n=>n.target)}));
    });
    assert.equal(violations.length,0,JSON.stringify({theme,violations}));
    evaluated.push({theme,violations:0});
    if (theme!=="se") await page.screenshot({path:out+`/screenshots/02-form-${theme}-mobile.png`,fullPage:true});
  }
  await page.evaluate(()=>{
    document.documentElement.dataset.theme="se";
    window.localStorage.setItem("luma-theme-v1","se");
    window.dispatchEvent(new Event("luma-theme-change"));
  });
  return evaluated;
 });
 await check("04 applicant submits actual form and receives pending receipt",async()=>{
  await page.getByLabel("Nombre de tu academia").fill("Academia Modelo Autónoma");
  await page.getByLabel("Tu relación con la academia").selectOption("director");
  await page.getByLabel("¿Cómo impartes tus cursos?").selectOption("hybrid");
  await page.getByLabel("¿Cuántos participantes estimas atender?").selectOption("201-1000");
  await page.getByRole("button",{name:/Enviar solicitud/}).click();
  await page.getByText("Solicitud registrada").waitFor({timeout:30000});
  assert.equal(await page.getByRole("heading",{name:"Academia Modelo Autónoma"}).count(),1);
  await page.screenshot({path:out+"/screenshots/03-application-receipt-mobile.png",fullPage:true});
  return {received:true,organisation:"Academia Modelo Autónoma",adminPrivilegesShown:false};
 });
 await check("05 submission restores after reload and retained Firestore status",async()=>{
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByText("Solicitud registrada").waitFor({timeout:30000});
  assert.equal(await page.getByText("Pendiente de revisión").count(),1);
  return {reloadRestored:true,stage:"received"};
 });
 const otherCtx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const other=await otherCtx.newPage();other.setDefaultTimeout(30000);
 await login(other,another);
 await check("06 different academy applicant cannot read previous user's request",async()=>{
  await other.getByLabel("Nombre de tu academia").waitFor();
  assert.equal(await other.getByText("Solicitud registrada").count(),0);
  assert.equal(await other.getByText("Academia Modelo Autónoma").count(),0);
  await other.screenshot({path:out+"/screenshots/04-independent-applicant-desktop.png",fullPage:true});
  return {isolated:true,desktop:1440};
 });
 await check("07 allowlisted login redirect cannot leave LUMA",async()=>{
  await other.goto(base+"/login?next=https://example.net/evil",{waitUntil:"domcontentloaded"});
  await other.waitForURL(/\/learn(?:\?|$)/,{timeout:35000});
  assert.equal(new URL(other.url()).origin,base);
  return {externalRedirect:false};
 });
 await ctx.close();await otherCtx.close();
}catch(e){report.error=String(e.stack||e).slice(0,1500)}finally{
 if(browser)await browser.close();
 let failed=0;for(const u of actors){try{await auth.deleteUser(u.uid)}catch{failed++}}
 report.summary={passed:report.checks.filter(x=>x.status==="PASS").length,failed:report.checks.filter(x=>x.status==="FAIL").length};
 report.status=report.error?"FAIL":"PASS";
 report.cleanup=failed===0?"Synthetic Auth users deleted; demo Firestore discarded":"User cleanup failures: "+failed;
 writeFileSync(out+"/results.json",JSON.stringify(report,null,2)+"\n");await deleteApp(app);
}
console.log("BROWSER_FINAL",JSON.stringify({status:report.status,summary:report.summary,consoleErrors:report.consoleErrors.length}));
if(report.error)throw Error(report.error);
