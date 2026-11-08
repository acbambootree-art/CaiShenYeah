// Toy characters for code-made videos. makeCharacter({ outfit: 'executive' }) etc.
import * as THREE from 'three';

// ---------- helpers ----------
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });

export function mesh(geo, m, cast = true) {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = cast; o.receiveShadow = true;
  return o;
}

// Box with rounded edges: extrude a rounded rect and let the bevel round the depth.
export function rbox(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2);
  const iw = w - 2 * r, ih = h - 2 * r, rc = Math.max(0.0005, Math.min(0.02, iw * 0.45, ih * 0.45));
  const s = new THREE.Shape(), x = -iw / 2, y = -ih / 2;
  s.moveTo(x + rc, y);
  s.lineTo(x + iw - rc, y); s.quadraticCurveTo(x + iw, y, x + iw, y + rc);
  s.lineTo(x + iw, y + ih - rc); s.quadraticCurveTo(x + iw, y + ih, x + iw - rc, y + ih);
  s.lineTo(x + rc, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - rc);
  s.lineTo(x, y + rc); s.quadraticCurveTo(x, y, x + rc, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, d - 2 * r), bevelEnabled: true,
    bevelSize: r, bevelThickness: r, bevelSegments: 5, curveSegments: 6,
  });
  g.center(); g.computeVertexNormals();
  return g;
}
export const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 8, 16);

export function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}

// Flat outline (x,y pairs) extruded thin. Sits on a surface whose front is at z.
function patch(points, m, z, depth = 0.03) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  const o = mesh(g, m, false); o.position.z = z - depth + 0.008;
  return o;
}
const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const ring = (r, tube) => { const g = new THREE.TorusGeometry(r, tube, 10, 28); g.rotateX(Math.PI / 2); return g; };

// ---------- fabrics ----------
const PATTERNS = {
  floral: (base, a, b) => (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (const [x, y, col, r] of [[30, 34, a, 13], [92, 90, b, 11], [96, 22, a, 9], [26, 102, b, 9], [62, 62, a, 7]]) {
      g.fillStyle = col;
      for (let i = 0; i < 5; i++) { const t = i * 1.2566; g.beginPath(); g.arc(x + Math.cos(t) * r * 0.8, y + Math.sin(t) * r * 0.8, r * 0.6, 0, 7); g.fill(); }
      g.fillStyle = '#f3d36b'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
    }
  },
  pinstripe: (base, a) => (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.fillStyle = a; for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 1.5, s);
  },
};
// one material for the torso (UVs in metres) and one for sleeves/legs (UVs 0..1)
function fabric(color, pattern, o = {}) {
  if (!pattern) { const m = mat(color, { roughness: 0.85, ...o }); return { body: m, limb: m }; }
  const [name, ...cols] = pattern;
  const draw = PATTERNS[name]('#' + color.toString(16).padStart(6, '0'), ...cols);
  return {
    body: mat(0xffffff, { map: canvasTex(128, draw, 7), roughness: 0.85, ...o }),
    limb: mat(0xffffff, { map: canvasTex(128, draw, 2.5), roughness: 0.85, ...o }),
  };
}

