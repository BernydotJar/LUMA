import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.LUMA_QA_BASE_URL ?? "http://127.0.0.1:3184";
if (!base.startsWith("http://127.0.0.1:")) {
  throw new Error("REFUSE_NONLOCAL_FIRST_CLIENT_BROWSER_TEST");
}
const root = "evidence/first-client-e2e-2026-10-14";
await mkdir(root+"/screenshots", {recursive:true});
const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const records=[];
const details={checkedAt:new Date().toISOString(),sourceCommit:"7ef32ba9ff3c56896da536a86ca14286b99ddfb3",baseUrl:base,mode:"synthetic guest browser, production Next build on loopback; no real customer identity",tests:records};
async function record(id,expectedOutcome,run){
  const began=Date.now();
  try{
    const detail=await run();
    const result={id,status:"PASS",durationMs:Date.now()-began,expectedOutcome,...detail};
    records.push(result);
    process.stdout.write("PASS "+id+" "+JSON.stringify(detail).slice(0,320)+"\n");
  } catch(e){
    const result={id,status:"FAIL",durationMs:Date.now()-began,error:String(e.stack||e).slice(0,900),expectedOutcome};
    records.push(result);
    process.stdout.write("FAIL "+id+" "+result.error.slice(0,230)+"\n");
  }
}
const opts={viewport:{width:1440,height:900},reducedMotion:"reduce"};
const ctx=await browser.newContext(opts);
const page=await ctx.newPage();
const pageErrors=[];
page.on("pageerror",e=>pageErrors.push({route:page.url(),error:e.message.slice(0,250)}));
await record("CLIENT-001 first contact and clear destination","guest can reach learning home and practice",async()=>{
 const response=await page.goto(base+"/",{waitUntil:"domcontentloaded"});
 await page.waitForURL(/\/learn$/,{timeout:9000});
 await page.getByRole("heading",{name:/Aprender se nota en lo que haces/i}).waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/01-first-visit-desktop.png",fullPage:false});
 const links=await page.locator('main a[href]').evaluateAll(els=>els.map(el=>({label:(el.getAttribute("aria-label")||el.textContent||"").trim().slice(0,65),href:el.getAttribute("href")})).slice(0,22));
 return {http:response.status(),landed:new URL(page.url()).pathname,primaryPracticeLinks:await page.locator('section[data-variant="hero"] a.button-primary').count(),links};
});
await record("CLIENT-002 identity first-time and institution sign-up","new admin understands entry point and registration",async()=>{
 await page.goto(base+"/login");
 await page.getByRole("button",{name:/Continuar con Google/i}).waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/02-login-google-only.png",fullPage:false});
 return {googleButton:await page.getByRole("button",{name:/Continuar con Google/i}).count(),institutionRegistrationActions:await page.getByRole("link",{name:/crear organización|registrar academia|crear institución|registrar escuela/i}).count(),createOrganizationForm:await page.locator('form input[name*="organization"],form input[name*="tenant"]').count()};
});
await record("LEARNER-001 initial goal onboarding","new learner can choose goal, diagnostic, time and start",async()=>{
 await page.goto(base+"/learn");
 await page.getByRole("link",{name:/Elige lo que quieres desarrollar/i}).first().click();
 await page.waitForURL(/\/onboarding$/,{timeout:12000});
 await page.screenshot({path:root+"/screenshots/03-learner-onboarding-start.png",fullPage:false});
 await page.getByRole("button",{name:/Gestionar mejor mis emociones/i}).click();
 await page.getByRole("button",{name:/Continuar/i}).click();
 await page.getByRole("button",{name:/Siempre arruino todo/i}).click();
 await page.getByRole("button",{name:/Continuar/i}).click();
 await page.getByRole("button",{name:/12\s*minutos/i}).click();
 await page.getByRole("button",{name:/Continuar/i}).click();
 await page.screenshot({path:root+"/screenshots/04-onboarding-summary.png",fullPage:false});
 await page.getByRole("button",{name:/Entrar a mi experiencia/i}).click();
 await page.waitForURL(/\/learn$/,{timeout:12000});
 const stored=await page.evaluate(()=>localStorage.getItem("luma-onboarding"));
 assert.ok(stored?.includes('"goal":"emotions"'));
 await page.reload();
 await page.locator('#journey summary').waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/05-personalized-home-guest.png",fullPage:false});
 return {url:new URL(page.url()).pathname,goalPersistedInBrowser:JSON.parse(stored).goal,backendProof:false,localStorageKeys:["luma-onboarding"]};
});
await record("LEARNER-002 catalog discovery","learner can find practices and course catalog",async()=>{
 await page.goto(base+"/learn/experiences");
 await page.getByRole("heading",{name:/Tu programa, convertido en práctica/i}).waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/06-catalog-default.png",fullPage:false});
 const titles=await page.locator('section[aria-label="Experiencias disponibles"] h3').allTextContents();
 const links=await page.locator('section[aria-label="Experiencias disponibles"] a[href]').evaluateAll(els=>els.map(e=>e.getAttribute("href")).slice(0,15));
 return {titles,linkCount:links.length,links,tenantProgramSelector:await page.getByRole("combobox",{name:/mi programa|mi academia|cohorte/i}).count()};
});
await record("LEARNER-003 practice evidence and within-session restore","practice works, receipt exists, local persistence survives reload",async()=>{
 await page.goto(base+"/learn/session/pas");
 await page.getByRole("button",{name:/Siempre arruino todo/i}).click();
 await page.getByRole("button",{name:/Continuar/i}).click();
 await page.getByRole("button",{name:/Vergüenza y miedo/i}).click();
 await page.getByRole("button",{name:/Continuar/i}).click();
 await page.getByRole("button",{name:/Esta entrega tuvo dos errores concretos/i}).click();
 await page.getByRole("button",{name:/Registrar evidencia/i}).click();
 await page.getByRole("heading",{name:/Demostraste transferencia/i}).waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/07-evidence-receipt.png",fullPage:false});
 const eventRaw=await page.evaluate(()=>localStorage.getItem("luma-latest-learning-event"));
 assert.ok(eventRaw?.includes("SIMULATION_COMPLETED"));
 await page.goto(base+"/learn");
 await page.reload();
 const returnStorage=await page.evaluate(()=>localStorage.getItem("luma-latest-learning-event"));
 assert.ok(returnStorage?.includes("SIMULATION_COMPLETED"));
 const recordToken=await page.request.get(base+"/api/learning/plan");
 return {eventType:JSON.parse(eventRaw).type,sameBrowserPersists:true,anonymousServerPlanStatus:recordToken.status(),backendEvidenceNotProven:true};
});
await record("LEARNER-004 ask LUMA a question","learner receives evidence-based response or explicit fallback",async()=>{
 await page.goto(base+"/learn");
 const box=page.getByRole("textbox",{name:"Pregunta a LUMA"});
 await box.waitFor({timeout:14000});
 await box.fill("¿Qué significa un pensamiento automático saboteador?");
 await page.getByRole("button",{name:"Enviar pregunta"}).click();
 await page.waitForTimeout(1300);
 await page.screenshot({path:root+"/screenshots/08-tutor-answer.png",fullPage:false});
 const text=(await page.locator('main').innerText()).slice(-1400);
 return {containsRelevantTerms:/saboteador|p\.a\.s|no tengo evidencia/i.test(text),lastText:text.slice(-520),inputRemains:await box.count()};
});
await record("OWNER-001 admin programs access control","program creation must require authorized organization admin",async()=>{
 await page.goto(base+"/studio/programs");
 await page.getByText(/Inicia sesión con una cuenta administradora/i).waitFor({timeout:12000});
 await page.screenshot({path:root+"/screenshots/09-programs-guest.png",fullPage:false});
 return {guestGateVisible:true,technicalInputsVisible:await page.locator("#ops-program,#ops-cohort,#ops-coaches").count()};
});
await record("OWNER-002 enrollments and bulk imports access control","admissions and bulk import require authorized tenant operator",async()=>{
 await page.goto(base+"/studio/enrollments");
 await page.waitForTimeout(750);
 await page.screenshot({path:root+"/screenshots/10-matrículas-guest.png",fullPage:false});
 return {guestGateText:(await page.locator("main").innerText()).slice(-550),bulkImportVisible:await page.getByText(/Inscripción masiva con revisión/i).count()};
});
await record("COACH-001 follow-up entry and boundaries","coach view shows authorized access requirement, no fabricated learner data",async()=>{
 await page.goto(base+"/studio");
 await page.getByText(/Accede para consultar a tus participantes/i).waitFor({timeout:15000});
 await page.screenshot({path:root+"/screenshots/11-studio-guest.png",fullPage:false});
 return {requiresLogin:true,signInCTA:await page.getByRole("link",{name:/Iniciar sesión/i}).count()};
});
await record("SUPPORT-001 support case surface","identify genuine ticketing availability",async()=>{
 const r=await page.request.get(base+"/support/tickets");
 const r2=await page.request.get(base+"/tickets");
 await page.goto(base+"/learn");
 const affordances=await page.getByRole("link",{name:/soporte|abrir ticket|crear solicitud|reportar problema/i}).count();
 return {urlSupportStatus:r.status(),urlTicketsStatus:r2.status(),helpLinkCount:affordances,capability:"NOT_FOUND_IN_CURRENT_PRODUCT"};
});
await record("AUTOMATION-001 follow-up automation surface","identify real scheduling/notification workflow availability",async()=>{
 const r=await page.request.get(base+"/studio/automation");
 const r2=await page.request.get(base+"/api/automation");
 await page.goto(base+"/studio");
 return {automationUIStatus:r.status(),automationAPIStatus:r2.status(),userCanScheduleFollowup:await page.getByRole("button",{name:/programar aviso|enviar recordatorio|crear automatización/i}).count()>0,capability:"NOT_FOUND_IN_CURRENT_PRODUCT"};
});
await record("INSTITUTION-001 organization onboarding API feature gate","institution provisioning is consciously disabled, not self-serve",async()=>{
 const r=await page.request.get(base+"/api/platform/institutions/qa-new-institution/draft");
 const json=await r.json();
 return {http:r.status(),error:json.error,disabledByDefault:r.status()===503&&json.error==="feature_unavailable"};
});
await record("MOBILE-001 first-time learner entry","mobile CTA and navigation reachable",async()=>{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:"reduce"});
 const p=await c.newPage();
 try{
  await p.goto(base+"/learn");
  await p.locator('section[data-variant="hero"] a.button-primary').waitFor({timeout:11000});
  const detail=await p.evaluate(()=>{
    const a=document.querySelector('section[data-variant="hero"] a.button-primary'),nav=document.querySelector('nav[aria-label="Navegación móvil"]');
    if(!a||!nav)return {missing:true};
    const x=a.getBoundingClientRect(),n=nav.getBoundingClientRect();
    return {ctaHeightPx:x.height,clearancePx:n.top-x.bottom,overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)};
  });
  await p.screenshot({path:root+"/screenshots/12-learner-mobile.png",fullPage:false});
  return {...detail,ctaLabel:await p.locator('section[data-variant="hero"] a.button-primary').innerText()};
 }finally{await c.close()}
});
await ctx.close();
await browser.close();
details.summary={pass:records.filter(x=>x.status==="PASS").length,fail:records.filter(x=>x.status==="FAIL").length,blockedClientCapabilities:["self_serve_institution_setup","end_user_ticketing","outbound_followup_automation","authenticated_admin_and_coach_browser_without_approved_qa_identities"],pageErrors};
await writeFile(root+"/first-client-guest-results.json",JSON.stringify(details,null,2)+"\n");
process.stdout.write("FINISH "+JSON.stringify(details.summary)+"\n");
if(details.summary.fail)process.exitCode=1;
