# DESIGN.md — CaiShenYeah

Documented from css/style.css (the live system). Vanilla CSS custom properties, no build.

## Color
Lacquer-black ground with committed gold. Red and blue as semantic accents only.
- --black #0a0a0a (page) · --black-light #141414 (alt sections) · --black-card #1c1c1c
- --gold #d4af37 (primary) · --gold-light #f0d060 · --gold-dark #a88a2a · --gold-pale #fff8e1
- --red #ff4444 (hot/win) · --blue #4488ff (cold) · --green #44ff88 (pass/auspicious)
- --white #f5f5f5 · --white-muted #a0a0a0
Strategy: Committed gold on black. Temple-red (#8b1a1a family) reserved for ritual
objects (kau chim cup). Never #000/#fff.

## Typography
- --font-display: 'Playfair Display', Georgia, serif — headings, fortune titles, CJK display
- --font-body: 'Inter', -apple-system, sans-serif — body
- --font-mono: 'JetBrains Mono', monospace — 4D numbers, always letter-spaced
Numbers are the icons of this site: large mono, wide tracking, gold.

## Components
- .card: #1c1c1c, 12px radius, gold-tinted shadow (--shadow, --shadow-gold)
- .badge (-hot/-cold/-model): small pills for verdicts
- .number-pill: 4D numbers as pills
- .temple-btn: gold gradient pill button; -small variant
- .dream-chip: outlined pill chips, gold on hover/active
- .fortune-card / .fortune-number-block: ritual result surfaces, dashed gold border
- .temple-honesty: small muted honesty line, top-bordered

## Motion
- kauchim-shake (ritual), ember-glow + smoke-rise (incense), animate-in reveals.
- Ease-out only. Ritual objects may animate; data surfaces stay still.

## Layout
- .container max-width, .section vertical rhythm, alternating --black/--black-light bands.
- Section headers: .section-title (display serif, gold) + .section-subtitle (muted).
