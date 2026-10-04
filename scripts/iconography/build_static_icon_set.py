from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "iconography"

THEMES = {
    "se": {
        "label": "Seres de Excelencia",
        "bg": "#F7FBFE",
        "surface": "#FFFFFF",
        "ink": "#333333",
        "primary": "#00A2F1",
        "secondary": "#FF438C",
        "deep": "#993366",
        "support": "#2BB3B1",
    },
    "light": {
        "label": "Liquid Light",
        "bg": "#F5F5F7",
        "surface": "#FFFFFF",
        "ink": "#1D1D1F",
        "primary": "#0A84FF",
        "secondary": "#7B5CFF",
        "deep": "#1B3A8C",
        "support": "#2BB3B1",
    },
    "dark": {
        "label": "Nocturne Intelligence",
        "bg": "#24181A",
        "surface": "#342124",
        "ink": "#F7EDD8",
        "primary": "#EFC86A",
        "secondary": "#D97B4B",
        "deep": "#5B3037",
        "support": "#9DAC78",
    },
}

ICONS = {
    "practice": {
        "label": "Practice",
        "metaphor": "Refractive prism",
        "concept": "P.A.S. / reframing",
    },
    "progress": {
        "label": "Progress",
        "metaphor": "Orbital field",
        "concept": "Demonstrated capability",
    },
    "coach-insight": {
        "label": "Coach Insight",
        "metaphor": "Architectural strata",
        "concept": "Logical levels / intervention",
    },
    "human-intervention": {
        "label": "Human Intervention",
        "metaphor": "Bridge / threshold",
        "concept": "Evidence connected to human context",
    },
    "voice": {
        "label": "Voice Practice",
        "metaphor": "Resonance field",
        "concept": "Speaking as learning modality",
    },
    "video": {
        "label": "Video Learning",
        "metaphor": "Editorial frame",
        "concept": "Source segment / chapter evidence",
    },
}


def defs(theme: dict[str, str], key: str) -> str:
    return f"""
    <defs>
      <linearGradient id="g-{key}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="{theme['primary']}"/>
        <stop offset="0.62" stop-color="{theme['secondary']}"/>
        <stop offset="1" stop-color="{theme['deep']}"/>
      </linearGradient>
      <linearGradient id="glass-{key}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.78"/>
        <stop offset="0.45" stop-color="{theme['surface']}" stop-opacity="0.34"/>
        <stop offset="1" stop-color="{theme['primary']}" stop-opacity="0.14"/>
      </linearGradient>
      <radialGradient id="orb-{key}" cx="32%" cy="24%" r="78%">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.92"/>
        <stop offset="0.16" stop-color="{theme['primary']}"/>
        <stop offset="0.62" stop-color="{theme['secondary']}"/>
        <stop offset="1" stop-color="{theme['deep']}"/>
      </radialGradient>
      <filter id="shadow-{key}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="{theme['deep']}" flood-opacity="0.18"/>
      </filter>
      <filter id="blur-{key}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="9"/>
      </filter>
    </defs>
    """


def shell(theme: dict[str, str], key: str, content: str) -> str:
    dark = theme["bg"] == "#24181A"
    rim = "#FFF5DF" if dark else "#FFFFFF"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
  <title id="title">{ICONS[key]['label']} — {theme['label']}</title>
  <desc id="desc">Premium abstract icon: {ICONS[key]['metaphor']}.</desc>
  {defs(theme, key)}
  <rect width="256" height="256" rx="64" fill="{theme['bg']}"/>
  <circle cx="206" cy="42" r="78" fill="{theme['secondary']}" opacity="0.10" filter="url(#blur-{key})"/>
  <circle cx="42" cy="216" r="72" fill="{theme['primary']}" opacity="0.10" filter="url(#blur-{key})"/>
  <rect x="20" y="20" width="216" height="216" rx="52" fill="url(#glass-{key})" stroke="{rim}" stroke-opacity="0.58"/>
  {content}
