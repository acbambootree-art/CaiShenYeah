/**
 * 4D Oracle - 3D ritual moments (lazy-loaded ES module)
 * - initJiao: two lacquered moon blocks tumbling with hand-rolled physics.
 *   The outcome is decided by the temple's odds; the tumble is steered to
 *   land that way, and an impact callback fires on the first floor hit so
 *   the clatter sound lands exactly with the wood.
 * - goldRain: a shower of gold coins for the three 上上 sticks.
 */

import * as THREE from 'three';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

// A moon block: crescent footprint, domed back, flatter face
function blockGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.0, 0);
  s.bezierCurveTo(-0.9, 0.9, 0.9, 0.9, 1.0, 0);
  s.bezierCurveTo(0.55, 0.3, -0.55, 0.3, -1.0, 0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.3, bevelEnabled: true, bevelThickness: 0.18,
    bevelSize: 0.12, bevelSegments: 5, curveSegments: 28
  });
  geo.center();
  // Asymmetry: swell one side into a dome, flatten the other
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setZ(i, z > 0 ? z * 1.9 : z * 0.55);
  }
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2); // dome up = round face up
  return geo;
}

function lacquer() {
  return new THREE.MeshStandardMaterial({
    color: 0x8e2617, roughness: 0.32, metalness: 0.08,
    emissive: 0x2a0a04, emissiveIntensity: 0.4
  });
}

export function initJiao(container) {
  try {
    const W = Math.min(container.clientWidth || 520, 560);
    const H = 260;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    if (!renderer.getContext()) return null;
    renderer.setPixelRatio(DPR());
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 50);
    camera.position.set(0, 3.4, 4.8);
    camera.lookAt(0, 0.15, 0);

    scene.add(new THREE.AmbientLight(0xffe8c0, 0.75));
    const key = new THREE.DirectionalLight(0xfff2d0, 1.6);
    key.position.set(2, 6, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    scene.add(key);
    const warm = new THREE.PointLight(0xd4af37, 12, 12);
    warm.position.set(-2.5, 2, 2);
    scene.add(warm);

    // Invisible floor that catches shadows, so the blocks sit on the page
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.45 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const geo = blockGeometry();
    const blocks = [-0.95, 0.95].map(x => {
      const m = new THREE.Mesh(geo, lacquer());
      m.castShadow = true;
      m.position.set(x, 0.34, 0);
      scene.add(m);
      return m;
    });

    const REST_Y = 0.34;
    const yawQ = (yaw) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    const faceQ = (face, yaw) => {
      const q = yawQ(yaw);
      if (face === 'flat') {
        q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)));
      }
      return q;
    };

    renderer.render(scene, camera);
    let raf = null;

    function throwBlocks(faces, onImpact) {
      return new Promise((resolve) => {
        cancelAnimationFrame(raf);
        const DURATION = 1.7;
        const bodies = blocks.map((mesh, i) => ({
          mesh,
          x: i === 0 ? -0.95 : 0.95,
          y: 2.6 + Math.random() * 0.5,
          vy: 0.8 + Math.random() * 0.6,
          vx: (Math.random() - 0.5) * 0.8,
          spin: new THREE.Vector3(6 + Math.random() * 7, (Math.random() - 0.5) * 5, 5 + Math.random() * 6),
          bounces: 0,
          settled: false,
          target: faceQ(i === 0 ? faces.a : faces.b, (Math.random() - 0.5) * 0.9),
          q: new THREE.Quaternion().random()
        }));
        let impactFired = false;
        const clock = new THREE.Clock();
        let elapsed = 0;

        function step() {
          const dt = Math.min(clock.getDelta(), 0.033);
          elapsed += dt;
          let allSettled = true;
          for (const b of bodies) {
            if (b.settled) continue;
            allSettled = false;
            b.vy -= 13 * dt;
            b.y += b.vy * dt;
            b.x += b.vx * dt;
            const rot = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(b.spin.x * dt, b.spin.y * dt, b.spin.z * dt));
            b.q.premultiply(rot);
            if (b.y <= REST_Y && b.vy < 0) {
              b.y = REST_Y;
              b.bounces++;
              if (!impactFired) { impactFired = true; if (onImpact) onImpact(); }
              if (b.bounces >= 3 || Math.abs(b.vy) < 1.2) {
                b.settled = true;
                b.q.copy(b.target);
              } else {
                b.vy = -b.vy * 0.42;
                b.vx *= 0.6;
                b.spin.multiplyScalar(0.55);
                // steer the remaining tumble toward the decided face
                b.q.slerp(b.target, 0.35);
              }
            }
            b.mesh.position.set(b.x, b.y, 0);
            b.mesh.quaternion.copy(b.q);
          }
          renderer.render(scene, camera);
          if (allSettled || elapsed > DURATION + 1.5) {
            for (const b of bodies) {
              b.mesh.position.set(b.x, REST_Y, 0);
              b.mesh.quaternion.copy(b.target);
            }
            renderer.render(scene, camera);
            resolve();
            return;
          }
          raf = requestAnimationFrame(step);
        }
        step();
      });
    }

    return { throwBlocks };
  } catch (e) {
    return null;
  }
}