// ---------- wardrobe ----------
// top/bottom colours, sleeve + leg cut, shoe type, then role details.
export const OUTFITS = {
  executive: {
    top: 0x232a3a, topMat: { roughness: 0.55 }, pattern: ['pinstripe', '#3a4256'],
    sleeves: 'long', bottom: 0x232a3a, bottoms: 'long', shoes: 'leather', shoeColor: 0x15100d,
    suit: { shirt: 0xf5f5f2, tie: 0x7a1d2e, pocketSquare: 0xf5f5f2 }, watch: 0xc9ccd1, cuffs: 0xf5f5f2,
  },
  uncle: { // kopitiam uncle: singlet, berms, Japanese slippers
    top: 0xf3f1ea, sleeves: 'none', singlet: true,
    bottom: 0xa8986f, bottoms: 'shorts', shoes: 'slipper', shoeColor: 0x2f5fb8,
  },
  auntie: {
    top: 0x1f6f6a, pattern: ['floral', '#f08aa8', '#fbe9ef'], sleeves: 'short',
    bottom: 0x23222a, bottoms: 'long', shoes: 'slipper', shoeColor: 0x8a5a3a, bangle: 0x5fbf8a,
  },
  hawker: {
    top: 0xf5f4ef, sleeves: 'short', bottom: 0x3a3a3c, bottoms: 'shorts', shoes: 'slipper', shoeColor: 0xe8e8e8,
    apron: 0x2c3e66, towel: true,
  },
  nurse: {
    top: 0x7fb6d4, sleeves: 'short', vneck: true, bottom: 0x7fb6d4, bottoms: 'long',
    shoes: 'sneaker', shoeColor: 0xf4f4f4, lanyard: 0x1d3f72, penPocket: true, watch: 0xf4f4f4,
  },
  rider: { // delivery rider: hi-vis jacket, open-face helmet
    top: 0xe8651c, sleeves: 'long', bottom: 0x1e1e22, bottoms: 'long', shoes: 'sneaker', shoeColor: 0x2a2a2e,
    reflective: 0xd9dee2, highCollar: true, zip: true, hat: 'helmet', hatColor: 0xe8651c,
  },
  guard: { // condo security
    top: 0xf2f2ee, sleeves: 'short', bottom: 0x1d2742, bottoms: 'long', shoes: 'leather', shoeColor: 0x111111,
    epaulettes: 0x1d2742, badge: 0xd4a73a, belt: 0x141414, hat: 'peaked', hatColor: 0x1d2742, shirtCollar: 0xf2f2ee,
  },
  casual: {
    top: 0x2f8f5e, sleeves: 'short', polo: true, bottom: 0x34507a, bottoms: 'long', shoes: 'sneaker', shoeColor: 0xf4f4f4,
  },
};

