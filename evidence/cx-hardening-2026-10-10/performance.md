# Performance baseline — local production build /learn

**Commit:** 7d1715c5171c464d6a4abd786f912418817fb397. **Tool:** Lighthouse 12.8.2, Chromium 151 headless, localhost Next production build 127.0.0.1:3124. **Runs:** 3 mobile simulated throttling; 3 desktop preset. No network/CDN realism and NO field p75 or INP evidence.

| Iteration | Mobile perf score | Mobile LCP | Mobile CLS | Mobile TBT | Desktop LCP |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 97 | 2644ms | 0.027 | 18.5ms | 591ms |
| 2 | 96 | 2690ms | 0.027 | 40.5ms | 593ms |
| 3 | 96 | 2678ms | 0.027 | 34.0ms | 609ms |

**Mobile simulation:** Chromium default Lighthouse sim RTT 150ms / throughput 1638.4Kbps / CPU 4x slowdown, viewport 412x823, DPR 1.75. Desktop performance/a11y 100/100 in lab; mobile a11y 100/100, but Lighthouse automated a11y is not full WCAG.

**Threshold:** LCP <=2500ms -> FAIL all three mobile lab samples. CLS <=0.1 -> PASS lab. INP <=200ms -> NOT MEASURED. These are laboratory single-run distributions, not field percentiles. Separate unthrottled PerformanceObserver values (mobile LCP 96–144ms; desktop ~140–156ms) are recorded only for tracing, **not** product SLO acceptance.

**LCP target element:** editorial hero heading #learner-home-title. Lighthouse mobile opportunity suggestions (not actual guaranteed savings): eliminate render-blocking resources ~342ms and unused JS ~85,676 bytes / 300ms, defer offscreen images ~11,352 bytes. Confirm waterfall/chunks before optimizing. Cosmetic motion suppression should not justify disabling useful interaction feedback.

**Reproduce:** CHROME_PATH=/usr/bin/chromium npx lighthouse@12.8.2 http://127.0.0.1:3124/learn --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --only-categories=performance,accessibility --output=json --quiet (desktop adds --preset=desktop). Exact environment and metrics in lighthouse-summary.json, raw first mobile and desktop reports included. No after-fix measurement exists (QA only).