// ── Gold rain for the 上上 sticks ──
export function goldRain() {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    if (!renderer.getContext()) return;
    renderer.setPixelRatio(DPR());
    renderer.setSize(window.innerWidth, window.innerHeight);
    const el = renderer.domElement;
    el.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;transition:opacity 1.2s;';
    document.body.appendChild(el);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(0, 0, 12);

    scene.add(new THREE.AmbientLight(0xfff0c8, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 8);
    scene.add(key);

    const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 22);
    const ingotGeo = new THREE.SphereGeometry(0.4, 12, 8);
    ingotGeo.scale(1.3, 0.55, 0.8);
    const gold = new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.95, roughness: 0.22 });

    const span = 14;
    const coins = Array.from({ length: 90 }, (_, i) => {
      const m = new THREE.Mesh(i % 5 === 0 ? ingotGeo : coinGeo, gold);
      m.position.set((Math.random() - 0.5) * span, 8 + Math.random() * 16, (Math.random() - 0.5) * 4);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      m.userData = {
        vy: 4.5 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 0.7,
        rx: (Math.random() - 0.5) * 8,
        rz: (Math.random() - 0.5) * 8
      };
      scene.add(m);
      return m;
    });

    const clock = new THREE.Clock();
    let elapsed = 0;
    let raf;
    let done = false;
    const dispose = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      coinGeo.dispose(); ingotGeo.dispose(); gold.dispose();
      el.remove();
    };
    // Failsafe: whatever happens to the loop, the overlay never outlives this
    setTimeout(dispose, 8000);
    function step() {
      const dt = Math.min(clock.getDelta(), 0.033);
      elapsed += dt;
      for (const c of coins) {
        c.position.y -= c.userData.vy * dt;
        c.position.x += c.userData.drift * dt;
        c.rotation.x += c.userData.rx * dt;
        c.rotation.z += c.userData.rz * dt;
        if (c.position.y < -9) c.position.y = 9 + Math.random() * 4;
      }
      renderer.render(scene, camera);
      if (elapsed > 3.6) {
        el.style.opacity = '0';
        setTimeout(dispose, 1300);
        return;
      }
      raf = requestAnimationFrame(step);
    }
    step();
  } catch (e) { /* celebration is optional */ }
}

