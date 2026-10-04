# 🔮 Aurora Design System & Styleguide

> **Design Direction:** Glassmorphism (Frosted Glass over Luminous Color)
> **Brand Identity:** Calm, Intelligent Analytics & Workspace Dashboard
> **Theme:** `data-theme="aurora"` (dark default) · `data-theme="aurora-light"`
> **Version:** 1.0.0 (October 2026) — companion to the Meridian *Concrete Brutalism* and Kiln *Neo-Brutalism* guides

---

### How Aurora relates to Meridian & Kiln

Aurora keeps the same document skeleton (philosophy → tokens → typography → surfaces → motion → signature components → checklist) and the same tri-font hierarchy idea, but it inverts the surface language entirely. Where brutalism says **"every object declares itself with a border and a hard shadow,"** glassmorphism says **"every object is a pane of frosted glass floating over light."**

| | **Meridian (Concrete)** | **Kiln (Neo-Brutalist)** | **Aurora (Glass)** |
| :--- | :--- | :--- | :--- |
| Mood | Industrial, sober | Loud, playful | Calm, airy, premium |
| Substrate | Gray concrete | Warm paper | Deep gradient mesh with glowing orbs |
| Surfaces | Opaque slabs, 2–3px ink borders | Flat color blocks, 3px ink borders | Translucent panes, 1px light borders |
| Depth | Hard offset shadow | Hard offset shadow | `backdrop-filter` blur + soft diffuse shadow |
| Radius | `0px` | `0px` | `16–28px` |
| Motion | Snap / stepped | Snap / wiggle | Smooth ease-out, slow float, shimmer |
| Color | Safety-signage accents | Flat saturated fills | Luminous gradient accents on a dark base |

---

## 1. Design Philosophy

Aurora is built on the concept of **"Light Through Layers"** — information sits on stacked panes of frosted glass, and the color behind each pane shows through just enough to give every surface a sense of place.

- **Frosted Translucency:** Surfaces are semi-transparent (`rgba` white at 6–16%) with a background blur, so the luminous backdrop bleeds through softly. Nothing is fully opaque except text and controls.
- **Layered Depth:** Hierarchy comes from *stacking order and blur strength*, not from borders or shadows alone. Higher layers are brighter, blurrier, and more elevated.
- **Light Edges:** A 1px, low-alpha white border plus a top-edge highlight simulates light catching the beveled edge of glass.
- **Luminous Backdrop:** A dark gradient mesh with 2–4 large, heavily blurred color orbs sits behind everything. The glass only works if there is something vivid behind it.
- **Gentle Motion:** Transitions are smooth and unhurried (200–400ms, ease-out). Orbs drift slowly; panes lift softly. Motion should feel like light moving, not parts snapping.
- **Typographic Clarity:** Text must remain crisp against blur. A geometric display face for numbers, a neutral humanist sans for UI, and a monospace for data.

---

## 2. Color Palette & Token System

Glass needs **a vivid backdrop and restrained surface tints**. Meaning is carried by *accent glows and gradient strokes*, while panes stay neutral.

### 2.1 CSS Variables (`:root`)

