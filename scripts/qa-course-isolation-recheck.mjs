/**
 * Memory-light follow-up for browser crashes during the 43-check QA suite.
 * Simulated names and learning receipts only; NEVER production Firebase.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { chromium } from "playwright";

const project=process.env.GCLOUD_PROJECT;
const base=process.env.LUMA_QA_BASE_URL;
assert.match(project??"",/^demo-[a-z0-9-]+$/);
assert.equal(base,"http://127.0.0.1:3290");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:9099");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8085");
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT,project);
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL,"http://127.0.0.1:9099");
assert.equal(process.env.LUMA_LEARNING_ACCESS_MODE,"entitled");

const output="evidence/qa-course-journey-jeremy-abigail-adan-20261013/isolation-recheck.json";
mkdirSync("evidence/qa-course-journey-jeremy-abigail-adan-20261013",{recursive:true});
const report={kind:"qa-recheck-browser-isolation",startedAt:new Date().toISOString(),
  environment:"local-next-and-demo-firebase-emulators-only",checks:[],productionWrites:false};
const suffix=randomUUID().slice(0,8);
const app=initializeApp({projectId:project},"isolation-"+suffix);
const auth=getAuth(app);
let browser;
const user={};
async function check(name,fn){
  try{
    const detail=await fn();
    report.checks.push({name,status:"PASS",detail:detail??null});
    console.log("PASS "+name);
  }catch(e){
    const reason=String(e?.message??e).slice(0,450);
    report.checks.push({name,status:"FAIL",reason});
    console.log("FAIL "+name+" "+reason);
  }
}
async function signIn(page,who){
  await page.waitForFunction(()=>Boolean(window.__lumaQaAuth),null,{timeout:25000});
  const uid=await page.evaluate(({email,password})=>
    window.__lumaQaAuth.signIn(email,password),
    {email:who.email,password:who.password});
  assert.equal(uid,who.uid);
  await page.waitForFunction(async()=>Boolean(await window.__lumaQaAuth?.token()),null,{timeout:15000});
}
try {
  for(const name of ["Jeremy","Abigail"]){
    const email="qa-isolation-"+name.toLowerCase()+"-"+suffix+"@example.test";
    const password="QA-Isolated-Not-Real-123!";
    const record=await auth.createUser({email,password,emailVerified:true,displayName:name});
    user[name]={uid:record.uid,email,password};
  }
  browser=await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"es-GT",reducedMotion:"reduce"});
  const page=await context.newPage();
  page.setDefaultTimeout(13000);
  const errorLog=[];
  page.on("pageerror",e=>errorLog.push(String(e.message).slice(0,160)));
  await page.goto(base+"/learn",{waitUntil:"domcontentloaded"});
  await signIn(page,user.Jeremy);
  await page.waitForFunction(()=>document.body.innerText.includes("Jeremy"),null,{timeout:12000});

  await check("Jeremy: datos locales de simulación de práctica reproducen rúbrica",async()=>{
    await page.evaluate(()=>{
      const onboarding={goal:"emotions",diagnostic:"b",confidence:5,minutes:35,createdAt:new Date().toISOString()};
      const event={eventId:"qa-synthetic-jeremy",type:"SIMULATION_COMPLETED",conceptId:"pas",
        correctCount:3,completedAt:new Date().toISOString(),sourceId:"qa-demo-fixture",
        rubricId:"pas-v1",evidenceCategory:"scored",twinAuthority:"eligible",
        criteria:[
          {id:"event-vs-interpretation",label:"Distingue acontecimiento de interpretación",passed:true,attempts:1},
          {id:"thought-emotion-link",label:"Relaciona pensamiento y emoción",passed:true,attempts:1},
          {id:"evidence-preserving-reframe",label:"Reformula con evidencia",passed:true,attempts:1}
        ]};
      localStorage.setItem("luma-onboarding",JSON.stringify(onboarding));
      localStorage.setItem("luma-latest-learning-event",JSON.stringify(event));
      localStorage.setItem("luma-learning-events",JSON.stringify([
        {type:"PRACTICE_REFLECTION_RECORDED",experienceId:"congruence",completedAt:new Date().toISOString()}
      ]));
    });
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:/Tu avance se apoya en evidencias concretas/i}).waitFor();
    const text=await page.locator("body").innerText();
    assert.match(text,/Jeremy/);
    assert.match(text,/3 de 3 criterios/i);
    return{localRubric:"3/3"};
  });

  await check("Cambio Jeremy a Abigail: identidad correcta después de logout/login",async()=>{
    await page.waitForFunction(()=>Boolean(window.__lumaQaAuth),null,{timeout:13000});
    await page.evaluate(()=>window.__lumaQaAuth.signOut());
    await signIn(page,user.Abigail);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>document.body.innerText.includes("Abigail"),null,{timeout:13000});
    return{nameVisible:"Abigail"};
  });
  await check("Cambio Jeremy a Abigail: no heredar objetivo anterior",async()=>{
    const text=await page.locator("body").innerText();
    assert.doesNotMatch(text,/Gestionar mejor mis emociones/i,"Jeremy goal is visible to Abigail");
    return{scope:"goal"};
  });
  await check("Cambio Jeremy a Abigail: no heredar rúbrica de Jeremy",async()=>{
    const text=await page.locator("body").innerText();
    assert.doesNotMatch(text,/Tu avance se apoya en evidencias concretas|Cumpliste 3 de 3 criterios/i,
      "Jeremy scored evidence is visible to Abigail");
    return{scope:"rubric"};
  });
  await check("Cambio Jeremy a Abigail: eliminar datos locales no asociados a UID",async()=>{
    const data=await page.evaluate(()=>({
      event:localStorage.getItem("luma-latest-learning-event"),
      onboarding:localStorage.getItem("luma-onboarding"),
      reflections:localStorage.getItem("luma-learning-events")
    }));
    assert.equal(data.event,null,"Unscoped last event retained");
    assert.equal(data.onboarding,null,"Unscoped onboarding retained");
    assert.equal(data.reflections,null,"Unscoped reflection list retained");
    return{storage:"cleared"};
  });
  await check("Abigail: certificados vacíos sin error de carga",async()=>{
    await page.goto(base+"/learn/certificates",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:/Tus certificados aparecerán aquí/i}).waitFor({timeout:18000});
    return{noFalseCertificate:true};
  });
  await check("Abigail: viewport 390x844 no desborda horizontalmente",async()=>{
    await page.goto(base+"/learn",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
    const data=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
      innerWidth:window.innerWidth,nav:!!document.querySelector('nav[aria-label="Navegación móvil"]')}));
    assert.ok(data.scrollWidth<=data.innerWidth,"Horizontal overflow");
    assert.ok(data.nav);
    return data;
  });
  report.pageErrors=errorLog.slice(0,8);
  await context.close();
}catch(e){
  report.harnessError=String(e?.message??e).slice(0,400);
  console.log("HARNESS_ERROR "+report.harnessError);
}finally{
  if(browser)await browser.close().catch(()=>{});
  await deleteApp(app);
  report.finishedAt=new Date().toISOString();
  report.passed=report.checks.filter(x=>x.status==="PASS").length;
  report.failed=report.checks.filter(x=>x.status==="FAIL").length;
  report.verdict=report.harnessError?"BLOCKED":report.failed?"FAIL":"PASS";
  writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log("ISOLATION_RECHECK_VERDICT "+JSON.stringify({verdict:report.verdict,passed:report.passed,failed:report.failed,
    checks:report.checks.map(x=>({name:x.name,status:x.status}))}));
  if(report.harnessError)process.exitCode=2;
  else if(report.failed)process.exitCode=1;
}
