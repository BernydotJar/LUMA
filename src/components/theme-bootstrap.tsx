import { defaultLumaTheme, LUMA_THEME_STORAGE_KEY } from "@/lib/themes";

const bootstrap = `(() => {
  const allowed = new Set(["se", "light", "dark"]);
  const requested = new URLSearchParams(window.location.search).get("theme");
  let theme = "${defaultLumaTheme}";
  if (requested && allowed.has(requested)) {
    theme = requested;
  } else {
    try {
      const stored = localStorage.getItem("${LUMA_THEME_STORAGE_KEY}");
      if (stored && allowed.has(stored)) theme = stored;
    } catch {}
  }
  document.documentElement.dataset.theme = theme;
})();`;

export function ThemeBootstrap() {
  return <script id="luma-theme-bootstrap" dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