```css
:root, [data-theme="aurora"] {
  /* Backdrop — the scene behind the glass */
  --bg-base:        #0b0d1a;                 /* Deep midnight navy */
  --bg-gradient:    radial-gradient(1200px 800px at 15% 10%, #1d1b4b 0%, transparent 60%),
                    radial-gradient(1000px 700px at 85% 20%, #0f3a4a 0%, transparent 60%),
                    radial-gradient(900px 900px at 50% 100%, #3b1550 0%, transparent 60%),
                    var(--bg-base);

  /* Luminous Orbs — blurred color sources behind panes */
  --orb-violet:     #7c5cff;
  --orb-cyan:       #22d3ee;
  --orb-pink:       #ff5fa2;
  --orb-amber:      #ffb454;

  /* Glass Surfaces — translucent white tints */
  --glass-1:        rgba(255, 255, 255, 0.06);   /* Base pane */
  --glass-2:        rgba(255, 255, 255, 0.10);   /* Raised pane */
  --glass-3:        rgba(255, 255, 255, 0.16);   /* Top layer: modals, popovers */
  --glass-well:     rgba(0, 0, 0, 0.22);         /* Recessed: inputs, logs */

  /* Glass Edges */
  --glass-border:   rgba(255, 255, 255, 0.18);
  --glass-border-strong: rgba(255, 255, 255, 0.32);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.35);   /* Top-edge light catch */

  /* Blur & Saturation */
  --blur-sm:        blur(8px)  saturate(140%);
  --blur-md:        blur(16px) saturate(160%);
  --blur-lg:        blur(28px) saturate(180%);

  /* Shadows — soft, diffuse, colored by depth not by light source */
  --shadow-1:       0 4px 16px rgba(0, 0, 0, 0.25);
  --shadow-2:       0 12px 40px rgba(0, 0, 0, 0.35);
  --shadow-3:       0 24px 80px rgba(0, 0, 0, 0.45);

  /* Text */
  --text-primary:   rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.70);
  --text-muted:     rgba(255, 255, 255, 0.50);

  /* Semantic Accents */
  --accent:         #8b7bff;       /* Primary — violet */
  --accent-2:       #22d3ee;       /* Secondary — cyan */
  --success:        #34e3a0;
  --warning:        #ffc15e;
  --danger:         #ff6b8b;
  --info:           #5ec8ff;

  /* Radius */
  --radius-sm:      12px;
  --radius-md:      20px;
  --radius-lg:      28px;
  --radius-pill:    999px;
}

[data-theme="aurora-light"] {
  --bg-base:        #eef1ff;
  --bg-gradient:    radial-gradient(1200px 800px at 15% 10%, #d9d4ff 0%, transparent 60%),
                    radial-gradient(1000px 700px at 85% 20%, #c9f1ff 0%, transparent 60%),
                    radial-gradient(900px 900px at 50% 100%, #ffd9ec 0%, transparent 60%),
                    var(--bg-base);
  --glass-1:        rgba(255, 255, 255, 0.45);
  --glass-2:        rgba(255, 255, 255, 0.62);
  --glass-3:        rgba(255, 255, 255, 0.78);
  --glass-well:     rgba(20, 20, 60, 0.06);
  --glass-border:   rgba(255, 255, 255, 0.70);
  --glass-border-strong: rgba(255, 255, 255, 0.95);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --shadow-1:       0 4px 16px rgba(60, 60, 120, 0.10);
  --shadow-2:       0 12px 40px rgba(60, 60, 120, 0.16);
  --shadow-3:       0 24px 80px rgba(60, 60, 120, 0.22);
  --text-primary:   #14142b;
  --text-secondary: rgba(20, 20, 43, 0.72);
  --text-muted:     rgba(20, 20, 43, 0.52);
}
```

### 2.2 Color Tokens & Intent

| Token | Value | Role & Visual Intent |
| :--- | :--- | :--- |
| `--bg-base` | `#0b0d1a` | Page foundation. Deep midnight — dark enough that white-tinted glass reads as luminous. |
| `--orb-*` | violet / cyan / pink / amber | Blurred color sources placed *behind* panes. These are what the glass refracts; without them the effect disappears. |
| `--glass-1` | `rgba(255,255,255,0.06)` | Default pane — cards, sidebars, content sections. |
| `--glass-2` | `rgba(255,255,255,0.10)` | Raised pane — hovered cards, active tabs, nested cards. |
| `--glass-3` | `rgba(255,255,255,0.16)` | Top layer — modals, dropdowns, command palette, tooltips. |
| `--glass-well` | `rgba(0,0,0,0.22)` | Recessed areas — inputs, search, code blocks, read-only logs. |
| `--glass-border` | `rgba(255,255,255,0.18)` | The 1px edge of every pane. Never skip it; it defines the glass. |
| `--accent` | `#8b7bff` | Primary action, focus, active nav, key data series. |
| `--success` | `#34e3a0` | Confirmed, healthy, up. |
| `--warning` | `#ffc15e` | Degraded, pending, approaching limit. |
| `--danger` | `#ff6b8b` | Errors, failures, destructive actions. |
| `--info` | `#5ec8ff` | Neutral highlights, tips, links. |

**Accent discipline:** accents appear as **gradient strokes, soft glows, small filled dots, and button fills** — never as large opaque slabs behind text. Large areas of color belong to the backdrop orbs, not to the panes.

---

## 3. Typography System

Three Google Fonts loaded with `display: swap`. Aurora's voice is **geometric, open, and light** — generous spacing, medium weights, minimal uppercase.

