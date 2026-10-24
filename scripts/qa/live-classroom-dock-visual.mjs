/** CSS-level screenshot QA only. Does NOT simulate a LiveKit connection or count as product E2E. */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cssRoot = '.next/static/css';
const bundle = readdirSync(cssRoot)
  .map((f) => readFileSync(join(cssRoot, f), 'utf8'))
  .find((css) => css.includes('rgba(225,137,196') && css.includes('.lk-control-bar'));
if (!bundle) throw new Error('Compiled classroom Liquid Glass CSS not found: run npm run build first');
const className = bundle.match(/\.([\w-]*live-classroom_video__\w+)\s+\.lk-control-bar/)?.[1];
if (!className) throw new Error('CSS module class for video not found');
const handDockClass = bundle.match(/\.([\w-]*live-classroom_handDock__\w+)/)?.[1];
const handButtonClass = bundle.match(/\.([\w-]*live-classroom_handButton__\w+)/)?.[1];
if (!handDockClass || !handButtonClass) throw new Error('Compiled learner hand button styles missing');
mkdirSync('evidence/live-classroom-acceptance', { recursive:true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless:true, args:['--no-sandbox'] });
const cases = [
 { name:'desktop', width:1440, height:900 },
 { name:'mobile', width:375, height:812 },
];
let fail = false;
const output = [];
try {
 for (const view of cases) {
  const page = await browser.newPage({ viewport: {width:view.width,height:view.height}, deviceScaleFactor:1 });
  await page.setContent(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;background:#110f17;color:white;font:14px system-ui}
    .scene{max-width:1270px;padding:16px;margin:auto}.stage{height:${view.name==='mobile' ? 590 : 720}px;background:#1d1b21;border-radius:24px;padding:12px;display:flex}
    .tile{display:flex;align-items:center;justify-content:center;height:100%;min-height:0;background:radial-gradient(ellipse at 40% 20%,#525164,#22242d 69%);border-radius:14px;overflow:hidden}
    .tile span{padding:12px;color:#eee;text-align:center;display:inline-block;background:rgba(0,0,0,.22);border-radius:8px}
    .lk-grid-layout-wrapper{width:100%;display:block}.lk-control-bar button{font:inherit;cursor:pointer}.controls-title{font:600 13px system-ui;letter-spacing:.12em;margin:6px 0 14px;color:#e5c2d7}
    </style><style>${bundle}</style></head><body><main class="scene"><div class="controls-title">LUMA · Aula en vivo · Diseño de controles (fixture CSS)</div>
    <section class="stage"><div class="${className}"><div class="lk-video-conference"><div class="lk-video-conference-inner">
    <div class="lk-grid-layout-wrapper"><div class="tile"><span>Vista de participantes · representación visual, no sesión real</span></div></div>
    <div class="lk-control-bar" aria-label="Barra de controles inferior">
    <button type="button" class="lk-button" aria-label="Activar micrófono">Mic</button>
    <button type="button" class="lk-button" aria-label="Activar cámara">Cámara</button>
    <button type="button" class="lk-button" aria-label="Compartir pantalla">Compartir</button>
    <button type="button" class="lk-button" aria-label="Abrir chat">Chat</button>
    <button type="button" class="lk-button" aria-label="Configurar dispositivos">Ajustes</button>
    <button type="button" class="lk-button lk-disconnect-button" aria-label="Salir de la clase">Salir</button>
    </div></div></div><div class="${handDockClass}" data-testid="hand-dock">
    <button type="button" class="${handButtonClass}" aria-pressed="false" aria-label="Levantar la mano">✋ Levantar la mano</button>
    </div></div></section></main></body></html>`, {waitUntil:'load'});
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.lk-video-conference');
    const bar = document.querySelector('.lk-control-bar');
    const barRect = bar.getBoundingClientRect();
    const room = stage.getBoundingClientRect();
    const handDock = document.querySelector('[data-testid="hand-dock"]');
    const handButton = handDock.querySelector('button');
    const handRect = handButton.getBoundingClientRect();
    const buttons = [...bar.querySelectorAll('button')].map(b=>({ label:b.getAttribute('aria-label'),width:Math.round(b.getBoundingClientRect().width),height:Math.round(b.getBoundingClientRect().height) }));
    const style = getComputedStyle(bar);
    const row = document.querySelector('.tile').getBoundingClientRect();
    const within = barRect.left>=room.left-1 && barRect.right<=room.right+1 && barRect.bottom<=room.bottom+1 && barRect.bottom >= room.bottom-45;
    const tilesClear= row.bottom + 2 < barRect.top;
    const handAccessible = handButton.getAttribute('aria-label') === 'Levantar la mano' &&
      handButton.getAttribute('aria-pressed') === 'false' && handRect.width>=44 && handRect.height>=44 &&
      handRect.left>=room.left-1 && handRect.right<=room.right+1 && handRect.bottom+6<=barRect.top;
    return { within, tilesClear, handAccessible, minHitTarget:buttons.every(b=>b.width>=44 && b.height>=44), pageOverflow:document.documentElement.scrollWidth > innerWidth+1, blur:style.backdropFilter, background:style.backgroundColor, buttons, barBottom:Math.round(room.bottom-barRect.bottom), handGap:Math.round(barRect.top-handRect.bottom), handTop:Math.round(handRect.top), barTop:Math.round(barRect.top), stageBottom:Math.round(room.bottom) };
  });
  result.name=view.name;
  result.pass=result.within&&result.tilesClear&&result.handAccessible&&result.minHitTarget&&!result.pageOverflow&&result.blur.includes('blur');
  fail||=!result.pass;
  output.push(result);
  await page.screenshot({path:`evidence/live-classroom-acceptance/dock-${view.name}-css-fixture.png`,fullPage:true});
  await page.close();
 }
} finally { await browser.close(); }
writeFileSync('evidence/live-classroom-acceptance/dock-visual-qa.json',JSON.stringify({kind:'CSS-only visual fixture; NOT live-provider E2E',cases:output},null,2)+'\n');
console.log(JSON.stringify(output,null,2));
if(fail)process.exitCode=1;