// ---------- the reusable toy character ----------
// Origin = hip centre. Face looks down +z. Character's left is +x.
export function makeCharacter({
  skin = 0xf0bf96, hair = 0x1b1410, hairStyle = 'short', belly = 0, smile = false, glasses = false,
  outfit = 'casual',
}) {
  const O = typeof outfit === 'string' ? OUTFITS[outfit] : outfit;
  const SK = mat(skin, { roughness: 0.55 }), TOP = fabric(O.top, O.pattern, O.topMat);
  const BOT = fabric(O.bottom, null, O.topMat), HA = mat(hair, { roughness: 0.7 });
  const INK = mat(0x111111, { roughness: 0.4 });
  const root = new THREE.Group();

  const D = 0.3 + belly, tz = belly * 0.4, tf = tz + D / 2; // torso depth / centre z / front z
  const torso = mesh(rbox(0.48, 0.52, D, 0.08), TOP.body);
  torso.position.set(0, 0.28, tz); root.add(torso);
  const neck = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 16), SK);
  neck.position.y = 0.57; root.add(neck);

  // head
  const head = new THREE.Group(); head.position.y = 0.6; root.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.27, 48, 32), SK);
  skull.scale.set(1, 1.04, 0.96); skull.position.y = 0.24; head.add(skull);
  const face = new THREE.Group(); face.position.y = 0.24; head.add(face);
  const eyes = [-1, 1].map(s => {
    const e = mesh(new THREE.SphereGeometry(0.03, 16, 12), INK, false);
    e.position.set(s * 0.095, 0.02, 0.248); e.scale.z = 0.5; face.add(e); return e;
  });
  const brows = [-1, 1].map(s => {
    const b = mesh(capsule(0.013, 0.07), mat(hair), false);
    b.rotation.z = Math.PI / 2; b.position.set(s * 0.1, 0.1, 0.24); face.add(b); return b;
  });
  let mouth;
  if (smile) { mouth = mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16, Math.PI), INK, false); mouth.rotation.z = Math.PI; }
  else { mouth = mesh(capsule(0.01, 0.05), INK, false); mouth.rotation.z = Math.PI / 2; }
  mouth.position.set(0, -0.09, 0.248); face.add(mouth);
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.SphereGeometry(0.05, 16, 12), SK);
    ear.position.set(s * 0.265, 0.0, 0); ear.scale.set(0.5, 1, 0.8); face.add(ear);
  });
  if (glasses) {
    const FR = mat(0x1a1a1a, { roughness: 0.3 });
    [-1, 1].forEach(s => { const g = mesh(new THREE.TorusGeometry(0.048, 0.007, 8, 24), FR, false); g.position.set(s * 0.095, 0.02, 0.268); face.add(g); });
    const br = mesh(capsule(0.006, 0.05), FR, false); br.rotation.z = Math.PI / 2; br.position.set(0, 0.03, 0.27); face.add(br);
  }

  // hair (a hat replaces it)
  if (O.hat) {
    const HM = mat(O.hatColor, { roughness: 0.45 });
    if (O.hat === 'helmet') {
      const shell = mesh(new THREE.SphereGeometry(0.305, 40, 20, 0, Math.PI * 2, 0, 1.45), HM);
      shell.position.y = 0.25; shell.rotation.x = -0.25; head.add(shell);
      const peak = mesh(rbox(0.3, 0.025, 0.12, 0.01), mat(0x222222)); peak.position.set(0, 0.42, 0.25); peak.rotation.x = 0.25; head.add(peak);
    } else { // peaked uniform cap
      const crown = mesh(new THREE.CylinderGeometry(0.29, 0.26, 0.14, 32), HM); crown.position.y = 0.5; head.add(crown);
      const band = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.04, 32), mat(0x111111, { roughness: 0.3 })); band.position.y = 0.45; head.add(band);
      const brim = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.018, 24, 1, false, -Math.PI / 2, Math.PI), mat(0x111111, { roughness: 0.25 }));
      brim.position.set(0, 0.43, 0.2); brim.rotation.x = 0.18; head.add(brim);
      const cb = mesh(rbox(0.06, 0.06, 0.02, 0.008), mat(0xd4a73a, { metalness: 0.5, roughness: 0.3 }), false); cb.position.set(0, 0.5, 0.29); head.add(cb);
    }
  } else if (hairStyle === 'perm') {
    const curl = new THREE.SphereGeometry(0.075, 16, 12);
    for (let r = 0; r < 6; r++) {
      const phi = 0.15 + r * 0.36, n = Math.max(1, Math.round(Math.sin(phi) * 16));
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2 + r * 0.4;
        const x = Math.sin(phi) * Math.sin(th), y = Math.cos(phi), z = Math.sin(phi) * Math.cos(th);
        if (z > 0.15 && y < 0.62) continue; // keep the face clear
        const c = mesh(curl, HA); c.position.set(x * 0.28, 0.26 + y * 0.29, z * 0.27 - 0.01); head.add(c);
      }
    }
  } else {
    const cap = mesh(new THREE.SphereGeometry(0.285, 48, 24, 0, Math.PI * 2, 0, hairStyle === 'side' ? 1.25 : 1.1), HA);
    cap.position.y = 0.25; cap.rotation.x = -0.35; head.add(cap);
    if (hairStyle === 'side') {
      const fringe = mesh(rbox(0.36, 0.08, 0.1, 0.035), HA);
      fringe.position.set(-0.03, 0.47, 0.18); fringe.rotation.set(0.5, 0, -0.18); head.add(fringe);
    }
  }

  // arms
  const arm = s => {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.315, 0.47, 0); root.add(shoulder);
    const upper = mesh(capsule(0.082, 0.15), O.sleeves === 'none' ? SK : TOP.limb); upper.position.y = -0.14; shoulder.add(upper);
    if (O.sleeves === 'short') { // sleeve hem
      const hem = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), TOP.limb); hem.position.y = -0.17; shoulder.add(hem);
      const lower = mesh(capsule(0.078, 0.06), SK); lower.position.y = -0.22; shoulder.add(lower);
    }
    const elbow = new THREE.Group(); elbow.position.y = -0.27; shoulder.add(elbow);
    const fore = mesh(capsule(0.074, 0.13), O.sleeves === 'long' ? TOP.limb : SK); fore.position.y = -0.12; elbow.add(fore);
    elbow.add(mesh(new THREE.SphereGeometry(0.078, 20, 14), O.sleeves === 'long' ? TOP.limb : SK));
    const hand = mesh(new THREE.SphereGeometry(0.078, 20, 14), SK); hand.position.y = -0.27; hand.scale.set(1, 1.1, 0.85); elbow.add(hand);
    return { shoulder, elbow, hand };
  };
  const armL = arm(1), armR = arm(-1);

  // legs
  const leg = s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.12, 0.04, 0); root.add(hip);
    const shorts = O.bottoms === 'shorts';
    const thigh = mesh(capsule(shorts ? 0.122 : 0.112, 0.22), BOT.limb); thigh.position.y = -0.2; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee);
    const shin = mesh(capsule(shorts ? 0.085 : 0.102, 0.24), shorts ? SK : BOT.limb); shin.position.y = -0.18; knee.add(shin);
    knee.add(mesh(new THREE.SphereGeometry(shorts ? 0.088 : 0.106, 20, 14), shorts ? SK : BOT.limb));
    knee.add(makeShoe(O.shoes, O.shoeColor, SK));
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  addDetails(O, { root, tf, SK, TOP, armL, armR });

  const brow0 = brows.map(b => b.position.y);
  return {
    root, head, eyes, brows, armL, armR, legL, legR,
    sit() { for (const l of [legL, legR]) { l.hip.rotation.x = -Math.PI / 2; l.knee.rotation.x = Math.PI / 2; } },
    blink(open) { eyes.forEach(e => (e.scale.y = open)); },
    browLift(k, tilt = 0) { brows.forEach((b, i) => { b.position.y = brow0[i] + k * 0.03; b.rotation.z = Math.PI / 2 + (i ? -1 : 1) * tilt; }); },
  };
}