```
Sora               Inter               JetBrains Mono
(Geometric Display) (Neutral UI)       (Data & Metrics)
"$48.2K"           "Active Workspaces"  "p95 · 182ms · 99.98%"
```

### 3.1 Font Family Mapping

| Role | Font Family | Variable | Usage |
| :--- | :--- | :--- | :--- |
| **Display** | `Sora` (600 / 700) | `--font-display` | Hero numbers, KPI values, page titles. |
| **UI & Body** | `Inter` (400 / 500 / 600) | `--font-ui` | Body copy, nav, buttons, labels, descriptions. |
| **Data & Code** | `JetBrains Mono` | `--font-mono` | Metrics, IDs, timestamps, logs, code. |

### 3.2 Typography Scale & Utility Classes

```css
/* Hero KPI / Page Title */
.text-display-xl {
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 7vw, 5rem);
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

/* Section Numbers & Subheads */
.text-display-md {
  font-family: var(--font-display);
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* Card & Section Headings */
.text-heading {
  font-family: var(--font-ui);
  font-size: 1.125rem;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.005em;
}

/* Body */
.text-body {
  font-family: var(--font-ui);
  font-size: 0.9375rem;
  line-height: 1.65;
  font-weight: 400;
  color: var(--text-secondary);
  max-width: 66ch;
}

/* Data & Metrics */
.text-data {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.45;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* Captions, Labels, Badges */
.text-micro {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text-muted);
}
```

### 3.3 Gradient Text (signature treatment)
Reserved for **one hero element per view** — a headline or a primary KPI:

```css
.text-gradient {
  background: linear-gradient(120deg, #ffffff 0%, #b8a9ff 45%, #5ee1ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

### 3.4 Legibility on Glass
Text on translucent surfaces is the main risk of this style. Rules:

- Body text is **never lower than `--text-secondary`** (70% white / 72% ink).
- Minimum body size is `0.875rem`; muted captions never smaller than `0.75rem`.
- Add a subtle text shadow only on text placed directly over the orb backdrop: `text-shadow: 0 1px 12px rgba(0,0,0,0.35)`.
- Body text stays left-aligned with `text-wrap: pretty`.

```css
p, .text-body, .card-description {
  text-align: left;
  max-width: 66ch;
  text-wrap: pretty;
}
```

---

## 4. Glass Surface Architecture

Aurora panes are **frosted, edge-lit, and softly lifted**. Every pane combines four ingredients: a translucent tint, a backdrop blur, a light border, and a diffuse shadow. Remove any one and the glass reads as a flat gray box.

### 4.1 Base Glass Panel (`.glass-panel`)
Default container for cards, sidebars, and content sections:
```css
.glass-panel {
  background: var(--glass-1);
  -webkit-backdrop-filter: var(--blur-md);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-highlight), var(--shadow-1);
}
```

### 4.2 Raised Glass Panel (`.glass-panel-raised`)
Hovered cards, active tabs, nested cards — brighter and slightly more blurred:
```css
.glass-panel-raised {
  background: var(--glass-2);
  -webkit-backdrop-filter: var(--blur-md);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-highlight), var(--shadow-2);
}
```

### 4.3 Top-Layer Glass (`.glass-panel-overlay`)
Modals, dropdowns, popovers, command palette. Strongest blur and brightest tint so content beneath recedes:
```css
.glass-panel-overlay {
  background: var(--glass-3);
  -webkit-backdrop-filter: var(--blur-lg);
  backdrop-filter: var(--blur-lg);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-highlight), var(--shadow-3);
}
```

### 4.4 Recessed Well (`.glass-well`)
Inputs, search bars, read-only logs — a *darker* tint with an inset shadow so the area reads as carved into the glass:
```css
.glass-well {
  background: var(--glass-well);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25);
  color: var(--text-primary);
  padding: 10px 14px;
}
.glass-well:focus-within {
  border-color: var(--accent);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 3px rgba(139, 123, 255, 0.35);
}
```

### 4.5 Glass Chip / Badge (`.glass-chip`)
Status tags, filters, and category labels — pill-shaped frosted capsules with an optional accent dot:
```css
.glass-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--glass-1);
  -webkit-backdrop-filter: var(--blur-sm);
  backdrop-filter: var(--blur-sm);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.glass-chip__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}