</svg>'''


def icon_content(key: str, theme: dict[str, str]) -> str:
    p, s, d, support = theme["primary"], theme["secondary"], theme["deep"], theme["support"]
    if key == "practice":
        return f'''
  <g filter="url(#shadow-practice)">
    <path d="M128 58 187 166H69Z" fill="url(#g-practice)" stroke="#FFF" stroke-opacity=".54" stroke-width="2"/>
    <path d="m57 123 66 7" stroke="{p}" stroke-width="6" stroke-linecap="round" opacity=".72"/>
    <path d="m133 131 66-28" stroke="{support}" stroke-width="5" stroke-linecap="round" opacity=".78"/>
    <path d="m133 135 69 14" stroke="{s}" stroke-width="5" stroke-linecap="round" opacity=".74"/>
    <path d="m115 90 22 78" stroke="#FFF" stroke-opacity=".30" stroke-width="3"/>
  </g>'''
    if key == "progress":
        return f'''
  <g filter="url(#shadow-progress)">
    <circle cx="128" cy="128" r="47" fill="url(#orb-progress)"/>
    <ellipse cx="128" cy="128" rx="82" ry="31" fill="none" stroke="{d}" stroke-opacity=".34" stroke-width="3" transform="rotate(-13 128 128)"/>
    <ellipse cx="128" cy="128" rx="78" ry="28" fill="none" stroke="{support}" stroke-opacity=".50" stroke-width="3" transform="rotate(58 128 128)"/>
    <circle cx="194" cy="91" r="9" fill="{s}"/>
    <circle cx="69" cy="158" r="7" fill="{support}"/>
    <path d="M87 137c15 22 38 33 69 26" fill="none" stroke="#FFF" stroke-opacity=".42" stroke-width="4" stroke-linecap="round"/>
  </g>'''
    if key == "coach-insight":
        return f'''
  <g filter="url(#shadow-coach-insight)">
    <path d="m66 162 65 33 62-33-65-30Z" fill="{d}" opacity=".86" stroke="#FFF" stroke-opacity=".20"/>
    <path d="m59 132 69 34 70-34-70-32Z" fill="{support}" opacity=".90" stroke="#FFF" stroke-opacity=".28"/>
    <path d="m70 101 58 29 58-29-58-27Z" fill="url(#g-coach-insight)" stroke="#FFF" stroke-opacity=".40"/>
    <circle cx="128" cy="101" r="9" fill="#FFF" fill-opacity=".70"/>
    <path d="M128 110v54" stroke="#FFF" stroke-opacity=".36" stroke-width="3" stroke-dasharray="5 7"/>
  </g>'''
    if key == "human-intervention":
        return f'''
  <g filter="url(#shadow-human-intervention)">
    <rect x="55" y="139" width="36" height="58" rx="14" fill="{d}"/>
    <rect x="165" y="139" width="36" height="58" rx="14" fill="{d}"/>
    <path d="M70 146c12-50 104-50 116 0" fill="none" stroke="url(#g-human-intervention)" stroke-width="22" stroke-linecap="round"/>
    <path d="M79 145c14-35 84-35 98 0" fill="none" stroke="#FFF" stroke-opacity=".28" stroke-width="3"/>
    <circle cx="72" cy="112" r="12" fill="{support}"/>
    <circle cx="184" cy="112" r="12" fill="{s}"/>
  </g>'''
    if key == "voice":
        bars = [22, 38, 58, 84, 104, 70, 42, 28]
        xs = [62 + i * 18 for i in range(len(bars))]
        rects = "".join(
            f'<rect x="{x}" y="{128-h/2:.1f}" width="9" height="{h}" rx="4.5" fill="{p if i < 4 else s}" opacity="{0.55 + i*0.04:.2f}"/>'
            for i, (x, h) in enumerate(zip(xs, bars))
        )
        return f'''
  <g filter="url(#shadow-voice)">
    <rect x="45" y="66" width="166" height="124" rx="45" fill="{theme['surface']}" fill-opacity=".28" stroke="#FFF" stroke-opacity=".32"/>
    {rects}
    <circle cx="128" cy="128" r="61" fill="none" stroke="{support}" stroke-opacity=".24" stroke-width="2"/>
  </g>'''
    if key == "video":
        return f'''
  <g filter="url(#shadow-video)">
    <rect x="51" y="66" width="154" height="112" rx="26" fill="{d}" stroke="#FFF" stroke-opacity=".26"/>
    <rect x="59" y="74" width="138" height="84" rx="19" fill="url(#g-video)" opacity=".88"/>
    <path d="m119 99 35 22-35 22Z" fill="#FFF" fill-opacity=".90"/>
    <rect x="59" y="165" width="138" height="5" rx="2.5" fill="{theme['surface']}" fill-opacity=".35"/>
    <rect x="59" y="165" width="79" height="5" rx="2.5" fill="{support}"/>
    <circle cx="138" cy="167.5" r="7" fill="{s}"/>
    <path d="M78 185h100" stroke="{theme['ink']}" stroke-opacity=".42" stroke-width="3" stroke-linecap="round" stroke-dasharray="18 8"/>
  </g>'''
    raise KeyError(key)


def main() -> None:
    manifest: dict[str, object] = {
        "schemaVersion": "luma.iconography.v1",
        "generatedBy": "scripts/iconography/build_static_icon_set.py",
        "themes": {},
        "icons": ICONS,
    }
    for theme_id, theme in THEMES.items():
        theme_dir = OUT / theme_id
        theme_dir.mkdir(parents=True, exist_ok=True)
        files: list[str] = []
        for key in ICONS:
            svg = shell(theme, key, icon_content(key, theme))
            output = theme_dir / f"{key}.svg"
            output.write_text(svg, encoding="utf-8")
            files.append(f"/iconography/{theme_id}/{key}.svg")
        manifest["themes"][theme_id] = {
            "label": theme["label"],
            "palette": {k: v for k, v in theme.items() if k not in {"label"}},
            "files": files,
        }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
