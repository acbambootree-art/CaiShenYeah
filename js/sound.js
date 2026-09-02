/**
 * 4D Oracle - Temple Soundscape
 * Fully synthesized with Web Audio: no audio files, no loop seams.
 * - Ambience: low drone + generative pentatonic guzheng plucks + distant bell
 * - Ritual SFX: gong (hall entry), singing bowl (fortune), wood tok (taps),
 *   bamboo rattle (kau chim shake)
 * Browsers only allow audio after a user gesture; arm() must be called from one.
 */

const Sound = (() => {
  'use strict';

  const LS_KEY = 'temple_sound';
  let ctx = null;
  let master = null;
  let ambienceGain = null;
  let ambienceOn = false;
  let pluckTimer = null;
  let bellTimer = null;
  let noiseBuf = null;

  const pref = () => {
    try { return localStorage.getItem(LS_KEY) !== 'off'; } catch (e) { return true; }
  };
  const setPref = (on) => {
    try { localStorage.setItem(LS_KEY, on ? 'on' : 'off'); } catch (e) {}
  };

  let reverb = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = buf;
      // Temple-hall reverb: synthesized stereo impulse, ~3s exponential tail
      const len = ctx.sampleRate * 3;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const cd = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
        }
      }
      reverb = ctx.createConvolver();
      reverb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      reverb.connect(wet);
      wet.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ── Synth primitives ──
  function tone(freq, { gain = 0.1, attack = 0.005, decay = 2, type = 'sine', pan = 0, when = 0, bend = 0, wet = 0 }) {
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    osc.connect(g);
    node.connect(master);
    if (wet && reverb) node.connect(reverb);
    osc.start(t);
    osc.stop(t + attack + decay + 0.1);
  }

  function noiseHit({ gain = 0.08, decay = 0.06, freq = 2500, q = 1.5, when = 0 }) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5, decay + 0.05);
  }

  // Continuous filtered-noise bed: many thin sticks sliding against each
  // other and the cylinder wall. The wander on the filter keeps it woody
  // and alive rather than a static hiss.
  function slide(when, dur, gain) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t);
    bp.frequency.linearRampToValueAtTime(1650, t + dur * 0.4);
    bp.frequency.linearRampToValueAtTime(950, t + dur);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.12);
    g.gain.setValueAtTime(gain, t + dur - 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ── Ritual SFX ──
  function gong() {
    if (!enabled() || !ensureCtx()) return;
    [1, 1.52, 2.08, 2.91, 4.23].forEach((r, i) =>
      tone(82 * r, { gain: 0.2 / (i + 1), attack: 0.015, decay: 3.2 - i * 0.4, bend: -4 * r, wet: 1 }));
    noiseHit({ gain: 0.08, decay: 0.12, freq: 900, q: 0.8 });
  }

  function bowl() {
    if (!enabled() || !ensureCtx()) return;
    [1, 2.72, 5.35].forEach((r, i) =>
      tone(524 * r, { gain: 0.12 / (i + 1) / 1.6, attack: 0.02, decay: 3.6 - i, wet: 1 }));
    noiseHit({ gain: 0.03, decay: 0.05, freq: 3800, q: 2 });
  }

  function tok() {
    if (!enabled() || !ensureCtx()) return;
    tone(820, { gain: 0.1, attack: 0.002, decay: 0.07, bend: -400 });
    noiseHit({ gain: 0.05, decay: 0.03, freq: 2200, q: 1 });
  }

  // One bamboo stick striking another: a low-mid wooden body carries the
  // thunk, a bright tick gives the edge, a pitched knock gives it wood.
  // A narrow band alone reads as hiss and vanishes under the music.
  function clack(when, force) {
    noiseHit({ gain: 0.26 * force, decay: 0.05 + Math.random() * 0.03,
      freq: 380 + Math.random() * 420, q: 0.9, when });
    noiseHit({ gain: 0.12 * force, decay: 0.018,
      freq: 2400 + Math.random() * 1800, q: 1.2, when });
    tone(230 + Math.random() * 220, { gain: 0.15 * force, attack: 0.001,
      decay: 0.07, type: 'triangle', bend: -110, when });
  }

  // Two wooden moon blocks landing on the temple floor: hard double-knock,
  // then each bounces once and settles
  function blocks() {
    if (!enabled() || !ensureCtx()) return;
    duckMusic(1);
    const knock = (when, force) => {
      noiseHit({ gain: 0.3 * force, decay: 0.045, freq: 620 + Math.random() * 250, q: 1.1, when });
      noiseHit({ gain: 0.12 * force, decay: 0.02, freq: 2600 + Math.random() * 900, q: 1.5, when });
      tone(210 + Math.random() * 70, { gain: 0.2 * force, attack: 0.001, decay: 0.09, type: 'triangle', bend: -70, when });
    };
    knock(0, 1);        // first block lands
    knock(0.07, 0.9);   // second lands
    knock(0.17, 0.45);  // first bounces
    knock(0.24, 0.35);  // second bounces
    knock(0.33, 0.15);  // settle
  }

  function rattle() {
    if (!enabled() || !ensureCtx()) return;
    duckMusic(1.6);
    // the shuffle: sticks sliding in the cylinder
    slide(0, 1.25, 0.09);
    // dense papery ticks — thin bamboo jostling, no pitched dice-knock
    const N = 85;
    for (let i = 0; i < N; i++) {
      const p = i / N;
      const env = 0.35 + 0.65 * Math.sin(Math.PI * p);
      noiseHit({
        gain: 0.055 * env * (0.5 + Math.random()),
        decay: 0.008 + Math.random() * 0.016,
        freq: 1500 + Math.random() * 2100,
        q: 2.4,
        when: p * 1.18 + Math.random() * 0.05
      });
    }
    // the hollow cylinder body, knocked softly by the bundle
    for (let i = 0; i < 6; i++) {
      noiseHit({
        gain: 0.09 + Math.random() * 0.05,
        decay: 0.045 + Math.random() * 0.02,
        freq: 290 + Math.random() * 130,
        q: 1.6,
        when: 0.1 + Math.random() * 1.0
      });
    }
  }

  // ── Ambience ──
  const SCALE = [146.8, 164.8, 185.0, 220.0, 246.9, 293.7, 329.6, 370.0, 440.0]; // D gong-scale pentatonic

  function pluck() {
    if (!ambienceOn) return;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)];
    const pan = (Math.random() * 2 - 1) * 0.5;
    // Soft-attack, long-decay, reverb-washed: closer to a hammered chime than a pluck
    tone(f, { gain: 0.028 + Math.random() * 0.016, attack: 0.05, decay: 3.5 + Math.random() * 1.5, pan, wet: 1 });
    tone(f * 2, { gain: 0.008, attack: 0.06, decay: 2, pan, wet: 1 });
    pluckTimer = setTimeout(pluck, 3800 + Math.random() * 5200);
  }

  function distantBell() {
    if (!ambienceOn) return;
    [1, 2.0, 2.94, 5.4].forEach((r, i) =>
      tone(98 * r, { gain: 0.022 / (i + 1), attack: 0.08, decay: 7 - i, pan: 0.3, wet: 1 }));
    bellTimer = setTimeout(distantBell, 26000 + Math.random() * 24000);
  }

  // ── Music track (royalty-free, Pixabay license) with synth fallback ──
  let musicEl = null;
  let musicFade = null;

  function fadeMusic(target, ms, thenPause) {
    clearInterval(musicFade);
    const step = (target - musicEl.volume) / (ms / 60);
    musicFade = setInterval(() => {
      const v = musicEl.volume + step;
      if ((step > 0 && v >= target) || (step < 0 && v <= target)) {
        musicEl.volume = target;
        clearInterval(musicFade);
        if (thenPause) musicEl.pause();
      } else {
        musicEl.volume = v;
      }
    }, 60);
  }

  const MUSIC_VOLUME = 0.18;

  // Drop the music under a ritual sound so the ritual is the thing you hear
  function duckMusic(seconds) {
    if (!musicEl || musicEl === 'failed' || musicEl.paused) return;
    clearInterval(musicFade);
    musicEl.volume = 0.05;
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      if (ambienceOn && musicEl && musicEl !== 'failed') fadeMusic(MUSIC_VOLUME, 900);
    }, seconds * 1000);
  }

  let duckTimer = null;

  function startAmbience() {
    if (!enabled() || !ensureCtx() || ambienceOn) return;
    ambienceOn = true;
    if (!musicEl) {
      musicEl = new Audio('ambience.mp3');
      musicEl.loop = true;
      musicEl.addEventListener('error', () => { musicEl = 'failed'; startSynthAmbience(); });
    }
    if (musicEl === 'failed') { startSynthAmbience(); return; }
    musicEl.volume = 0;
    const p = musicEl.play();
    // A refused or failed track must fall back to the synth, never to silence
    if (p && p.then) p.then(() => fadeMusic(MUSIC_VOLUME, 2500)).catch(() => startSynthAmbience());
    else fadeMusic(MUSIC_VOLUME, 2500);
  }

  function stopAmbience() {
    ambienceOn = false;
    if (musicEl && musicEl !== 'failed') fadeMusic(0, 700, true);
    stopSynthAmbience();
  }

  function startSynthAmbience() {
    if (!ambienceOn) return;
    ambienceGain = ctx.createGain();
    ambienceGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambienceGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);
    ambienceGain.connect(master);
    // Drone: two slow detuned lows breathing under everything
    [55, 55.35, 110.2].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.009 : 0.015;
      osc.connect(lp); lp.connect(g); g.connect(ambienceGain);
      osc.start();
      droneOscs.push(osc);
    });
    pluckTimer = setTimeout(pluck, 800);
    bellTimer = setTimeout(distantBell, 6000);
  }

  const droneOscs = [];

  function stopSynthAmbience() {
    clearTimeout(pluckTimer);
    clearTimeout(bellTimer);
    droneOscs.forEach(o => { try { o.stop(); } catch (e) {} });
    droneOscs.length = 0;
    if (ambienceGain) {
      ambienceGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      const g = ambienceGain;
      setTimeout(() => g.disconnect(), 800);
      ambienceGain = null;
    }
  }

  // ── Public ──
  function enabled() { return pref(); }

  function arm() {
    if (!enabled()) return;
    if (ensureCtx()) startAmbience();
  }

  function toggle() {
    const on = !pref();
    setPref(on);
    if (on) { ensureCtx(); startAmbience(); bowl(); }
    else stopAmbience();
    return on;
  }

  return { arm, toggle, enabled, gong, bowl, tok, rattle, blocks };
})();

// Top-level const does not attach to window: expose explicitly so guards
// like `if (window.Sound)` in other scripts actually pass.
window.Sound = Sound;