```

### 4.6 Gradient Border (signature accent)
For a hero card or the active/selected item — a glowing gradient stroke around a glass pane:
```css
.glass-gradient-border {
  position: relative;
  border-radius: var(--radius-md);
}
.glass-gradient-border::before {
  content: "";
  position: absolute; inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(139,123,255,0.9), rgba(34,211,238,0.6), rgba(255,95,162,0.7));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}
```

### 4.7 Backdrop Scene (`.aurora-scene`)
The glass is meaningless without something vivid behind it. Apply to `body` or the app root:
```css
.aurora-scene {
  position: fixed; inset: 0;
  background: var(--bg-gradient);
  overflow: hidden;
  z-index: -1;
}
.aurora-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.55;
  will-change: transform;
}
.aurora-orb--violet { width: 520px; height: 520px; background: var(--orb-violet); top: -120px; left: -80px; }
.aurora-orb--cyan   { width: 460px; height: 460px; background: var(--orb-cyan);   top: 20%;    right: -120px; }
.aurora-orb--pink   { width: 420px; height: 420px; background: var(--orb-pink);   bottom: -140px; left: 30%; }
```

### 4.8 Fallback (no `backdrop-filter`)
Always provide a fallback — an opaque-ish tint so text stays legible:
```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-panel         { background: rgba(28, 30, 55, 0.92); }
  .glass-panel-raised  { background: rgba(38, 40, 68, 0.94); }
  .glass-panel-overlay { background: rgba(46, 48, 80, 0.96); }
}
```

---

## 5. Interaction & Motion System

### 5.1 Card Interaction (`.card-hover`)
Cards **rise gently and brighten** — the pane gets more opaque, the border strengthens, and the shadow deepens. A soft specular sheen can track the cursor:
```css
.card-hover {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.card-hover:hover {
  transform: translateY(-4px);
  background: var(--glass-2);
  border-color: var(--glass-border-strong);
  box-shadow: var(--glass-highlight), var(--shadow-2);
}
.card-hover:active {
  transform: translateY(-1px) scale(0.995);
  box-shadow: var(--glass-highlight), var(--shadow-1);
}
```

#### Cursor Sheen (optional enhancement)
```css
.card-sheen::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 0%),
              rgba(255, 255, 255, 0.14), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.card-sheen:hover::after { opacity: 1; }
/* JS sets --mx / --my from pointermove */
```

### 5.2 Button Hierarchy

#### Secondary Glass Button (`.glass-button`)
```css
.glass-button {
  background: var(--glass-1);
  -webkit-backdrop-filter: var(--blur-sm);
  backdrop-filter: var(--blur-sm);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  box-shadow: var(--glass-highlight);
  color: var(--text-primary);
  padding: 10px 20px;
  font-family: var(--font-ui);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.glass-button:hover  { background: var(--glass-2); border-color: var(--glass-border-strong); }
.glass-button:active { transform: scale(0.97); }
```

#### Primary Accent Button (`.glass-button-primary`)
A luminous gradient fill with a colored glow — the brightest object on the screen:
```css
.glass-button-primary {
  background: linear-gradient(135deg, #8b7bff 0%, #5b8cff 100%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-pill);
  color: #ffffff;
  padding: 10px 22px;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4),
              0 8px 28px rgba(139, 123, 255, 0.45);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}
.glass-button-primary:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5),
              0 12px 36px rgba(139, 123, 255, 0.6);
}
.glass-button-primary:active { transform: scale(0.97); }
```

#### Danger Button (`.glass-button-danger`)
```css
.glass-button-danger {
  background: rgba(255, 107, 139, 0.16);
  border: 1px solid rgba(255, 107, 139, 0.5);
  color: var(--danger);
}
```

#### Disabled
```css
.glass-button:disabled, .glass-button-primary:disabled {
  opacity: 0.4;
  filter: saturate(0.6);
  cursor: not-allowed;
  box-shadow: none;
}
```

#### Focus State (non-negotiable)
```css
.glass-button:focus-visible,
.glass-button-primary:focus-visible,
.card-hover:focus-visible,
a:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 3px;
}
```

### 5.3 Keyframe Animations

#### Orb Drift (`@keyframes orbDrift`)
Backdrop orbs move slowly so the glass subtly refracts shifting color:
```css
@keyframes orbDrift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  50%  { transform: translate3d(40px, -30px, 0) scale(1.08); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
}
.aurora-orb--violet { animation: orbDrift 28s ease-in-out infinite; }
.aurora-orb--cyan   { animation: orbDrift 34s ease-in-out infinite reverse; }
.aurora-orb--pink   { animation: orbDrift 40s ease-in-out infinite; }
```

#### Glass Rise (`@keyframes glassRise`)
Panels fade and float in with staggered delays:
```css
@keyframes glassRise {
  from { opacity: 0; transform: translateY(16px) scale(0.98); filter: blur(6px); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0); }
}
.glass-enter { animation: glassRise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
```

#### Shimmer (`@keyframes shimmer`)
Loading skeletons — a soft light sweep across a glass placeholder:
```css
@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}
.glass-skeleton {
  background: linear-gradient(90deg, var(--glass-1) 25%, var(--glass-2) 50%, var(--glass-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
  border-radius: var(--radius-sm);
}
```

#### Status Pulse (`@keyframes statusPulse`)
Live indicators breathe with a soft glow:
```css
@keyframes statusPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 227, 160, 0.55); }
  50%      { box-shadow: 0 0 0 8px rgba(52, 227, 160, 0); }
}
.glass-chip__dot--live { animation: statusPulse 2s ease-out infinite; }
```

#### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .aurora-orb, .glass-enter, .glass-skeleton, .glass-chip__dot--live { animation: none; }
  .card-hover, .glass-button, .glass-button-primary { transition: none; }
}
```