function makeShoe(type, color, SK) {
  const g = new THREE.Group(); g.position.set(0, -0.4, 0.05);
  if (type === 'leather') { // polished, slightly long toe, welt sole
    const up = mesh(rbox(0.16, 0.09, 0.3, 0.042), mat(color, { roughness: 0.18, metalness: 0.15 })); up.position.z = 0.01; g.add(up);
    const sole = mesh(rbox(0.165, 0.022, 0.31, 0.008), mat(0x0b0807, { roughness: 0.6 })); sole.position.set(0, -0.045, 0.01); g.add(sole);
  } else if (type === 'sneaker') {
    g.add(mesh(rbox(0.17, 0.1, 0.27, 0.045), mat(color, { roughness: 0.7 })));
    const sole = mesh(rbox(0.178, 0.035, 0.285, 0.012), mat(0xdedad2, { roughness: 0.8 })); sole.position.y = -0.04; g.add(sole);
    const swoosh = mesh(rbox(0.18, 0.018, 0.12, 0.006), mat(0x9a9a9a)); swoosh.position.set(0, 0.0, 0.02); g.add(swoosh);
  } else { // slipper: bare foot on a flat sole with a strap
    const foot = mesh(rbox(0.14, 0.07, 0.24, 0.035), SK); foot.position.y = 0.0; g.add(foot);
    const sole = mesh(rbox(0.17, 0.025, 0.28, 0.01), mat(0xf2f2f2, { roughness: 0.8 })); sole.position.y = -0.045; g.add(sole);
    const strap = mesh(rbox(0.155, 0.03, 0.05, 0.012), mat(color, { roughness: 0.6 })); strap.position.set(0, 0.025, 0.05); g.add(strap);
    const edge = mesh(rbox(0.172, 0.008, 0.282, 0.003), mat(color)); edge.position.y = -0.03; g.add(edge);
  }
  g.traverse(o => o.isMesh && (o.castShadow = true));
  return g;
}

