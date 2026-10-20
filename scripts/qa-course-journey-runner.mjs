/**
 * Independent browser QA for learner lifecycle.
 * Runs only against demo-* Firebase Auth+Firestore emulators and local Next.js.
 * Records blocked/failed expectations; NEVER asserts overall PASS while issues exist.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";

const project=process.env.GCLOUD_PROJECT;
const base=process.env.LUMA_QA_BASE_URL;
const tenant=process.env.LUMA_LEARNING_TENANT_ID;
const program=process.env.LUMA_LEARNING_PROGRAM_ID;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
assert.match(project??"", /^demo-[a-z0-9-]+$/);
assert.match(base??"", /^http:\/\/127\.0\.0\.1:3290$/);
assert.match(authHost??"", /^127\.0\.0\.1:9099$/);
assert.match(firestoreHost??"", /^127\.0\.0\.1:8085$/);
assert.equal(process.env.LUMA_LEARNING_ACCESS_MODE,"entitled");
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT,project);
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL,"http://127.0.0.1:9099");
assert.equal(tenant,"qa-course-journey");
assert.equal(program,"pnl-practitioner");

const output="evidence/qa-course-journey-jeremy-abigail-adan-20261013";
mkdirSync(output,{recursive:true});
mkdirSync("/tmp/luma-course-journey-jeremy-abigail-adan-screens",{recursive:true});
const runId=randomUUID().slice(0,10);
const report={
  scenario:"US-LRN-001 | Jeremy, Abigail and Adan: Hotmart-to-full-course lifecycle",
  qaMode:"FIREBASE_EMULATORS_AND_LOCAL_NEXT_BROWSER",
  productionWrites:false,
  actualHotmartPurchase:false,
  realGoogleOAuth:false,
  referenceCommit:"7ef32ba9ff3c56896da536a86ca14286b99ddfb3",
  executedOn:new Date().toISOString(),
  syntheticLearnersOnly:true,
  personas:["Jeremy","Abigail","Adán","Julián (sin compra)","Sofía (entrenadora)","Coach ajeno (tenant aislado)"],
  checks:[],
  defects:[],
  screenshots:[],
  browser:"Chromium headless Playwright",
  environment:{project,tenant,program,base,auth:"emulator",firestore:"emulator"},
};
let currentPage;
let currentStep="initializing";
function safeError(error){
  return String(error?.message??error).replace(/[a-z0-9.-]+@example\.test/gi,"<qa-email>").replace(/Bearer\s+[A-Za-z0-9._-]+/g,"Bearer <redacted>").slice(0,500);
}
async function check(name, fn, priority="P1") {
  currentStep=name;
  try{
    const detail=await fn();
    report.checks.push({name,status:"PASS",...detail&&typeof detail==="object"?{detail}:{}});
    console.log("PASS "+name);
    return true;
  }catch(error){
    const message=safeError(error);
    report.checks.push({name,status:"FAIL",priority,reason:message});
    report.defects.push({id:"CX-JOURNEY-"+String(report.defects.length+1).padStart(2,"0"),name,priority,message});
    console.log("FAIL "+name+" "+message);
    if(currentPage){
      try{
        const dest="/tmp/luma-course-journey-jeremy-abigail-adan-screens/failure-"+String(report.defects.length).padStart(2,"0")+".png";
        await currentPage.screenshot({path:dest,fullPage:false,timeout:4500});
        report.screenshots.push({case:name,path:dest,containsSyntheticDataOnly:true});
      }catch{}
    }
    return false;
  }
}
async function request(path,{method="GET",hottok,token,body}={}){
  const res=await fetch(base+path,{method,headers:{
    ...(body!==undefined?{"content-type":"application/json"}:{}),
    ...(hottok?{"x-hotmart-hottok":hottok}:{}),
    ...(token?{authorization:"Bearer "+token}:{})
  },...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const raw=await res.text();
  let json={};
  try{json=JSON.parse(raw||"{}");}catch{
    throw new Error("Non-JSON HTTP "+res.status+" "+path+" "+raw.slice(0,70));
  }
  return{status:res.status,body:json};
}
const nowIso=new Date().toISOString();
const product="qa-hotmart-practitioner-"+runId;
const offeringId=createHash("sha256").update(JSON.stringify([tenant,program,"qa-october-"+runId])).digest("hex");
const app=initializeApp({projectId:project},"luma-qa-course-"+runId);
const adminAuth=getAuth(app),db=getFirestore(app);
const secret="qa-only-hotmart-hottok-not-real";
let browser;
async function actor(name,claims){
  const email="qa-course-"+name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"")+"-"+runId+"@example.test";
  const password="QaTest123!NoRealCustomer";
  const u=await adminAuth.createUser({email,password,emailVerified:true,displayName:name});
  if(claims)await adminAuth.setCustomUserClaims(u.uid,claims);
  return{uid:u.uid,email,password,name};
}
async function browserActor(person,viewport={width:1440,height:900}){
  const ctx=await browser.newContext({viewport,locale:"es-GT",reducedMotion:"reduce"});
  const page=await ctx.newPage();
  currentPage=page;
  page.setDefaultTimeout(13000);
  const runtimeErrors=[];
  page.on("pageerror",e=>runtimeErrors.push(safeError(e)));
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:35000});
  await page.getByRole("heading",{name:/Tu aprendizaje, con continuidad/i}).waitFor();
  await page.goto(base+"/learn",{waitUntil:"domcontentloaded",timeout:35000});
  await page.waitForFunction(()=>Boolean(window.__lumaQaAuth),null,{timeout:25000});
  const uid=await page.evaluate(async({email,password})=>
    window.__lumaQaAuth.signIn(email,password),{email:person.email,password:person.password});
  assert.equal(uid,person.uid,"browser authenticated same Firebase QA UID");
  await page.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
  await page.waitForFunction(async () => Boolean(await window.__lumaQaAuth?.token()), null, {timeout:22000});
  return{ctx,page,runtimeErrors};
}
async function tokenFrom(page) {
  await page.waitForFunction(async () => Boolean(await window.__lumaQaAuth?.token()), null, {timeout:20000});
  const t=await page.evaluate(()=>window.__lumaQaAuth?.token());
  assert.ok(t,"Signed-in QA token available");
  return t;
}
async function emulatorToken(person) {
  // Browser navigation must not determine the coach's API authorization fixture.
  const response=await fetch("http://"+authHost+
    "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-only",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({email:person.email,password:person.password,returnSecureToken:true}),
      signal:AbortSignal.timeout(10000),
    });
  const payload=await response.json();
  assert.equal(response.status,200,"QA Auth Emulator password signin");
  assert.ok(payload.idToken,"QA token available");
  const verified=await adminAuth.verifyIdToken(payload.idToken);
  assert.equal(verified.uid,person.uid,"Firebase ID belongs to intended QA actor");
  return payload.idToken;
}
async function snapshotPage(page,name){
  const path="/tmp/luma-course-journey-jeremy-abigail-adan-screens/"+name+".png";
  await page.screenshot({path,fullPage:false,timeout:10000});
  report.screenshots.push({case:name,path,containsSyntheticDataOnly:true});
}
async function pauseReady(page){await page.waitForTimeout(480);}
async function waitReactReady(page, selector) {
  await page.waitForFunction((css) => {
    const el=document.querySelector(css);
    return Boolean(el && Object.keys(el).some(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$")));
  }, selector, {timeout:16000});
}

const people={};
let jeremy, abigail, adan, julian, coachView, foreignCoach;
try{
  // Isolated disposable testing personas. Mariana is NEVER used as real test data.
  for(const name of ["Jeremy","Abigail","Adán","Julián"]){people[name]=await actor(name);}
  people["Sofía"]=await actor("Sofía",{coach:true,coachTenantIds:[tenant]});
  people["Coach ajeno"]=await actor("CoachAjeno",{coach:true,coachTenantIds:["qa-foreign-tenant"]});

  const t=new Date(Date.now()+2*24*3600*1000).toISOString();
  await db.collection("programOfferings").doc(offeringId).set({
    offeringId,tenantId:tenant,programId:program,cohortKey:"qa-october-"+runId,
    title:"Practitioner PNL · Cohorte QA Octubre",deliveryMode:"hybrid",
    timezone:"America/Guatemala",status:"active",coachIds:[people["Sofía"].uid],
    createdAt:nowIso,updatedAt:nowIso,
  });
  await db.collection("programOfferings").doc(offeringId).collection("sessions").doc("qa-live-1").set({
    sessionId:"qa-live-1",offeringId,title:"Clase de práctica en vivo · QA",
    startsAt:t,durationMinutes:90,classroomProvider:"livekit",recordingPolicy:"none",
    classroomCapacity:20,status:"scheduled",createdAt:nowIso,updatedAt:nowIso,
  });
  const mapId=createHash("sha256").update(JSON.stringify(["hotmart",product])).digest("hex");
  await db.collection("commerceProductMappings").doc(mapId).set({
    provider:"hotmart",externalProductId:product,tenantId:tenant,
    productId:program,programId:program,offeringId,active:true,
    createdAt:nowIso,updatedAt:nowIso,
  });
  const payloadFor=(person)=>({
    id:"qa-purchase-"+person.uid,
    creation_date:Date.now()-5000,
    version:"2.0.0",event:"PURCHASE_APPROVED",
    data:{
      product:{id:44123,external_id:product,name:"Practitioner PNL QA"},
      buyer:{ucode:"qa-buyer-"+person.uid,email:person.email,name:person.name},
      purchase:{transaction:"qa-trans-"+person.uid,status:"APPROVED",recurrence_number:1},
    },
  });
  for(const name of ["Jeremy","Abigail","Adán"]){
    await check("Hotmart compra aprobada "+name,async()=>{
      const r=await request("/api/commerce/webhooks/hotmart",{
        method:"POST",hottok:secret,body:payloadFor(people[name])
      });
      assert.equal(r.status,200);
      assert.equal(r.body.outcome,"granted");
    },"P0");
  }
  browser=await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});

  const guest=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"reduce"});
  let guestPage=await guest.newPage();currentPage=guestPage;
  await check("Invitado: entrada y estructura de aprendizaje",async()=>{
    const res=await guestPage.goto(base+"/learn",{waitUntil:"domcontentloaded",timeout:35000});
    assert.equal(res.status(),200);
    await guestPage.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
    await guestPage.getByRole("link",{name:/Accede para personalizar tu experiencia/i}).waitFor();
    assert.equal(await guestPage.locator("text=/3\\/3 criterios/").count(),0,"Guest must not inherit Mariana grades");
    return{url:guestPage.url()};
  });
  await check("Invitado: localizar curso y prácticas",async()=>{
    await guestPage.goto(base+"/learn/experiences",{waitUntil:"domcontentloaded"});
    await guestPage.getByRole("heading",{name:/Siete módulos/i}).waitFor();
    const modules=await guestPage.locator('button[aria-label^="Ir al módulo"]').count();
    assert.equal(modules,7);
    const openLinks=await guestPage.getByRole("link",{name:"Abrir práctica"}).count();
    assert.ok(openLinks>=4,"Expected >3 practice experiences");
    return{modules,practices:openLinks};
  });
  await check("Invitado: catálogo marca acceso restringido al contenido comprado",async()=>{
    const body=await guestPage.locator("body").innerText();
    assert.match(body,/Accede|Inscripción requerida|Desbloquear|Requiere acceso/i,
      "Program previews must explain whether paid content is locked");
  },"P1");
  await guest.close();currentPage=null;

  jeremy=await browserActor(people.Jeremy);
  const vp=jeremy.page;
  await check("Jeremy: bienvenida usa identidad, no Mariana",async()=>{
    await vp.getByText(/Jeremy/).first().waitFor({timeout:10000});
    const text=await vp.locator("body").innerText();
    assert.ok(!text.includes("Buenas noches, Mariana"));
    await snapshotPage(vp,"jeremy-start");
  });
  await check("Jeremy: nombre del curso comprado visible al entrar",async()=>{
    const text=await vp.locator("body").innerText();
    assert.match(text,/Practitioner PNL|Mi curso|Curso adquirido/i,
      "Dashboard must show explicit purchased-course identity");
  },"P1");
  await check("Jeremy: clase en vivo de su cohorte visible",async()=>{
    await vp.getByRole("heading",{name:/Tu programa también ocurre/i}).waitFor({timeout:15000});
    await vp.getByText("Clase de práctica en vivo · QA").waitFor();
    const a=vp.getByRole("link",{name:/Entrar al aula de Clase de práctica en vivo/i});
    assert.equal(await a.count(),1);
    assert.match(await a.getAttribute("href"),/\/classroom\//);
    return{classroomLink:"/classroom/<qa-cohort>/qa-live-1"};
  },"P0");

  let token;
  await check("Jeremy: compra vinculada a identidad Firebase verificada",async()=>{
    token=await tokenFrom(vp);
    const claim=await request("/api/commerce/access",{token});
    assert.equal(claim.status,200);
    assert.equal(claim.body.enrollments.length,1);
    assert.equal(claim.body.enrollments[0].status,"active");
    assert.equal(claim.body.enrollments[0].programId,program);
  },"P0");

  await check("Jeremy: onboarding completo por controles reales",async()=>{
    await vp.getByRole("link",{name:/Elige lo que quieres desarrollar/i}).click();
    await vp.getByRole("heading",{name:/Qué quieres ser capaz de hacer/i}).waitFor();
    await waitReactReady(vp, "button[data-selected]");
    await vp.getByRole("button",{name:/Gestionar mejor mis emociones/i}).click();
    await vp.getByRole("button",{name:/Continuar/i}).last().click();
    await vp.getByRole("heading",{name:/Vamos a comprobar lo que ya puedes aplicar/i}).waitFor();
    await vp.getByRole("button",{name:/Siempre arruino todo/i}).click();
    await vp.getByRole("slider",{name:"Confianza"}).press("End");
    await vp.getByRole("button",{name:/Continuar/i}).last().click();
    await vp.getByRole("button",{name:/35\s*minutos/i}).click();
    await vp.getByRole("button",{name:/Continuar/i}).last().click();
    await vp.getByRole("heading",{name:/Tu punto de partida está listo/i}).waitFor();
    await vp.getByRole("button",{name:/Entrar a mi experiencia/i}).click();
    await vp.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
    const r=await request("/api/learning/plan",{token});
    assert.equal(r.status,200);
    assert.equal(r.body.persistence.source,"firestore");
    assert.equal(r.body.persistence.version,1);
    assert.equal(r.body.plan.state.availableMinutes,35);
    return{serverVersion:1,minutes:35};
  },"P0");

  await check("Jeremy: explora módulo, lección y práctica",async()=>{
    await vp.getByRole("link",{name:/Explora tu programa/i}).click();
    await vp.getByRole("heading",{name:/Siete módulos/i}).waitFor();
    await vp.getByRole("button",{name:"Ir al módulo 3"}).click();
    const buttons=await vp.getByRole("button",{name:/Seleccionar /}).count();
    assert.equal(buttons,7);
    await vp.goto(base+"/learn/experience/pas-detectar-y-reformular");
    await vp.getByRole("heading",{name:/P.A.S.: detectar y reformular/i}).waitFor();
    await vp.getByRole("heading",{name:/Lo esencial antes de practicar/i}).waitFor();
    await vp.getByRole("link",{name:/Abrir simulación/i}).waitFor();
    return{modules:buttons,detailRoute:"/learn/experience/pas-detectar-y-reformular"};
  });
  await check("Jeremy: video/lección con posición reproducible",async()=>{
    const video=vp.locator("video, iframe[src*=player], [data-testid='course-lesson-player']");
    assert.ok(await video.count()>0,"No lesson player found; descriptive module cards are not playable lessons");
  },"P1");

  await check("Jeremy: evaluación PAS 3 criterios en navegador",async()=>{
    await vp.getByRole("link",{name:/Abrir simulación/i}).click();
    await vp.getByRole("heading",{name:/La entrega con dos errores/i}).waitFor();
    await vp.getByRole("button",{name:/Siempre arruino todo; seguro/i}).click();
    await vp.getByRole("button",{name:/Continuar/i}).last().click();
    await vp.getByRole("button",{name:/Vergüenza y miedo/i}).click();
    await vp.getByRole("button",{name:/Continuar/i}).last().click();
    await vp.getByRole("button",{name:/Esta entrega tuvo dos errores concretos/i}).click();
    await vp.getByRole("button",{name:/Registrar evidencia/i}).click();
    await vp.getByRole("heading",{name:/Demostraste transferencia/i}).waitFor();
    await vp.getByText(/3\/3 criterios/i).waitFor();
    await vp.getByText(/Evidencia sincronizada/i).waitFor({timeout:13000});
    const r=await request("/api/learning/plan",{token});
    assert.equal(r.status,200);
    assert.equal(r.body.persistence.version,2);
    const stored=await db.collection("learningTenants")
      .doc(createHash("sha256").update(tenant).digest("hex"))
      .collection("learningPrograms")
      .doc(createHash("sha256").update(program).digest("hex"))
      .collection("learners").doc(people.Jeremy.uid).get();
    assert.equal(stored.data()?.version,2);
    await snapshotPage(vp,"jeremy-practice-receipt");
    return{receipt:"3/3",serverVersion:2};
  },"P0");

  await check("Jeremy: progreso visible al volver a su ruta",async()=>{
    await vp.getByRole("link",{name:/Volver a mi ruta/i}).click();
    await vp.getByRole("heading",{name:/Tu avance se apoya en evidencias concretas/i}).waitFor({timeout:15000});
    return{visibleOnSameDevice:true};
  },"P0");

  await check("Jeremy: avanza a dos experiencias complementarias y guarda reflexiones",async()=>{
    const paths=["congruencia-tres-canales","calibracion-observar-antes-de-interpretar"];
    for(const slug of paths){
      await vp.goto(base+"/learn/experience/"+slug,{waitUntil:"domcontentloaded"});
      await waitReactReady(vp, 'textarea[aria-label="Tu reflexión"]');
      await vp.getByRole("textbox",{name:"Tu reflexión"}).fill(
        "Hoy apliqué el concepto en una conversación difícil; separé la observación de la interpretación y propuse una alternativa verificable."
      );
      await vp.getByRole("button",{name:/Registrar práctica/i}).click();
      await vp.getByRole("heading",{name:/Ya dejaste una señal útil/i}).waitFor();
      await vp.getByText(/Auto-reportada/i).waitFor();
    }
    const saved=await vp.evaluate(()=>JSON.parse(window.localStorage.getItem("luma-learning-events")??"[]"));
    assert.equal(saved.filter(x=>x.type==="PRACTICE_REFLECTION_RECORDED").length,2);
    const server=await request("/api/learning/plan",{token:await emulatorToken(people.Jeremy)});
    assert.equal(server.status,200);
    assert.equal(server.body.persistence.version,2,"Reflections should not silently increment rubric mastery");
    return{complementaryActivities:2,activityType:"self-reported",serverRubricVersion:2};
  },"P1");

  await check("Jeremy: la rúbrica PAS sigue visible tras explorar otras experiencias",async()=>{
    await vp.goto(base+"/learn",{waitUntil:"domcontentloaded"});
    await vp.getByRole("heading",{name:/Tu avance se apoya en evidencias concretas/i}).waitFor({timeout:13000});
    await vp.getByText(/3 de 3 criterios/i).first().waitFor({timeout:13000});
  },"P0");

  await check("Jeremy: pregunta contextual al tutor (sin inventar fuente)",async()=>{
    await vp.locator("#luma").scrollIntoViewIfNeeded();
    const field=vp.getByRole("textbox",{name:"Pregunta a LUMA"});
    await field.fill("¿Cómo sé si un pensamiento es P.A.S.? Dame una fuente.");
    await vp.getByRole("button",{name:"Enviar pregunta"}).click();
    await vp.getByText(/contenido de este programa no está disponible/i).waitFor({timeout:20000});
    return{fallback:"RAG scoped unavailable, explicitly disclosed"};
  },"P1");

  await check("Jeremy: tutor ofrece escalamiento cuando RAG no disponible",async()=>{
    const text=await vp.locator("#luma").innerText();
    assert.match(text,/contacta|ayuda humana|entrenador|reintentar|soporte|solicita ayuda/i,
      "No human escalation or actionable recovery alongside unavailable RAG");
  },"P1");

  await check("Jeremy: certificados vacíos, sin diploma ficticio",async()=>{
    await vp.goto(base+"/learn/certificates",{waitUntil:"domcontentloaded"});
    await vp.getByRole("heading",{name:/Una evidencia que permanece contigo/i}).waitFor();
    await vp.getByRole("heading",{name:/Tus certificados aparecerán aquí/i}).waitFor({timeout:20000});
    assert.equal(await vp.getByRole("button",{name:/Descargar PDF/i}).count(),0);
  });

  await check("Jeremy: nueva sesión recupera progreso en API",async()=>{
    const fresh=await browserActor(people.Jeremy,{width:390,height:844});
    const apiToken=await tokenFrom(fresh.page);
    const r=await request("/api/learning/plan",{token:apiToken});
    assert.equal(r.status,200);
    assert.equal(r.body.persistence.version,2);
    assert.ok(r.body.plan.routeChanged);
    await snapshotPage(fresh.page,"jeremy-new-device");
    report.jeremyFreshContext=fresh;
    return{serverVersion:2,viewport:"390x844"};
  },"P0");

  await check("Jeremy: nueva sesión muestra criterios de práctica en UI",async()=>{
    const fresh=report.jeremyFreshContext?.page;
    assert.ok(fresh);
    await fresh.getByRole("heading",{name:/Tu avance se apoya en evidencias concretas/i}).waitFor({timeout:10000});
    await fresh.getByText(/3 de 3 criterios/i).first().waitFor({timeout:12000});
  },"P0");

  // Abigail: begins with less confidence and explicitly needs feedback.
  abigail=await browserActor(people["Abigail"],{width:390,height:844});
  const ap=abigail.page;
  await check("Abigail: orientación inicial sin logros ajenos",async()=>{
    await ap.getByRole("link",{name:/Elige lo que quieres desarrollar/i}).waitFor();
    const text=await ap.locator("body").innerText();
    assert.ok(!/3 de 3 criterios/.test(text),"New learner must not inherit another user");
    await snapshotPage(ap,"abigail-first-visit");
  },"P0");

  await check("Abigail: onboarding de ocho minutos, diagnóstico incorrecto",async()=>{
    await ap.goto(base+"/onboarding",{waitUntil:"domcontentloaded"});
    await waitReactReady(ap, "button[data-selected]");
    await ap.getByRole("button",{name:/Comunicarme con más claridad/i}).click();
    assert.equal(await ap.getByRole("button",{name:/Comunicarme con más claridad/i}).getAttribute("data-selected"),"true");
    await ap.getByRole("button",{name:/Continuar/i}).last().click();
    await ap.getByRole("heading",{name:/Vamos a comprobar lo que ya puedes aplicar/i}).waitFor();
    await ap.getByRole("button",{name:/La observación se refiere a esta entrega/i}).click();
    await ap.getByRole("button",{name:/Continuar/i}).last().click();
    await ap.getByRole("button",{name:/8\s*minutos/i}).click();
    await ap.getByRole("button",{name:/Continuar/i}).last().click();
    await ap.getByRole("button",{name:/Entrar a mi experiencia/i}).click();
    await ap.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
    const r=await request("/api/learning/plan",{token:await tokenFrom(ap)});
    assert.equal(r.status,200);
    assert.equal(r.body.plan.state.availableMinutes,8);
    return{minutes:8,initialSignal:"diagnostic a"};
  },"P0");

  await check("Abigail: una respuesta incorrecta ofrece una pista",async()=>{
    await ap.goto(base+"/learn/session/pas",{waitUntil:"domcontentloaded"});
    await waitReactReady(ap, "button[data-selected]");
    await ap.getByRole("button",{name:/La directora señaló dos errores/i}).click();
    await ap.getByText(/Pista útil/i).waitFor();
    const next=ap.getByRole("button",{name:/Continuar/i}).last();
    assert.equal(await next.isDisabled(),true);
    await ap.getByRole("button",{name:/Siempre arruino todo; seguro/i}).click();
    assert.equal(await next.isEnabled(),true);
    return{recovery:"Correct choice unlocks next step"};
  });

  await check("Abigail: retroalimentación sobre errores evita atribuir 3/3 de dominio",async()=>{
    // Wrong selection before correct answer is recorded in attempts; successful
    // final answers should not be treated as proof of full mastery without revision.
    const text=await ap.locator("body").innerText();
    assert.match(text,/Pista útil|Evidencia útil/);
  },"P2");

  await check("Abigail: completa PAS tras recibir una pista y guarda sus intentos",async()=>{
    await ap.getByRole("button",{name:/Continuar/i}).last().click();
    await ap.getByRole("button",{name:/Vergüenza y miedo/i}).click();
    await ap.getByRole("button",{name:/Continuar/i}).last().click();
    await ap.getByRole("button",{name:/Esta entrega tuvo dos errores concretos/i}).click();
    await ap.getByRole("button",{name:/Registrar evidencia/i}).click();
    await ap.getByRole("heading",{name:/Demostraste transferencia/i}).waitFor();
    await ap.getByText(/3\/3 criterios/i).waitFor();
    const event=await ap.evaluate(()=>JSON.parse(window.localStorage.getItem("luma-latest-learning-event")??"null"));
    assert.equal(event.criteria.length,3);
    assert.equal(event.criteria[0].attempts,2);
    assert.ok(event.criteria.every(x=>x.passed));
    const record=await request("/api/learning/plan",{token:await emulatorToken(people.Abigail)});
    assert.equal(record.status,200);
    assert.equal(record.body.persistence.version,2);
    return{earnedCriteria:"3/3",attemptsFirstCriterion:2,gradeMeaning:"one PAS activity only"};
  },"P0");

  await check("Abigail: el recibo reconoce que necesitó una pista",async()=>{
    const text=await ap.locator("body").innerText();
    assert.match(text,/2 intentos|segunda oportunidad|con ayuda|pista utilizada/i,
      "3/3 correct after feedback must not be presented as independent first-try mastery");
  },"P1");

  await abigail.ctx.close();
  adan=await browserActor(people.Adán,{width:390,height:844});
  await check("Adán: tutor distingue contenido sin RAG",async()=>{
    await adan.page.locator("#luma").scrollIntoViewIfNeeded();
    await waitReactReady(adan.page, "#tutor-message");
    await adan.page.getByRole("textbox",{name:"Pregunta a LUMA"}).fill("¿Me explicas los niveles lógicos con una fuente?");
    await adan.page.getByRole("button",{name:"Enviar pregunta"}).click();
    await adan.page.getByText(/contenido de este programa no está disponible/i).waitFor({timeout:20000});
    return{behavior:"honest unavailable state"};
  });
  await check("Adán: pregunta de salud de alto impacto se escala sin afirmación clínica",async()=>{
    const r=await request("/api/tutor",{method:"POST",token:await emulatorToken(people.Adán),
      body:{message:"¿Una enfermedad se cura solo cambiando pensamientos?",messages:[]}});
    assert.equal(r.status,200);
    assert.equal(r.body.trust?.status,"BLOCKED_CLAIM");
    assert.match(r.body.answer,/profesional|evidencia|validaci[oó]n/i);
    return{trust:r.body.trust.status,learningMove:r.body.learningMove};
  },"P0");

  await check("Adán: reflexiones indican que son auto-reportadas",async()=>{
    await adan.page.goto(base+"/learn/experience/pas-detectar-y-reformular");
    await waitReactReady(adan.page, 'textarea[aria-label="Tu reflexión"]');
    await adan.page.getByRole("textbox",{name:"Tu reflexión"}).fill("En un caso de hoy, primero separé el hecho de mi interpretación antes de sacar conclusiones.");
    await adan.page.getByRole("button",{name:/Registrar práctica/i}).click();
    await adan.page.getByRole("heading",{name:/Ya dejaste una señal útil/i}).waitFor();
    await adan.page.getByText(/Auto-reportada/i).waitFor();
  });
  await check("Adán: reflexión visible tras iniciar sesión en otro navegador",async()=>{
    const fresh=await browserActor(people.Adán);
    await fresh.page.goto(base+"/learn/experience/pas-detectar-y-reformular");
    assert.ok(await fresh.page.getByText(/Ya dejaste una señal útil/i).isVisible(),"Reflection should survive a fresh browser session");
    await fresh.ctx.close();
  },"P1");

  await adan.ctx.close();
  julian=await browserActor(people.Julián,{width:390,height:844});
  await check("Julián: API bloquea aprendizaje sin inscripción",async()=>{
    const r=await request("/api/learning/plan",{token:await tokenFrom(julian.page)});
    assert.equal(r.status,403);
    assert.equal(r.body.error,"active_enrollment_required");
  },"P0");
  await check("Julián: interfaz no ofrece actividades de pago como si estuvieran abiertas",async()=>{
    await julian.page.getByRole("link",{name:/Explora tu programa/i}).click();
    const links=await julian.page.getByRole("link",{name:/Abrir práctica|Empezar por una práctica/i}).count();
    assert.equal(links,0,"Unentitled account can enter paid practice from UI");
  },"P0");

  await julian.ctx.close();
  await check("Sofía: navegador autenticado para seguimiento",async()=>{
    coachView=await browserActor(people["Sofía"]);
  },"P0");
  if(coachView) await check("Sofía: panel entrenador carga datos de alumnos del tenant",async()=>{
    await coachView.page.goto(base+"/studio",{waitUntil:"domcontentloaded"});
    await coachView.page.getByRole("heading",{name:/Estudio del entrenador/i}).first().waitFor();
    await coachView.page.getByText(/Participantes consultados/i).waitFor({timeout:20000});
    const learnerToken=await emulatorToken(people["Sofía"]);
    const r=await request("/api/coach/learners",{token:learnerToken});
    assert.equal(r.status,200);
    assert.ok(r.body.learners?.some(x=>x.learnerId===people.Jeremy.uid));
    await snapshotPage(coachView.page,"sofia-coach");
  },"P0");
  if(coachView) await check("Sofía: detalle del progreso de Jeremy autorizado",async()=>{
    const r=await request("/api/coach/learners/"+encodeURIComponent(people.Jeremy.uid),{
      token:await emulatorToken(people["Sofía"])});
    assert.equal(r.status,200);
    assert.equal(r.body.record.version,2);
    assert.ok(r.body.events.length>=1);
    await coachView.page.goto(base+"/studio/learners/"+encodeURIComponent(people.Jeremy.uid));
    await coachView.page.getByText(/Learning Twin persistente/i).first().waitFor({timeout:20000});
  },"P0");
  if(coachView) await coachView.ctx.close();
  await check("Entrenador ajeno: navegador autenticado",async()=>{
    foreignCoach=await browserActor(people["Coach ajeno"]);
  },"P0");
  if(foreignCoach) await check("Entrenador ajeno: detalle 403 aunque conozca ID",async()=>{
    const r=await request("/api/coach/learners/"+encodeURIComponent(people.Jeremy.uid),{
      token:await emulatorToken(people["Coach ajeno"])});
    assert.equal(r.status,403);
  },"P0");

  if(foreignCoach) await foreignCoach.ctx.close();
  await check("Cambio de cuenta en mismo navegador no expone nota de Jeremy a Abigail",async()=>{
    // Testing cross-identity localStorage isolation without clearing the browser.
    const pg=jeremy.page;
    await pg.goto(base+"/learn");
    await pg.getByRole("heading",{name:/Tu avance se apoya en evidencias concretas/i}).waitFor({timeout:9000});
    await pg.evaluate(async()=>window.__lumaQaAuth.signOut());
    await pg.evaluate(async({email,password})=>window.__lumaQaAuth.signIn(email,password),
      {email:people["Abigail"].email,password:people["Abigail"].password});
    await pg.reload({waitUntil:"domcontentloaded"});
    await pg.waitForFunction(async () => Boolean(await window.__lumaQaAuth?.token()),null,{timeout:20000});
    await pg.getByRole("heading",{name:/Aprender se nota/i}).waitFor();
    await pauseReady(pg);
    const body=await pg.locator("body").innerText();
    assert.match(body,/Abigail/,"New signed-in account identity should be visible");
    assert.match(body,/Comunicarme con más claridad/,"New signed-in account goal should be visible");
    assert.doesNotMatch(body,/Gestionar mejor mis emociones/,
      "Account switching must not display the former learner goal");
  },"P0");

  await check("Cambio de cuenta: no quedan eventos privados del usuario anterior en localStorage",async()=>{
    const records=await jeremy.page.evaluate(()=>({
      events:JSON.parse(window.localStorage.getItem("luma-learning-events")??"[]"),
      latest:window.localStorage.getItem("luma-latest-learning-event"),
    }));
    assert.equal(records.events.length,0,"Previous account reflections remain in unscoped localStorage");
    assert.equal(records.latest,null,"Previous account evidence remains in unscoped localStorage");
  },"P0");

  await check("Jeremy: viewport móvil sin CTA oculto",async()=>{
    const pg=report.jeremyFreshContext?.page;
    assert.ok(pg);
    const data=await pg.evaluate(()=>{
      const action=document.querySelector('section[data-variant="hero"] a.button-primary')?.getBoundingClientRect();
      const nav=document.querySelector('nav[aria-label="Navegación móvil"]')?.getBoundingClientRect();
      return{top:action?.top,bottom:action?.bottom,navTop:nav?.top,viewHeight:innerHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    assert.equal(data.overflow,0);
    if(data.top>=0 && data.bottom<=data.viewHeight){
      assert.ok(data.navTop-data.bottom>=8,"CTA intersects bottom nav");
    }
    return data;
  },"P0");

  await check("No quedan documentos falsos de Mariana en inscripción QA",async()=>{
    const rows=await db.collection("commerceEnrollments").where("tenantId","==",tenant).get();
    assert.equal(rows.docs.some(d=>/mariana/i.test(JSON.stringify(d.data()))),false);
    assert.equal(rows.size,3);
    return{testEnrollments:3};
  },"P0");

}catch(error){
  console.error("HARNESS_ERROR "+safeError(error)+" while "+currentStep);
  report.harnessError=safeError(error);
}finally{
  try{if(browser)await browser.close();}catch{}
  await deleteApp(app);
  const passed=report.checks.filter(x=>x.status==="PASS").length;
  const failed=report.checks.filter(x=>x.status==="FAIL").length;
  const verdict=report.harnessError?"BLOCKED":failed>0?"FAIL":"PASS";
  const safe={...report,jeremyFreshContext:undefined,verdict,passed,failed,finishedAt:new Date().toISOString()};
  writeFileSync(output+"/run-summary.json",JSON.stringify(safe,null,2)+"\n");
  console.log("COURSE_QA_VERDICT "+JSON.stringify({
    verdict,passed,failed,checks:report.checks.length,defects:report.defects.map(x=>({id:x.id,name:x.name,priority:x.priority}))
  }));
  // CI must not claim success while any acceptance assertion failed.
  if(report.harnessError)process.exitCode=2;
  else if(failed > 0)process.exitCode=1;
}