---

## 6. Signature Visual Components

### 6.1 KPI Stat Card (`StatCard`)
- **Visual:** `.glass-panel` with a small `.glass-chip` label, a `.text-display-md` value (the one gradient-text candidate), and a delta indicator (`▲ 12.4%` in `--success` or `▼` in `--danger`) in mono.
- **Sparkline:** a 1.5px gradient stroke (violet → cyan) with a soft area fill fading to transparent; no gridlines, no axis chrome.
- **Hover:** `.card-hover` with cursor sheen.

### 6.2 Glass Sidebar Navigation (`SideNav`)
- **Visual:** full-height `.glass-panel` with `--radius-lg` on the inner edge, floating 16px from the viewport edges (not flush).
- **Items:** icon + label. The active item gets `--glass-2`, a `--glass-border-strong` border, and a 3px gradient bar on its leading edge.
- **Collapsed state:** icons only, tooltips rendered as `.glass-panel-overlay`.

### 6.3 Analytics Chart Panel (`ChartPanel`)
- **Visual:** a `.glass-panel` containing a chart with **no opaque background**, so orbs show through.
- **Series:** gradient strokes (violet, cyan, pink) 2px thick with round caps; area fills at 15–25% opacity fading to 0.
- **Grid & axes:** hairlines at `rgba(255,255,255,0.08)`, labels in `.text-micro`.
- **Tooltip:** `.glass-panel-overlay` with a small colored dot per series.

### 6.4 Activity Feed (`ActivityLog`)
- **Style:** a `.glass-well` list of rows separated by 1px `rgba(255,255,255,0.08)` dividers; timestamps in mono `--text-muted`, actor names in `--text-primary`.
- **Status:** each row has a small `.glass-chip__dot` (success / warning / danger).
- **Header:** `.text-heading` with a live chip (`● LIVE`, pulsing).

### 6.5 Command Palette / Modal (`CommandPalette`)
- **Visual:** centered `.glass-panel-overlay` over a scrim of `rgba(5,6,16,0.55)` with its own `blur(6px)` — layered glass over blurred content.
- **Input:** large `.glass-well` with no visible border until focus; results grouped with `.text-micro` headings.
- **Motion:** `glassRise` in, 150ms fade out.

### 6.6 Toast Notifications (`Toast`)
- **Visual:** `.glass-panel-raised` capsule in the top-right with a colored 3px left accent and a matching glow (`box-shadow: 0 0 24px <accent at 30%>`).
- **Motion:** slides in from the right with `cubic-bezier(0.22, 1, 0.36, 1)`, auto-dismisses after 5s with a thin progress hairline.

### 6.7 Toggle / Switch (`GlassSwitch`)
- **Track:** `.glass-well` pill, 44×24px. **Thumb:** frosted white circle with a soft shadow.
- **On state:** track fills with the accent gradient and a faint glow; thumb slides 20px over 200ms.

---

## 7. Layout, Spacing & Z-Index

```css
:root {
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px;  --space-7: 48px; --space-8: 72px;

  --z-scene:   -1;    /* backdrop & orbs */
  --z-base:     0;
  --z-raised:  10;
  --z-nav:     50;
  --z-overlay: 100;
  --z-toast:   200;
}
```