// role-specific details layered onto the body
function addDetails(O, { root, tf, SK, TOP, armL, armR }) {
  const add = o => (root.add(o), o);
  const darker = c => new THREE.Color(c).multiplyScalar(0.72).getHex();

  if (O.suit) {
    const S = O.suit, SH = mat(S.shirt, { roughness: 0.6 });
    add(patch([[-0.08, 0.545], [0.08, 0.545], [0, 0.29]], SH, tf));
    const collar = add(mesh(new THREE.CylinderGeometry(0.088, 0.092, 0.05, 20), SH)); collar.position.y = 0.55;
    const TIE = mat(S.tie, { roughness: 0.45 });
    const knot = add(mesh(rbox(0.05, 0.045, 0.03, 0.012), TIE)); knot.position.set(0, 0.515, tf + 0.005);
    add(patch([[-0.022, 0.495], [0.022, 0.495], [0.034, 0.34], [0, 0.31], [-0.034, 0.34]], TIE, tf + 0.004));
    const LAP = mat(darker(O.top), { roughness: 0.5 });
    const lap = [[0.08, 0.548], [0.16, 0.53], [0.135, 0.45], [0.165, 0.43], [0.01, 0.28]];
    add(patch(lap, LAP, tf + 0.007)); add(patch(mirror(lap), LAP, tf + 0.007));
    const BTN = mat(0x111111, { roughness: 0.3 });
    for (const y of [0.24, 0.15]) { const b = add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12), BTN, false)); b.rotation.x = Math.PI / 2; b.position.set(0, y, tf + 0.006); }
    const welt = add(mesh(rbox(0.08, 0.012, 0.012, 0.004), LAP, false)); welt.position.set(0.14, 0.38, tf);
    if (S.pocketSquare) add(patch([[0.11, 0.385], [0.17, 0.385], [0.15, 0.415], [0.135, 0.4], [0.12, 0.42]], mat(S.pocketSquare), tf + 0.004));
  }
  if (O.cuffs) for (const a of [armL, armR]) {
    const c = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20), mat(O.cuffs, { roughness: 0.6 })); c.position.y = -0.235; a.elbow.add(c);
  }
  if (O.watch) {
    const w = mesh(ring(0.068, 0.013), mat(0x222222, { roughness: 0.4 }), false); w.position.y = -0.2; armL.elbow.add(w);
    const f = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 20), mat(O.watch, { metalness: 0.7, roughness: 0.25 }), false);
    f.position.set(0.0, -0.2, 0.072); f.rotation.x = Math.PI / 2; armL.elbow.add(f);
  }
  if (O.bangle) {
    const b = mesh(ring(0.072, 0.014), mat(O.bangle, { roughness: 0.15, transparent: true, opacity: 0.9 }), false); b.position.y = -0.21; armL.elbow.add(b);
  }
  if (O.singlet) { // scoop neck + bare shoulders
    add(patch([[-0.12, 0.548], [0.12, 0.548], [0.09, 0.45], [0, 0.41], [-0.09, 0.45]], SK, tf - 0.004));
  }
  if (O.vneck) add(patch([[-0.075, 0.548], [0.075, 0.548], [0, 0.43]], SK, tf - 0.004));
  if (O.polo) {
    const C = mat(darker(O.top), { roughness: 0.8 });
    const col = add(mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24), C)); col.rotation.x = Math.PI / 2; col.position.y = 0.545;
    add(patch([[-0.022, 0.54], [0.022, 0.54], [0.022, 0.42], [-0.022, 0.42]], C, tf));
    for (const y of [0.505, 0.455]) { const b = add(mesh(new THREE.SphereGeometry(0.008, 8, 6), mat(0xf4f4f4), false)); b.position.set(0, y, tf + 0.006); }
  }
  if (O.shirtCollar) {
    const C = mat(O.shirtCollar, { roughness: 0.6 });
    add(patch([[-0.09, 0.55], [-0.01, 0.5], [-0.06, 0.47]], C, tf + 0.004)); add(patch([[0.09, 0.55], [0.06, 0.47], [0.01, 0.5]], C, tf + 0.004));
    const pl = mat(darker(O.top)); add(patch([[-0.006, 0.5], [0.006, 0.5], [0.006, 0.05], [-0.006, 0.05]], pl, tf));
  }
  if (O.epaulettes) for (const s of [-1, 1]) {
    const e = add(mesh(rbox(0.07, 0.02, 0.16, 0.008), mat(O.epaulettes, { roughness: 0.5 }))); e.position.set(s * 0.21, 0.545, 0);
  }
  if (O.badge) { const b = add(mesh(rbox(0.05, 0.06, 0.012, 0.006), mat(O.badge, { metalness: 0.5, roughness: 0.3 }), false)); b.position.set(0.12, 0.4, tf + 0.003); }
  if (O.belt) {
    const b = add(mesh(rbox(0.49, 0.045, 0.31, 0.015), mat(O.belt, { roughness: 0.35 }))); b.position.set(0, 0.05, 0);
    const bk = add(mesh(rbox(0.05, 0.04, 0.01, 0.004), mat(0xc9ccd1, { metalness: 0.7, roughness: 0.25 }), false)); bk.position.set(0, 0.05, 0.16);
  }
  if (O.apron) {
    const A = mat(O.apron, { roughness: 0.85 });
    add(patch([[-0.17, 0.5], [0.17, 0.5], [0.2, -0.32], [-0.2, -0.32]], A, tf + 0.004));
    add(patch([[-0.1, 0.0], [0.1, 0.0], [0.1, -0.12], [-0.1, -0.12]], mat(darker(O.apron)), tf + 0.012));
    for (const s of [-1, 1]) { const st = add(mesh(capsule(0.012, 0.08), A, false)); st.position.set(s * 0.12, 0.535, tf - 0.03); st.rotation.z = s * 0.6; }
  }
  if (O.towel) { // the "Good Morning" towel over the right shoulder
    const T = mat(0xf7f5ee, { roughness: 0.95 });
    const top = add(mesh(rbox(0.12, 0.035, 0.32, 0.014), T)); top.position.set(-0.15, 0.555, 0);
    const flap = add(mesh(rbox(0.12, 0.22, 0.03, 0.012), T)); flap.position.set(-0.15, 0.45, tf + 0.012);
    const stripe = add(mesh(rbox(0.122, 0.025, 0.032, 0.006), mat(0xc0392b), false)); stripe.position.set(-0.15, 0.38, tf + 0.013);
  }
  if (O.lanyard) {
    const L = mat(O.lanyard, { roughness: 0.6 });
    add(patch([[0.06, 0.548], [0.085, 0.548], [0.015, 0.3], [-0.01, 0.3]], L, tf + 0.002));
    add(patch(mirror([[0.06, 0.548], [0.085, 0.548], [0.015, 0.3], [-0.01, 0.3]]), L, tf + 0.002));
    const card = add(mesh(rbox(0.1, 0.13, 0.012, 0.008), mat(0xffffff, { roughness: 0.4 }), false)); card.position.set(0, 0.23, tf + 0.006);
    const photo = add(mesh(new THREE.BoxGeometry(0.035, 0.045, 0.004), mat(0x9ab0c4), false)); photo.position.set(-0.025, 0.24, tf + 0.013);
    const strip = add(mesh(new THREE.BoxGeometry(0.1, 0.022, 0.004), L, false)); strip.position.set(0, 0.285, tf + 0.013);
  }
  if (O.penPocket) {
    add(patch([[0.09, 0.42], [0.18, 0.42], [0.18, 0.33], [0.09, 0.33]], mat(darker(O.top)), tf + 0.002));
    const pen = add(mesh(capsule(0.009, 0.06), mat(0x1d3f72, { roughness: 0.3 }), false)); pen.position.set(0.15, 0.43, tf + 0.014);
  }
  if (O.reflective) {
    const R = mat(O.reflective, { roughness: 0.25, metalness: 0.4, emissive: 0x333333 });
    add(patch([[-0.24, 0.3], [0.24, 0.3], [0.24, 0.26], [-0.24, 0.26]], R, tf + 0.004));
    const back = add(mesh(rbox(0.49, 0.04, 0.31, 0.015), R)); back.position.y = 0.28;
    for (const a of [armL, armR]) { const b = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 20), R); b.position.y = -0.17; a.shoulder.add(b); }
  }
  if (O.highCollar) { const c = add(mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.08, 20), TOP.body)); c.position.y = 0.56; }
  if (O.zip) add(patch([[-0.008, 0.55], [0.008, 0.55], [0.008, 0.03], [-0.008, 0.03]], mat(0x222222, { roughness: 0.3 }), tf + 0.003));
}
