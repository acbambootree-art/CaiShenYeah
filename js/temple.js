/**
 * 4D Oracle - Digital Temple
 * Kau Chim (求签) fortune sticks + Dream Number Dictionary (解梦).
 * All numbers are derived deterministically (same ask, same day -> same number)
 * and every number has the identical 1-in-10,000 chance. Ritual, not prediction.
 */

const Temple = (() => {
  'use strict';

  const results = HISTORICAL_RESULTS;

  // ── Deterministic derivation ──
  // FNV-1a hash: stable across sessions so the temple "remembers" its answer.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const num4 = (seed) => String(hash(seed) % 10000).padStart(4, '0');

  const todaySG = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

  // ── Strike history index (built once) ──
  let numberIndex = null;
  function buildIndex() {
    numberIndex = new Map();
    results.forEach((r, i) => {
      const all = [r.first, r.second, r.third, ...(r.starters || []), ...(r.consolation || [])];
      all.forEach(n => {
        if (!n) return;
        const e = numberIndex.get(n);
        if (e) { e.count++; }
        else { numberIndex.set(n, { count: 1, lastSeen: i, date: r.date }); }
      });
    });
  }

  function numberInfo(num) {
    if (!numberIndex) buildIndex();
    const e = numberIndex.get(num);
    if (!e) return { count: 0, text: 'never struck — a fresh number' };
    const ago = e.lastSeen === 0 ? 'last draw' : `${e.lastSeen} draws ago`;
    return { count: e.count, text: `struck ${e.count}× in history · last seen ${ago}` };
  }

  // ── Number checker ──
  // 4D convention: a plate/phone becomes its last 4 digits, short numbers
  // pad with leading zeros (plate 123 -> 0123).
  function normalizeNumber(raw) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    return digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');
  }

  function prizeOf(r, num) {
    if (r.first === num) return '1st Prize';
    if (r.second === num) return '2nd Prize';
    if (r.third === num) return '3rd Prize';
    if ((r.starters || []).includes(num)) return 'Starter';
    if ((r.consolation || []).includes(num)) return 'Consolation';
    return null;
  }

  function numberDetail(num) {
    const strikes = [];
    const byPrize = {};
    results.forEach(r => {
      const p = prizeOf(r, num);
      if (p) {
        strikes.push({ drawNo: r.drawNo, date: r.date, prize: p });
        byPrize[p] = (byPrize[p] || 0) + 1;
      }
    });
    return { strikes, byPrize, latestPrize: prizeOf(results[0], num) };
  }

  // ── Blessing card (canvas share) ──
  function shareCard(title, subtitle, number, note) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 700);
    glow.addColorStop(0, 'rgba(212,175,55,0.16)');
    glow.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#a88a2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 58, W - 116, H - 116);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af37';
    ctx.font = '52px Georgia, serif';
    ctx.fillText('🏮 CaiShenYeah 财神爷', W / 2, 190);
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '32px Georgia, serif';
    ctx.fillText('The Digital Temple of Fortune', W / 2, 245);

    ctx.fillStyle = '#f0d060';
    ctx.font = 'bold 110px Georgia, serif';
    ctx.fillText(title, W / 2, 480);
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '40px Georgia, serif';
    ctx.fillText(subtitle, W / 2, 560);

    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 230px "Courier New", monospace';
    ctx.fillText(number.split('').join(' '), W / 2, 830);

    ctx.fillStyle = '#a0a0a0';
    ctx.font = '34px Georgia, serif';
    ctx.fillText(note, W / 2, 930);
    ctx.fillText(new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }), W / 2, 1150);
    ctx.fillStyle = '#666';
    ctx.font = '28px Georgia, serif';
    ctx.fillText('Every number has the same 1-in-10,000 chance · Play responsibly', W / 2, 1230);

    c.toBlob(async (blob) => {
      const file = new File([blob], 'caishenyeah-blessing.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'CaiShenYeah Blessing' }); return; } catch (e) { /* cancelled */ }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'caishenyeah-blessing.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  }

  // ── Kau Chim fortunes ──
  const FORTUNE_LEVELS = {
    great: { label: '上上 Great Blessing', cls: 'level-great' },
    good: { label: '上吉 Good Fortune', cls: 'level-good' },
    fair: { label: '中吉 Fair Fortune', cls: 'level-fair' },
    neutral: { label: '中平 Neutral', cls: 'level-neutral' },
    caution: { label: '下签 Proceed Gently', cls: 'level-caution' }
  };

  const FORTUNES = [
    { n: 1, level: 'great', title: '锦上添花', verse: 'Brocade gains fresh flowers; what is good grows better still.', advice: 'A season of momentum. Share your luck and it multiplies.' },
    { n: 7, level: 'good', title: '春风得意', verse: 'The spring wind fills your sails; the road ahead runs smooth.', advice: 'Move on what you have been postponing.' },
    { n: 9, level: 'fair', title: '守得云开', verse: 'Hold steady until the clouds part and the moon shows itself.', advice: 'Patience now is worth more than speed.' },
    { n: 12, level: 'neutral', title: '平湖秋月', verse: 'A calm lake mirrors the autumn moon — nothing stirs, nothing is lost.', advice: 'Stillness is also progress. Keep your routines.' },
    { n: 15, level: 'good', title: '枯木逢春', verse: 'The withered tree meets spring; old efforts put out new leaves.', advice: 'Something you gave up on deserves a second look.' },
    { n: 18, level: 'caution', title: '逆水行舟', verse: 'A boat rowed against the current — pause, or be carried back.', advice: 'Do not force it this week. Rest is strategy.' },
    { n: 21, level: 'great', title: '龙腾四海', verse: 'The dragon rises over four seas; heaven takes notice of you.', advice: 'Aim higher than feels comfortable.' },
    { n: 24, level: 'fair', title: '细水长流', verse: 'A thin stream flows the longest; small and steady wins the year.', advice: 'Guard the small daily habits. They compound.' },
    { n: 28, level: 'good', title: '花开富贵', verse: 'Flowers open onto wealth and honour at your gate.', advice: 'Say yes to the invitation you were unsure about.' },
    { n: 33, level: 'neutral', title: '云中望月', verse: 'You glimpse the moon through moving clouds — clarity comes and goes.', advice: 'Decide nothing big today; watch a little longer.' },
    { n: 36, level: 'caution', title: '雾里看花', verse: 'Flowers seen through fog — things are not as they appear.', advice: 'Check the fine print. Ask one more question.' },
    { n: 42, level: 'good', title: '雨后彩虹', verse: 'After the rain, the rainbow; the hard part is already behind you.', advice: 'Forgive the delay. The timing was protecting you.' },
    { n: 45, level: 'great', title: '金玉满堂', verse: 'Gold and jade fill the hall; abundance gathers where gratitude lives.', advice: 'Count what you have before counting what you want.' },
    { n: 49, level: 'fair', title: '登高望远', verse: 'Climb higher to see further; effort buys perspective.', advice: 'Learn the skill. The shortcut is the long way.' },
    { n: 54, level: 'neutral', title: '静待花开', verse: 'The bud opens on its own schedule, not on yours.', advice: 'You have done your part. Let it ripen.' },
    { n: 58, level: 'good', title: '贵人相助', verse: 'A noble friend appears when the road forks.', advice: 'Accept help this week. Pride is expensive.' },
    { n: 63, level: 'caution', title: '塞翁失马', verse: 'The old man loses his horse — who can say it is not a blessing?', advice: 'Today’s setback may be next month’s escape.' },
    { n: 66, level: 'great', title: '福星高照', verse: 'The star of fortune shines directly overhead.', advice: 'A lucky window. Be generous while it is open.' },
    { n: 72, level: 'fair', title: '柳暗花明', verse: 'Past the dark willows, a bright village of flowers appears.', advice: 'Keep walking. The dead end is an illusion.' },
    { n: 77, level: 'good', title: '双喜临门', verse: 'Two joys arrive at one door; good news travels in pairs.', advice: 'Celebrate the small win — it invites the bigger one.' },
    { n: 81, level: 'neutral', title: '月有圆缺', verse: 'The moon waxes and wanes; so do accounts, moods, and luck.', advice: 'Neither the high nor the low will last. Stay level.' },
    { n: 88, level: 'great', title: '发发大吉', verse: 'Double eight — prosperity knocks twice and loudly.', advice: 'Huat ah! But bet only what you can laugh about losing.' },
    { n: 93, level: 'caution', title: '如履薄冰', verse: 'You walk on thin ice — light steps, no sudden moves.', advice: 'Postpone the risky commitment. Protect the base.' },
    { n: 100, level: 'good', title: '苦尽甘来', verse: 'Bitterness ends, sweetness arrives; the debt of effort is repaid.', advice: 'The tide has already turned, even if the shore looks the same.' }
  ];

  // ── Dream dictionary ──
  const DREAMS = [
    { zh: '蛇', en: 'Snake', emoji: '🐍' }, { zh: '龙', en: 'Dragon', emoji: '🐉' },
    { zh: '虎', en: 'Tiger', emoji: '🐅' }, { zh: '鼠', en: 'Rat', emoji: '🐀' },
    { zh: '牛', en: 'Ox', emoji: '🐂' }, { zh: '兔', en: 'Rabbit', emoji: '🐇' },
    { zh: '马', en: 'Horse', emoji: '🐎' }, { zh: '羊', en: 'Goat', emoji: '🐐' },
    { zh: '猴', en: 'Monkey', emoji: '🐒' }, { zh: '鸡', en: 'Rooster', emoji: '🐓' },
    { zh: '狗', en: 'Dog', emoji: '🐕' }, { zh: '猪', en: 'Pig', emoji: '🐖' },
    { zh: '猫', en: 'Cat', emoji: '🐈' }, { zh: '鱼', en: 'Fish', emoji: '🐟' },
    { zh: '鸟', en: 'Bird', emoji: '🐦' }, { zh: '乌龟', en: 'Turtle', emoji: '🐢' },
    { zh: '大象', en: 'Elephant', emoji: '🐘' }, { zh: '鳄鱼', en: 'Crocodile', emoji: '🐊' },
    { zh: '蝴蝶', en: 'Butterfly', emoji: '🦋' }, { zh: '蜘蛛', en: 'Spider', emoji: '🕷️' },
    { zh: '祖先', en: 'Deceased relative', emoji: '🕯️' }, { zh: '神明', en: 'Deity', emoji: '⛩️' },
    { zh: '鬼', en: 'Ghost', emoji: '👻' }, { zh: '婚礼', en: 'Wedding', emoji: '💒' },
    { zh: '葬礼', en: 'Funeral', emoji: '⚰️' }, { zh: '婴儿', en: 'Baby', emoji: '👶' },
    { zh: '怀孕', en: 'Pregnancy', emoji: '🤰' }, { zh: '掉牙', en: 'Teeth falling', emoji: '🦷' },
    { zh: '飞翔', en: 'Flying', emoji: '🕊️' }, { zh: '坠落', en: 'Falling', emoji: '🌀' },
    { zh: '被追', en: 'Being chased', emoji: '🏃' }, { zh: '火', en: 'Fire', emoji: '🔥' },
    { zh: '水灾', en: 'Flood', emoji: '🌊' }, { zh: '下雨', en: 'Rain', emoji: '🌧️' },
    { zh: '大海', en: 'Sea', emoji: '⛵' }, { zh: '高山', en: 'Mountain', emoji: '⛰️' },
    { zh: '庙宇', en: 'Temple', emoji: '🏮' }, { zh: '钱', en: 'Money', emoji: '💵' },
    { zh: '黄金', en: 'Gold', emoji: '🪙' }, { zh: '血', en: 'Blood', emoji: '🩸' },
    { zh: '车祸', en: 'Car accident', emoji: '🚗' }, { zh: '警察', en: 'Police', emoji: '👮' },
    { zh: '小偷', en: 'Thief', emoji: '🥷' }, { zh: '考试', en: 'Exam', emoji: '📝' },
    { zh: '榴莲', en: 'Durian', emoji: '🍈' }, { zh: '房子', en: 'House', emoji: '🏠' },
    { zh: '飞机', en: 'Aeroplane', emoji: '✈️' }, { zh: '闪电', en: 'Lightning', emoji: '⚡' }
  ];

  // Three temple numbers per symbol: direct, mirrored, and the seeker's own
  // (personalised by today's date so the temple answers freshly each day).
  function dreamNumbers(key) {
    const direct = num4('dream:' + key);
    const mirror = direct.split('').reverse().join('');
    const daily = num4('dream:' + key + ':' + todaySG());
    return [
      { label: 'Temple Book', number: direct },
      { label: 'Mirror', number: mirror },
      { label: "Today's Sign", number: daily }
    ];
  }

  // ── Kau Chim rendering ──
  const LS_KEY = 'temple_kauchim';

  function renderFortune(f) {
    const level = FORTUNE_LEVELS[f.level];
    const blessed = num4('stick:' + f.n + ':' + todaySG());
    const info = numberInfo(blessed);
    document.getElementById('kauchimResult').innerHTML = `
      <div class="fortune-card animate-in">
        <div class="fortune-stick-no">第 ${f.n} 签 · Lot No. ${f.n}</div>
        <div class="fortune-title">${f.title}</div>
        <span class="badge fortune-level ${level.cls}">${level.label}</span>
        <p class="fortune-verse">&ldquo;${f.verse}&rdquo;</p>
        <p class="fortune-advice">${f.advice}</p>
        <div class="fortune-number-block">
          <div class="fortune-number-label">Your blessed number for today</div>
          <div class="fortune-number">${blessed}</div>
          <div class="fortune-number-history">${info.text}</div>
        </div>
        <button class="temple-btn temple-btn-small" id="fortuneShare">📤 Share Blessing Card</button>
        <p class="temple-honesty">The temple speaks plainly: every 4D number carries the same 1-in-10,000 chance. This number is a blessing to carry, not a prediction.</p>
      </div>`;
    document.getElementById('fortuneShare').addEventListener('click', () =>
      shareCard(f.title, `第 ${f.n} 签 · ${level.label}`, blessed, info.text));
  }

  function initKauChim() {
    const btn = document.getElementById('kauchimShake');
    const cylinder = document.getElementById('kauchimCylinder');
    const note = document.getElementById('kauchimNote');

    // Restore today's stick — the temple gives one sincere answer per day.
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved && saved.date === todaySG()) {
        const f = FORTUNES.find(x => x.n === saved.n);
        if (f) {
          renderFortune(f);
          note.textContent = 'The temple has already answered you today. You may ask again, but the first answer is the sincere one.';
        }
      }
    } catch (e) { /* localStorage unavailable — ritual still works */ }

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true;
      cylinder.classList.add('shaking');
      document.getElementById('kauchimResult').innerHTML = '';
      note.textContent = '';

      setTimeout(() => {
        cylinder.classList.remove('shaking');
        btn.disabled = false;
        const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        try { localStorage.setItem(LS_KEY, JSON.stringify({ date: todaySG(), n: f.n })); } catch (e) {}
        renderFortune(f);
      }, 1400);
    });
  }

  // ── Dream dictionary rendering ──
  function renderDreamResult(symbol) {
    const nums = dreamNumbers(symbol.zh || symbol.en);
    const title = symbol.emoji
      ? `${symbol.emoji} ${symbol.en} <span class="dream-zh">${symbol.zh}</span>`
      : `&ldquo;${symbol.en}&rdquo;`;
    document.getElementById('dreamResult').innerHTML = `
      <div class="card animate-in dream-result-card">
        <div class="card-title">${title}</div>
        <div class="dream-numbers">
          ${nums.map(x => {
            const info = numberInfo(x.number);
            return `
              <div class="dream-number-item">
                <div class="dream-number-label">${x.label}</div>
                <div class="dream-number">${x.number}</div>
                <div class="fortune-number-history">${info.text}</div>
              </div>`;
          }).join('')}
        </div>
        <button class="temple-btn temple-btn-small" id="dreamShare">📤 Share Blessing Card</button>
        <p class="temple-honesty">Dream numbers are drawn from the temple book, not from probability — every number has the same 1-in-10,000 chance. Strike history is real, from ${results.length.toLocaleString()} actual draws.</p>
      </div>`;
    document.getElementById('dreamShare').addEventListener('click', () =>
      shareCard(`${symbol.emoji || '🌙'} ${symbol.zh || symbol.en}`, `Dream: ${symbol.en}`, nums[0].number,
        `Mirror ${nums[1].number} · Today's Sign ${nums[2].number}`));
    document.getElementById('dreamResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initDreams() {
    const grid = document.getElementById('dreamGrid');
    const search = document.getElementById('dreamSearch');

    function drawGrid(filter) {
      const q = (filter || '').trim().toLowerCase();
      const shown = DREAMS.filter(d =>
        !q || d.en.toLowerCase().includes(q) || d.zh.includes(q));
      grid.innerHTML = shown.map((d, i) =>
        `<button class="dream-chip" data-i="${DREAMS.indexOf(d)}">${d.emoji} ${d.en}<span class="dream-zh">${d.zh}</span></button>`
      ).join('');
      if (!shown.length && q) {
        grid.innerHTML = `<button class="dream-chip dream-chip-custom" data-custom="${q.replace(/"/g, '')}">🌙 Interpret &ldquo;${q.replace(/</g, '&lt;')}&rdquo;</button>`;
      }
    }

    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.dream-chip');
      if (!chip) return;
      if (chip.dataset.custom !== undefined) {
        renderDreamResult({ en: chip.dataset.custom, zh: '', emoji: '' });
      } else {
        renderDreamResult(DREAMS[Number(chip.dataset.i)]);
      }
    });

    search.addEventListener('input', () => drawGrid(search.value));
    drawGrid('');
  }

  // ── Number checker rendering ──
  function initChecker() {
    const form = document.getElementById('checkerForm');
    const input = document.getElementById('checkerInput');
    const out = document.getElementById('checkerResult');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const nums = [...new Set(raw.split(/[,;/]+/).map(normalizeNumber).filter(Boolean))].slice(0, 8);
      if (!nums.length) {
        out.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The temple needs at least one digit to read.</p>';
        return;
      }
      const latest = results[0];
      out.innerHTML = nums.map(num => {
        const d = numberDetail(num);
        const won = d.latestPrize;
        const verdict = won
          ? `<span class="badge badge-hot">🎉 ${won} — Draw #${latest.drawNo}!</span>`
          : `<span class="badge badge-cold">Not in Draw #${latest.drawNo}</span>`;
        const breakdown = Object.entries(d.byPrize).map(([p, n]) => `${p} ×${n}`).join(' · ');
        const recent = d.strikes.slice(0, 5).map(s =>
          `<div class="checker-strike"><span>Draw #${s.drawNo} · ${s.date}</span><span class="gold-text">${s.prize}</span></div>`).join('');
        return `
          <div class="card animate-in checker-card">
            <div class="checker-head">
              <span class="checker-number">${num}</span>
              ${verdict}
            </div>
            ${d.strikes.length
              ? `<p class="checker-summary">Struck <strong class="gold-text">${d.strikes.length}×</strong> in ${results.length.toLocaleString()} draws — ${breakdown}</p>${recent}`
              : `<p class="checker-summary">Never struck in ${results.length.toLocaleString()} draws since ${results[results.length - 1].date.slice(0, 4)} — a fresh number, still holding its blessing.</p>`}
          </div>`;
      }).join('');
    });
  }

  // ── Incense ritual ──
  const LS_INCENSE = 'temple_incense';

  function initIncense() {
    const btn = document.getElementById('incenseLight');
    const stick = document.getElementById('incenseStick');
    const note = document.getElementById('incenseNote');

    const yesterdaySG = () =>
      new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

    function load() {
      try { return JSON.parse(localStorage.getItem(LS_INCENSE) || 'null'); } catch (e) { return null; }
    }

    function show(state, fresh) {
      stick.classList.add('lit');
      const days = state.streak === 1 ? 'day' : 'days';
      note.textContent = fresh
        ? `Incense lit. 🔥 ${state.streak} ${days} of devotion.`
        : `Today's incense is already burning. 🔥 ${state.streak} ${days} of devotion.`;
    }

    const saved = load();
    if (saved && saved.date === todaySG()) show(saved, false);

    btn.addEventListener('click', () => {
      const cur = load();
      if (cur && cur.date === todaySG()) { show(cur, false); return; }
      const streak = (cur && cur.date === yesterdaySG()) ? cur.streak + 1 : 1;
      const state = { date: todaySG(), streak };
      try { localStorage.setItem(LS_INCENSE, JSON.stringify(state)); } catch (e) {}
      show(state, true);
    });
  }

  // ── Daily blessings: zodiac, almanac, festivals ──
  const ZODIAC = [
    { zh: '鼠', en: 'Rat', emoji: '🐀' }, { zh: '牛', en: 'Ox', emoji: '🐂' },
    { zh: '虎', en: 'Tiger', emoji: '🐅' }, { zh: '兔', en: 'Rabbit', emoji: '🐇' },
    { zh: '龙', en: 'Dragon', emoji: '🐉' }, { zh: '蛇', en: 'Snake', emoji: '🐍' },
    { zh: '马', en: 'Horse', emoji: '🐎' }, { zh: '羊', en: 'Goat', emoji: '🐐' },
    { zh: '猴', en: 'Monkey', emoji: '🐒' }, { zh: '鸡', en: 'Rooster', emoji: '🐓' },
    { zh: '狗', en: 'Dog', emoji: '🐕' }, { zh: '猪', en: 'Pig', emoji: '🐖' }
  ];

  const ALMANAC_GOOD = ['placing a small bet', 'visiting family', 'settling a debt', 'starting a new habit', 'tidying the house', 'making a plan', 'reconciling with an old friend', 'learning something new', 'resting early', 'giving to charity', 'cooking at home', 'a long walk'];
  const ALMANAC_AVOID = ['chasing losses', 'big-ticket purchases', 'quarrels over money', 'lending money', 'signing in haste', 'gossip', 'late nights', 'impulsive bets', 'empty promises', 'borrowed luck'];
  const ALMANAC_COLORS = ['Gold', 'Red', 'Jade Green', 'White', 'Azure Blue', 'Purple'];
  const ALMANAC_DIRECTIONS = ['North', 'South', 'East', 'West', 'Northeast', 'Southeast', 'Northwest', 'Southwest'];

  const FESTIVALS = [
    { date: '2026-09-25', zh: '中秋节', en: 'Mid-Autumn Festival', emoji: '🥮' },
    { date: '2026-12-22', zh: '冬至', en: 'Dongzhi (Winter Solstice)', emoji: '🍡' },
    { date: '2027-02-06', zh: '新年', en: 'Chinese New Year — Year of the Goat', emoji: '🧧' },
    { date: '2027-02-10', zh: '迎财神', en: "God of Fortune's Day (正月初五)", emoji: '🏮' },
    { date: '2027-04-05', zh: '清明', en: 'Qing Ming', emoji: '🌿' }
  ];

  const LS_ZODIAC = 'temple_zodiac';

  function pickN(list, n, seed) {
    const out = [];
    const pool = [...list];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool.splice(hash(seed + ':' + i) % pool.length, 1)[0]);
    }
    return out;
  }

  function renderZodiac(zh) {
    const z = ZODIAC.find(x => x.zh === zh);
    if (!z) return;
    document.querySelectorAll('#zodiacGrid .dream-chip').forEach(c =>
      c.classList.toggle('zodiac-active', c.dataset.zh === zh));
    const num = num4('zodiac:' + zh + ':' + todaySG());
    const info = numberInfo(num);
    document.getElementById('zodiacResult').innerHTML = `
      <div class="fortune-number-block" style="text-align:center;margin-top:16px;">
        <div class="fortune-number-label">${z.emoji} ${z.en} — today's number</div>
        <div class="fortune-number" style="font-size:2rem;">${num}</div>
        <div class="fortune-number-history">${info.text}</div>
      </div>`;
  }

  function initDaily() {
    // Zodiac
    const grid = document.getElementById('zodiacGrid');
    grid.innerHTML = ZODIAC.map(z =>
      `<button class="dream-chip" data-zh="${z.zh}">${z.emoji} ${z.zh}</button>`).join('');
    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.dream-chip');
      if (!chip) return;
      try { localStorage.setItem(LS_ZODIAC, chip.dataset.zh); } catch (err) {}
      renderZodiac(chip.dataset.zh);
    });
    try {
      const saved = localStorage.getItem(LS_ZODIAC);
      if (saved) renderZodiac(saved);
    } catch (e) {}

    // Almanac
    const today = todaySG();
    document.getElementById('almanacDate').textContent =
      new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
    const good = pickN(ALMANAC_GOOD, 2, 'good:' + today);
    const avoid = pickN(ALMANAC_AVOID, 2, 'avoid:' + today);
    const color = ALMANAC_COLORS[hash('color:' + today) % ALMANAC_COLORS.length];
    const dir = ALMANAC_DIRECTIONS[hash('dir:' + today) % ALMANAC_DIRECTIONS.length];
    document.getElementById('almanacContent').innerHTML = `
      <div class="almanac-row"><span class="almanac-label good">宜 Auspicious</span><span>${good.join(', ')}</span></div>
      <div class="almanac-row"><span class="almanac-label bad">忌 Avoid</span><span>${avoid.join(', ')}</span></div>
      <div class="almanac-row"><span class="almanac-label">Lucky colour</span><span class="gold-text">${color}</span></div>
      <div class="almanac-row"><span class="almanac-label">Lucky direction</span><span class="gold-text">${dir}</span></div>
      <p class="temple-honesty" style="margin-top:14px;">The almanac renews daily — guidance for the spirit, not the wallet.</p>`;

    // Festivals
    const upcoming = FESTIVALS.filter(f => f.date >= today);
    document.getElementById('festivalContent').innerHTML = upcoming.map((f, i) => {
      const days = Math.round((new Date(f.date + 'T00:00:00+08:00') - new Date()) / 86400000);
      const when = days === 0 ? '🎉 Today!' : `in ${days} day${days === 1 ? '' : 's'}`;
      return `
        <div class="almanac-row${i === 0 ? ' festival-next' : ''}">
          <span>${f.emoji} ${f.en} <span class="dream-zh">${f.zh}</span></span>
          <span class="${i === 0 ? 'gold-text' : ''}">${f.date} · ${when}</span>
        </div>`;
    }).join('');
  }

  // ── Init ──
  window.addEventListener('DOMContentLoaded', () => {
    initKauChim();
    initDreams();
    initChecker();
    initIncense();
    initDaily();
  });

  return { hash, num4, dreamNumbers, numberInfo, numberDetail, normalizeNumber, FORTUNES, DREAMS };
})();