- **Float, don't butt:** panes sit with 16–24px gaps between them and from viewport edges — the backdrop must be visible between panes.
- **Padding:** panel interiors use `--space-5` (24px); compact panels `--space-4`.
- **Layer order:** a pane should never sit on more than **three stacked glass layers** (base → raised → overlay). Beyond that, blur compounds into mud.
- **Grid:** 12-column, `gap: var(--space-5)`, max content width `1280px`.

---

## 8. Accessibility & Performance Rules

### Accessibility
- **Contrast:** verify text contrast against the *worst-case* backdrop color (the brightest orb behind the pane), not the average. Target WCAG AA (≥ 4.5:1 body, ≥ 3:1 large text and UI borders).
- **Borders aren't optional:** the 1px glass border is what makes panes perceivable for low-vision users — never remove it, and strengthen it under `prefers-contrast: more`.
- **State ≠ color alone:** pair every success/warning/danger color with an icon or text label.
- **Focus:** 2px cyan outline with 3px offset on all interactive elements.
- **Reduced transparency:** honor the OS setting by swapping to near-opaque panes.

```css
@media (prefers-contrast: more) {
  :root { --glass-border: rgba(255,255,255,0.55); --glass-1: rgba(255,255,255,0.14); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-panel         { background: rgba(28, 30, 55, 0.96); backdrop-filter: none; }
  .glass-panel-raised  { background: rgba(38, 40, 68, 0.98); backdrop-filter: none; }
  .glass-panel-overlay { background: rgba(46, 48, 80, 0.98); backdrop-filter: none; }
}
```

### Performance
- `backdrop-filter` is GPU-expensive. Limit to **≤ 6 simultaneous blurred panes** in the viewport; use `--blur-sm` for small elements.
- Never animate `backdrop-filter` values or `filter: blur()` on large elements — animate `transform` and `opacity` only.
- Promote orbs with `will-change: transform` and keep them to 3–4 total.
- Avoid nesting a blurred pane inside another blurred pane — nest with a plain tint instead (`--glass-2` without `backdrop-filter`).
- On low-power devices (`(prefers-reduced-motion)` or detected low frame rate), pause orb drift and drop to `--blur-sm`.

---

## 9. Component Usage Checklist

When building new components for Aurora:

- [ ] Use `font-display` (`Sora`) for KPIs and page titles, `font-ui` (`Inter`) for everything else, `font-mono` (`JetBrains Mono`) for metrics, IDs, and timestamps.
- [ ] Every pane has **all four glass ingredients**: translucent tint + `backdrop-filter` + 1px light border + soft shadow (plus the top-edge highlight).
- [ ] Choose the pane tier by elevation: `.glass-panel` (base) → `.glass-panel-raised` (hover/active) → `.glass-panel-overlay` (modals, menus).
- [ ] Use `.glass-well` for every input, search, and read-only log.
- [ ] Place a vivid `.aurora-scene` behind the app — glass over a flat color looks like a gray box.
- [ ] Use radius tokens only: `12px` small, `20px` default, `28px` overlays, `999px` for chips and buttons.
- [ ] Use accents as gradient strokes, glows, dots, and button fills — **never as large opaque backgrounds**.
- [ ] Limit gradient text to **one element per view**.
- [ ] Keep motion smooth and 200–400ms (`cubic-bezier(0.22, 1, 0.36, 1)`); animate only `transform` and `opacity`.
- [ ] Keep body text at `--text-secondary` or brighter, and test against the brightest orb behind it.
- [ ] Provide the `@supports not (backdrop-filter)` fallback for every glass class.
- [ ] Honor `prefers-reduced-motion`, `prefers-contrast`, and `prefers-reduced-transparency`.
- [ ] Leave visible backdrop between panes — never stack more than three glass layers.

### Don'ts
- ✗ No opaque slabs, thick borders, or hard offset shadows (that's Meridian/Kiln territory).
- ✗ No blur on text itself, and no low-contrast gray text on frosted surfaces.
- ✗ No heavy drop shadows with black alpha > 0.5 — glass should feel light.
- ✗ No more than one gradient-text element or one primary gradient button per viewport.
- ✗ No glass over a plain white or flat-gray background — the effect needs color behind it.
- ✗ No animating `backdrop-filter`.