// ── Light shaft through the opening gate ──
// Sits just beneath the gate overlay: as the doors part, a golden beam
// blazes through the widening seam with dust motes hanging in it, then
// settles and fades as your eyes adjust to the courtyard.
export function gateShaft() {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    if (!renderer.getContext()) return;
    renderer.setPixelRatio(DPR());
    renderer.setSize(window.innerWidth, window.innerHeight);
    const el = renderer.domElement;
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
    document.body.appendChild(el);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uFade: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uOpen, uFade;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            float x = vUv.x - 0.5;
            // the slit: blinding when barely open, soft when wide
            float width = 0.015 + uOpen * 0.30;
            float slit = exp(-abs(x) / width);
            // god-ray bands fanning from the seam
            float ang = atan(x * 3.0, 0.35 + (1.0 - vUv.y));
            float bands = 0.65 + 0.35 * sin(ang * 22.0 + uTime * 0.6 + hash(floor(ang * 22.0)) * 6.283);
            float vert = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.05, 0.55, vUv.y);
            float glow = slit * bands * (1.6 - uOpen * 0.9);
            vec3 col = vec3(1.0, 0.86, 0.55) * glow + vec3(1.0, 0.95, 0.8) * slit * slit * 0.9;
            gl_FragColor = vec4(col, clamp(glow, 0.0, 1.0) * uFade * (0.35 + vert * 0.65));
          }`
      })
    );
    scene.add(beam);

    // Dust hanging in the light
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (Math.random() < 0.7 ? 0.35 : 1.2);
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = 0;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffe8b0, size: 3, sizeAttenuation: false,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(dust);

    const clock = new THREE.Clock();
    let raf, done = false;
    const dispose = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      beam.geometry.dispose(); beam.material.dispose();
      dustGeo.dispose(); dust.material.dispose();
      renderer.dispose();
      el.remove();
    };
    setTimeout(dispose, 6000); // failsafe: the beam never outstays the arrival

    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function step() {
      const t = clock.getElapsedTime();
      beam.material.uniforms.uTime.value = t;
      beam.material.uniforms.uOpen.value = ease(Math.min(1, t / 1.7));
      const fade = 1 - Math.max(0, Math.min(1, (t - 2.3) / 1.1));
      beam.material.uniforms.uFade.value = fade;
      dust.material.opacity = Math.min(1, t / 0.8) * fade * 0.8;
      const p = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        p.array[i * 3 + 1] += 0.0007 + (i % 5) * 0.0002;
        if (p.array[i * 3 + 1] > 1) p.array[i * 3 + 1] = -1;
      }
      p.needsUpdate = true;
      renderer.render(scene, camera);
      if (t > 3.5) { dispose(); return; }
      raf = requestAnimationFrame(step);
    }
    step();
  } catch (e) { /* the arrival is fine without the beam */ }
}

// ── Volumetric courtyard smoke ──
// Layered soft sprite plumes that rise, curl and billow like real incense.
export function courtyardSmoke(container) {
  try {
    const W = container.clientWidth || window.innerWidth;
    const H = container.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    if (!renderer.getContext()) return null;
    renderer.setPixelRatio(Math.min(DPR(), 1.5));
    renderer.setSize(W, H);
    const el = renderer.domElement;
    el.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';
    container.appendChild(el);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 40);
    camera.position.set(0, 0, 12);
    const worldH = 2 * 12 * Math.tan(THREE.MathUtils.degToRad(25));
    const worldW = worldH * (W / H);

    // A soft, cloudy smoke puff texture with real internal structure
    const tc = document.createElement('canvas');
    tc.width = tc.height = 256;
    const g = tc.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const bx = 60 + Math.random() * 136, by = 60 + Math.random() * 136, r = 34 + Math.random() * 54;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, r);
      grad.addColorStop(0, 'rgba(228,222,208,0.30)');
      grad.addColorStop(0.5, 'rgba(220,214,198,0.12)');
      grad.addColorStop(1, 'rgba(220,214,198,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(tc);

    const N = 30;
    const plumes = [];
    const spawn = (p, fresh) => {
      // three rising columns, like joss sticks in an urn
      const col = Math.floor(Math.random() * 3);
      p.baseX = (-0.42 + col * 0.42) * worldW + (Math.random() - 0.5) * 0.12 * worldW;
      p.x = p.baseX;
      p.y = fresh ? (-worldH / 2 + Math.random() * worldH) : -worldH / 2 - 1;
      p.vy = 1.3 + Math.random() * 1.4;              // perceptible rise
      p.curlAmp = 0.5 + Math.random() * 1.1;          // sideways billow
      p.curlFreq = 0.5 + Math.random() * 0.8;
      p.phase = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.6;
      p.life = 0;
      p.scale = 2.4 + Math.random() * 2.6;
      p.z = (Math.random() - 0.5) * 4;
      p.sprite.position.set(p.x, p.y, p.z);
    };
    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.NormalBlending
      });
      mat.rotation = Math.random() * Math.PI * 2;
      const sprite = new THREE.Sprite(mat);
      const p = { sprite };
      spawn(p, true);
      sprite.scale.setScalar(p.scale);
      scene.add(sprite);
      plumes.push(p);
    }

    const clock = new THREE.Clock();
    let running = false, raf = null;
    function step() {
      if (!running) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      for (const p of plumes) {
        p.life += dt;
        p.y += p.vy * dt;
        // curl: sideways sway that widens as it rises, plus slow growth
        p.x = p.baseX + Math.sin(p.life * p.curlFreq + p.phase) * p.curlAmp * (0.4 + p.life * 0.16);
        p.scale += dt * 0.5;
        p.sprite.material.rotation += p.rotSpeed * dt;
        const risen = (p.y + worldH / 2) / worldH;   // 0 at bottom, 1 at top
        const fadeIn = Math.min(1, p.life / 1.6);
        const fadeOut = Math.max(0, 1 - risen * 1.15);
        p.sprite.material.opacity = fadeIn * fadeOut * 0.5;
        p.sprite.position.set(p.x, p.y, p.z);
        p.sprite.scale.setScalar(p.scale);
        if (p.y > worldH / 2 + 2) spawn(p, false);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(step);
    }

    return {
      start() { if (running) return; running = true; clock.getDelta(); step(); },
      stop() { running = false; cancelAnimationFrame(raf); },
      dispose() { this.stop(); tex.dispose(); renderer.dispose(); el.remove(); }
    };
  } catch (e) { return null; }
}
