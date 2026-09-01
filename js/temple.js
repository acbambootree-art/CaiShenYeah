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

  // ── Dream dictionary (readings in the 周公解梦 tradition) ──
  const OMEN = {
    auspicious: { label: '吉 Auspicious', cls: 'omen-good' },
    neutral: { label: '平 Neutral', cls: 'omen-neutral' },
    caution: { label: '慎 Take Care', cls: 'omen-caution' }
  };

  const DREAMS = [
    {
      zh: '蛇', en: 'Snake', emoji: '🐍', omen: 'auspicious',
      reading: 'Coiled wealth — money is already moving toward you.',
      variants: 'Bitten: fortune arrives faster than expected. Fleeing: an opportunity slipping away. Many snakes: money from several directions at once.',
      insight: 'Act on the offer you have been circling for weeks.'
    },
    {
      zh: '龙', en: 'Dragon', emoji: '🐉', omen: 'auspicious',
      reading: 'The highest omen — recognition, elevation, a name lifted before important people.',
      variants: 'Rising: promotion or public notice. Sleeping: your moment is not yet ripe. Riding it: you are in control of the rise.',
      insight: 'Ask for the bigger role. You are already doing the work.'
    },
    {
      zh: '虎', en: 'Tiger', emoji: '🐅', omen: 'neutral',
      reading: 'Power meets you on the road.',
      variants: 'Calm tiger: authority won. Lunging: a rival with teeth. Riding one: a danger you cannot safely dismount from.',
      insight: 'Face the confrontation directly — hesitation will be read as weakness.'
    },
    {
      zh: '鼠', en: 'Rat', emoji: '🐀', omen: 'caution',
      reading: 'Something small is quietly gnawing at your stores.',
      variants: 'Many rats: scattered small losses. White rat: a hidden helper. Catching one: you find the leak.',
      insight: 'Audit the recurring costs you have stopped noticing.'
    },
    {
      zh: '牛', en: 'Ox', emoji: '🐂', omen: 'auspicious',
      reading: 'Slow wealth, sure wealth — harvest for patient labour.',
      variants: 'Ploughing: today\'s work pays later. Charging: overwork turning against you. Buying one: an asset worth holding.',
      insight: 'Choose what compounds over what pays out this month.'
    },
    {
      zh: '兔', en: 'Rabbit', emoji: '🐇', omen: 'auspicious',
      reading: 'The moon\'s own animal — quiet luck and narrow escapes.',
      variants: 'White rabbit: pure fortune. Running away: luck you will have to chase. Holding one: safety already in your hands.',
      insight: 'That near-miss was protection, not bad luck.'
    },
    {
      zh: '马', en: 'Horse', emoji: '🐎', omen: 'auspicious',
      reading: '马到成功 — success arrives the moment the horse does.',
      variants: 'Galloping: news travelling fast toward you. Fallen: a delay, not a defeat. Riding: you set the pace.',
      insight: 'Move on the thing you have been waiting for permission to do.'
    },
    {
      zh: '羊', en: 'Goat', emoji: '🐐', omen: 'auspicious',
      reading: 'Harmony and provision — the family gathered and fed.',
      variants: 'A flock: support around you. Lost goat: someone drifting from the family. Black goat: a stubborn relative.',
      insight: 'Make the call to the relative you keep postponing.'
    },
    {
      zh: '猴', en: 'Monkey', emoji: '🐒', omen: 'caution',
      reading: 'Cleverness that may be too clever for its own good.',
      variants: 'Playing: harmless mischief. Stealing: someone is outsmarting you. Caged: talent going to waste.',
      insight: 'Simplify the arrangement before you sign it.'
    },
    {
      zh: '鸡', en: 'Rooster', emoji: '🐓', omen: 'auspicious',
      reading: 'Something hidden will be announced in daylight.',
      variants: 'Crowing: news at dawn. Hen with chicks: increase in the family. Fighting cocks: a quarrel becoming public.',
      insight: 'Say it out loud — the secret is costing more than the telling.'
    },
    {
      zh: '狗', en: 'Dog', emoji: '🐕', omen: 'auspicious',
      reading: 'Loyalty stands guard over you.',
      variants: 'Friendly: a friend proving true. Barking: a warning worth heeding. Biting: betrayal by someone close.',
      insight: 'Trust the friend who tells you the unwelcome thing.'
    },
    {
      zh: '猪', en: 'Pig', emoji: '🐖', omen: 'auspicious',
      reading: 'Abundance without anxiety — the pig dreams only of plenty.',
      variants: 'Fat pig: money arriving easily. Piglets: small gains multiplying. Escaping: wealth leaking through habits.',
      insight: 'Enjoy the surplus, but bank a share of it first.'
    },
    {
      zh: '猫', en: 'Cat', emoji: '🐈', omen: 'neutral',
      reading: 'Something graceful is watching you with its own agenda.',
      variants: 'Purring: charm working in your favour. Scratching: a deceit surfacing. Black cat: a rival you have not identified.',
      insight: 'Verify the charming offer, and count your change.'
    },
    {
      zh: '鱼', en: 'Fish', emoji: '🐟', omen: 'auspicious',
      reading: '年年有余 — the fish is surplus itself.',
      variants: 'A big fish: a large windfall. Many: steady flow. A dead fish: a plan that has run its course.',
      insight: 'Deepen the source already feeding you instead of finding a new one.'
    },
    {
      zh: '鸟', en: 'Bird', emoji: '🐦', omen: 'neutral',
      reading: 'A message crosses distance to reach you.',
      variants: 'Singing: good news. Caged: news being withheld. Flying away: a chance departing.',
      insight: 'Answer the message you have left unread.'
    },
    {
      zh: '乌龟', en: 'Turtle', emoji: '🐢', omen: 'auspicious',
      reading: 'Longevity and protection over anything built slowly.',
      variants: 'Swimming: steady progress. Withdrawn into its shell: retreat is wise for now. On its back: someone near you is stuck and needs turning.',
      insight: 'Take the slow option — it will outlast the fast one.'
    },
    {
      zh: '大象', en: 'Elephant', emoji: '🐘', omen: 'auspicious',
      reading: 'Great weight moving gently — major fortune handled safely.',
      variants: 'Riding one: authority carried with ease. Charging: a big matter escaping control. White elephant: a gift that costs more to keep than it gives.',
      insight: 'Say yes to scale, no to what merely looks impressive.'
    },
    {
      zh: '鳄鱼', en: 'Crocodile', emoji: '🐊', omen: 'caution',
      reading: 'Still water hides old teeth.',
      variants: 'Submerged: a threat you cannot yet see. Snapping: an argument about to surface. Escaping one: you avoid a trap set for you.',
      insight: 'Be brief and courteous with the person testing your patience.'
    },
    {
      zh: '蝴蝶', en: 'Butterfly', emoji: '🦋', omen: 'auspicious',
      reading: 'Transformation completing — what crawled all year is ready to fly.',
      variants: 'Landing on you: a blessing choosing you. Many: a whole season of change. Trapped: growth you keep postponing.',
      insight: 'Release the old arrangement; it has finished its purpose.'
    },
    {
      zh: '蜘蛛', en: 'Spider', emoji: '🕷️', omen: 'neutral',
      reading: 'Patient work paying off thread by thread.',
      variants: 'Spinning: your effort is compounding. Walking into a web: a trap laid by another. Killing one: you break a scheme.',
      insight: 'Stay with the slow project one more week.'
    },
    {
      zh: '祖先', en: 'Deceased relative', emoji: '🕯️', omen: 'auspicious',
      reading: 'The tenderest of dreams — an ancestor visits to bless, never to warn.',
      variants: 'Smiling: approval of your path. Silent: simply company. Speaking: remember exactly what was said.',
      insight: 'Light incense and give thanks — and note any number or date they showed you.'
    },
    {
      zh: '神明', en: 'Deity', emoji: '⛩️', omen: 'auspicious',
      reading: 'You are seen; protection surrounds a decision you thought you faced alone.',
      variants: 'A statue: steady watch over you. A speaking deity: an instruction worth obeying. A hall of many gods: help arriving from several sides.',
      insight: 'Choose the right path rather than the easy one — you are not unsupported.'
    },
    {
      zh: '鬼', en: 'Ghost', emoji: '👻', omen: 'caution',
      reading: 'Unfinished business, not harm.',
      variants: 'A familiar ghost: something left unsaid to that person. Chasing you: a debt or guilt in pursuit. Fading: the matter is already resolving.',
      insight: 'Settle the thing you keep pretending to have forgotten.'
    },
    {
      zh: '婚礼', en: 'Wedding', emoji: '💒', omen: 'auspicious',
      reading: 'A union of matters — partnerships, mergers, promises made formal.',
      variants: 'Your own: a commitment approaching. Attending: someone else\'s fortune touching you. Interrupted: terms still unsettled.',
      insight: 'Read the agreement carefully before you celebrate it.'
    },
    {
      zh: '葬礼', en: 'Funeral', emoji: '⚰️', omen: 'auspicious',
      reading: 'Reversal — an ending that releases fortune.',
      variants: 'Of a stranger: a burden lifts. Of someone living: long life for them. Your own: a chapter closing well.',
      insight: 'Stop funding the thing that has already ended.'
    },
    {
      zh: '婴儿', en: 'Baby', emoji: '👶', omen: 'auspicious',
      reading: 'A new thing with your name on it — fragile now, mighty later.',
      variants: 'Crying: it needs attention today. Sleeping: it is growing quietly. Holding it: responsibility gladly taken.',
      insight: 'Give the new venture an hour a day, not one burst a month.'
    },
    {
      zh: '怀孕', en: 'Pregnancy', emoji: '🤰', omen: 'auspicious',
      reading: 'Something is growing that cannot yet be seen.',
      variants: 'Your own: a private plan is healthy. Another\'s: news coming from them. Difficult: the idea needs more time.',
      insight: 'Do not announce it before its month.'
    },
    {
      zh: '掉牙', en: 'Teeth falling', emoji: '🦷', omen: 'caution',
      reading: 'The old book reads this as worry for elders.',
      variants: 'Painless: a difficulty resolves without loss. Bleeding: a worry with a real cost. All at once: fear of losing standing.',
      insight: 'Call your parents this week.'
    },
    {
      zh: '飞翔', en: 'Flying', emoji: '🕊️', omen: 'auspicious',
      reading: 'Rising above what held you.',
      variants: 'High and calm: real elevation coming. Struggling to stay up: ambition outrunning support. Falling mid-flight: a plan needing a firmer base.',
      insight: 'Put your name forward for the thing you assume is out of reach.'
    },
    {
      zh: '坠落', en: 'Falling', emoji: '🌀', omen: 'caution',
      reading: 'The grip you fear losing may be the one worth releasing.',
      variants: 'Waking before you land: a warning. Landing safely: a burden dropped. Pushed: someone quietly undermining you.',
      insight: 'Let go of the commitment you hold on to out of pride.'
    },
    {
      zh: '被追', en: 'Being chased', emoji: '🏃', omen: 'caution',
      reading: 'What pursues you in sleep is what you avoid by day.',
      variants: 'An unseen pursuer: vague dread — name it and it shrinks. A known person: unresolved conflict. Turning to face it: the fear is already passing.',
      insight: 'Do the avoided task first thing tomorrow.'
    },
    {
      zh: '火', en: 'Fire', emoji: '🔥', omen: 'auspicious',
      reading: '火 means 旺 — fire is flourishing itself.',
      variants: 'Warm and contained: prosperity catching. Your house alight: change you did not choose but will profit from. Extinguished: an opportunity cooling.',
      insight: 'Feed the fire already burning; do not start a second one.'
    },
    {
      zh: '水灾', en: 'Flood', emoji: '🌊', omen: 'auspicious',
      reading: 'Water is wealth, and a flood is wealth past the banks.',
      variants: 'Rising: abundance beyond what you can hold. Muddy: money arriving with complications. Reaching high ground: you keep what matters.',
      insight: 'Hold on through the mess — do not sell in the panic.'
    },
    {
      zh: '下雨', en: 'Rain', emoji: '🌧️', omen: 'auspicious',
      reading: 'Heaven waters what you planted.',
      variants: 'Steady rain: reliable income. A storm passing: a dispute that clears the air. Rain indoors: trouble inside the home.',
      insight: 'Keep the routine — it is working even when it feels slow.'
    },
    {
      zh: '大海', en: 'Sea', emoji: '⛵', omen: 'neutral',
      reading: 'Your fortune has scale beyond the harbour.',
      variants: 'Calm: safe journeys and ventures abroad. Rough: wait for the next tide. Sinking: a venture beyond your depth.',
      insight: 'Take the bigger opportunity, but not without a crew.'
    },
    {
      zh: '高山', en: 'Mountain', emoji: '⛰️', omen: 'auspicious',
      reading: 'The obstacle is also the viewpoint.',
      variants: 'Climbing: a hard task worth its summit. Standing on top: it is already yours. A blocked path: a detour, not a defeat.',
      insight: 'Learn the skill rather than buying the shortcut.'
    },
    {
      zh: '庙宇', en: 'Temple', emoji: '🏮', omen: 'auspicious',
      reading: 'Guidance is nearer than you think.',
      variants: 'Entering: help is available if you ask. An empty temple: you are seeking in the wrong place. Praying: the answer is already forming in you.',
      insight: 'Ask your question plainly, of someone who can actually answer it.'
    },
    {
      zh: '钱', en: 'Money', emoji: '💵', omen: 'neutral',
      reading: 'A mixed omen — what you do with it in the dream is the message.',
      variants: 'Finding it: gain. Losing it: scattered attention. Counting it: anxiety about enough. Giving it away: generosity that returns.',
      insight: 'Look at your accounts calmly this week, without dread.'
    },
    {
      zh: '黄金', en: 'Gold', emoji: '🪙', omen: 'auspicious',
      reading: 'Not merely money — worth finally recognised.',
      variants: 'Wearing it: status arriving. Buried: talent unused. Fake gold: an offer that glitters and is not.',
      insight: 'Let someone appraise the thing you keep quiet about.'
    },
    {
      zh: '血', en: 'Blood', emoji: '🩸', omen: 'auspicious',
      reading: '见血见财 — to see blood is to see wealth on its way.',
      variants: 'A small cut: a quick small gain. Another\'s blood: money through a relationship. Stopping the bleeding: you protect what you have.',
      insight: 'Do not be spooked — look for the opportunity inside the shock.'
    },
    {
      zh: '车祸', en: 'Car accident', emoji: '🚗', omen: 'caution',
      reading: 'A collision of plans, not of cars.',
      variants: 'Witnessing one: someone else\'s crisis touches you. Driving: you are moving too fast. Walking away unhurt: a near miss you will recognise later.',
      insight: 'Slow one of your two competing commitments this week.'
    },
    {
      zh: '警察', en: 'Police', emoji: '👮', omen: 'neutral',
      reading: 'Order arrives, invited or not.',
      variants: 'Helped by them: protection and fair judgement. Chased: a rule you have been bending. Reporting to them: you want a matter settled properly.',
      insight: 'Straighten the paperwork before anyone asks for it.'
    },
    {
      zh: '小偷', en: 'Thief', emoji: '🥷', omen: 'caution',
      reading: 'Something of yours has quiet feet.',
      variants: 'Catching one: you reclaim what was slipping. Being robbed: time or credit taken. Being the thief: you are stealing from your own rest.',
      insight: 'Name what is draining away — hours, credit, or goodwill.'
    },
    {
      zh: '考试', en: 'Exam', emoji: '📝', omen: 'neutral',
      reading: 'You are being measured, or measuring yourself far too harshly.',
      variants: 'Unprepared: fear of exposure, not real lack. Passing: confidence returning. A blank paper: a decision you have not started.',
      insight: 'You are more prepared than the dream suggests. Begin.'
    },
    {
      zh: '榴莲', en: 'Durian', emoji: '🍈', omen: 'auspicious',
      reading: 'Fortune with a thorny shell — difficult, divisive, golden inside.',
      variants: 'Opening one: the reward is within reach. Pricked: a cost before the gain. Sharing it: profit best taken with others.',
      insight: 'Take the opportunity that others find off-putting.'
    },
    {
      zh: '房子', en: 'House', emoji: '🏠', omen: 'neutral',
      reading: 'The house is the self.',
      variants: 'New rooms: talents undiscovered. A leaking roof: body or savings needing maintenance. Bright and full: a settled heart. Empty: loneliness to tend.',
      insight: 'Repair the small thing at home you keep walking past.'
    },
    {
      zh: '飞机', en: 'Aeroplane', emoji: '✈️', omen: 'auspicious',
      reading: 'Distance shrinks for you.',
      variants: 'Boarding: travel or expansion approaching. Missing it: an opportunity with a deadline. Turbulence: a rough but completed journey.',
      insight: 'Keep your documents and your options ready.'
    },
    {
      zh: '闪电', en: 'Lightning', emoji: '⚡', omen: 'neutral',
      reading: 'Sudden illumination after long darkness.',
      variants: 'Distant: insight approaching. Striking near you: an abrupt change you did not choose. Lighting a path: the way forward is briefly, clearly visible.',
      insight: 'Write the idea down the moment it comes — it will not wait.'
    }
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
      if (window.Sound) Sound.rattle();

      setTimeout(() => {
        cylinder.classList.remove('shaking');
        btn.disabled = false;
        const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        try { localStorage.setItem(LS_KEY, JSON.stringify({ date: todaySG(), n: f.n })); } catch (e) {}
        renderFortune(f);
        if (window.Sound) Sound.bowl();
      }, 1400);
    });
  }

  // ── Dream dictionary rendering ──
  function renderDreamResult(symbol) {
    const nums = dreamNumbers(symbol.zh || symbol.en);
    const title = symbol.emoji
      ? `${symbol.emoji} ${symbol.en} <span class="dream-zh">${symbol.zh}</span>`
      : `&ldquo;${symbol.en}&rdquo;`;
    const reading = symbol.reading
      ? `
        <div class="dream-reading-head">
          <span class="dream-meaning-label">周公解梦 · The Temple Book reads</span>
          <span class="badge dream-omen ${OMEN[symbol.omen].cls}">${OMEN[symbol.omen].label}</span>
        </div>
        <p class="dream-meaning">${symbol.reading}</p>
        <dl class="dream-detail">
          <dt>变 If the dream differed</dt><dd>${symbol.variants}</dd>
          <dt>宜 What it asks of you</dt><dd>${symbol.insight}</dd>
        </dl>`
      : `
        <div class="dream-reading-head">
          <span class="dream-meaning-label">周公解梦 · The Temple Book reads</span>
        </div>
        <p class="dream-meaning">This dream has no entry in the temple book — it belongs to you alone. Its numbers are read from the dream’s own words; its meaning, only the dreamer can say.</p>`;
    document.getElementById('dreamResult').innerHTML = `
      <div class="card animate-in dream-result-card">
        <div class="card-title">${title}</div>
        ${reading}
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
    const video = document.getElementById('incenseVideo');
    const veil = document.getElementById('shrineVeil');

    // Shrine video is optional: hide the frame if the asset is missing
    if (video) {
      const hideShrine = () => {
        const shrine = document.getElementById('shrine');
        if (shrine) shrine.hidden = true;
      };
      video.addEventListener('error', hideShrine);
      if (video.error || video.networkState === 3) hideShrine(); // errored before we attached
    }

    function playRitualVideo() {
      if (!video || !video.currentSrc && !video.src) return;
      if (veil) veil.classList.add('lifted');
      video.currentTime = 0;
      const p = video.play();
      if (p) p.catch(() => {});
    }

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
      if (fresh) playRitualVideo();
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
      if (window.Sound) Sound.bowl();
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

  // ── Prayer wall ──
  const LS_WISH = 'temple_wish';
  let wallLoaded = false;

  const esc = (s) => s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderWall(wishes, count) {
    const wall = document.getElementById('wishWall');
    if (!wishes.length) {
      wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The wall is bare — be the first to hang a wish.</p>';
    } else {
      wall.innerHTML = wishes.map(w => `
        <div class="wish-plaque">
          <div class="wish-plaque-text">${esc(w.wish)}</div>
          <div class="wish-plaque-meta">${w.name ? esc(w.name) : '无名 Anonymous'} · ${new Date(w.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })}</div>
        </div>`).join('');
    }
    if (count > wishes.length) {
      document.getElementById('wishCount').textContent =
        `${count.toLocaleString()} wishes hang on this wall — showing the newest ${wishes.length}.`;
    } else {
      document.getElementById('wishCount').textContent = '';
    }
  }

  function loadWishes() {
    if (wallLoaded) return;
    wallLoaded = true;
    const wall = document.getElementById('wishWall');
    wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Reading the wall&hellip;</p>';
    fetch('/api/wishes')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => renderWall(d.wishes || [], d.count || 0))
      .catch(() => {
        wallLoaded = false;
        wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The wall rests for now — wishes return when the temple reopens.</p>';
      });
  }

  function initPrayerWall() {
    const form = document.getElementById('wishForm');
    const note = document.getElementById('wishNote');
    const btn = document.getElementById('wishSubmit');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(LS_WISH) === todaySG()) {
          note.textContent = 'The temple has already hung your wish today. Return tomorrow.';
          return;
        }
      } catch (err) {}

      const wish = document.getElementById('wishText').value.trim();
      if (wish.length < 2) return;
      btn.disabled = true;
      note.textContent = 'Hanging your wish…';

      fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wish,
          name: document.getElementById('wishName').value.trim(),
          altar: form.querySelector('.wish-altar').value
        })
      })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(() => {
          try { localStorage.setItem(LS_WISH, todaySG()); } catch (err) {}
          note.textContent = '🙏 Your wish hangs on the wall.';
          document.getElementById('wishText').value = '';
          if (window.Sound) Sound.bowl();
          wallLoaded = false;
          loadWishes();
        })
        .catch(() => { note.textContent = 'The wind took your wish — please try again.'; })
        .finally(() => { btn.disabled = false; });
    });
  }

  // ── The Living Altar ──
  // Feed-ready: when a temple partners, set liveUrl to their stream embed and
  // name the temple. Everything below already works; nothing else changes.
  const ALTAR = {
    liveUrl: null,              // e.g. 'https://www.youtube.com/embed/<id>?autoplay=1&mute=1'
    templeName: null,           // e.g. '福德祠 Fu De Temple'
    rounds: ['08:00', '18:00']  // SGT times a caretaker offers the bundle
  };

  const LS_OFFERING = 'temple_offering';
  let altarFramed = false;

  function sgMinutes() {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function nextRound() {
    const now = sgMinutes();
    const mins = ALTAR.rounds.map(r => {
      const [h, m] = r.split(':').map(Number);
      return h * 60 + m;
    }).sort((a, b) => a - b);
    const upcoming = mins.find(x => x > now);
    const at = upcoming !== undefined ? upcoming : mins[0];
    return { at, away: upcoming !== undefined ? at - now : 1440 - now + at };
  }

  function fmtTime(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
  }

  const safeLink = (u) => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : null;

  function renderAltarFrame() {
    if (altarFramed) return; // never rebuild: it would restart the stream
    altarFramed = true;
    const frame = document.getElementById('altarFrame');
    if (ALTAR.liveUrl) {
      frame.innerHTML = `
        <iframe src="${esc(ALTAR.liveUrl)}" allow="autoplay; encrypted-media" allowfullscreen title="Live temple altar"></iframe>
        <span class="altar-badge live">● LIVE · ${esc(ALTAR.templeName || 'The temple altar')}</span>`;
    } else {
      // Mock feed: what the frame will show once a temple's camera is connected
      frame.innerHTML = `
        <video src="altar-live.mp4" autoplay muted loop playsinline></video>
        <span class="altar-badge">DEMO FEED · no temple connected yet</span>`;
      document.getElementById('altarIntro').textContent =
        'A real altar, a real flame — once a temple joins us. This is a mock-up of the feed; the round below already works: names gather, and a caretaker will light them at the altar itself.';
    }
  }

  function renderRoundLine(pendingCount) {
    const { at, away } = nextRound();
    const h = Math.floor(away / 60), m = away % 60;
    document.getElementById('altarRound').innerHTML = `
      <span class="altar-round-time">Next round ${fmtTime(at)} SGT</span>
      <span class="altar-round-dot">·</span><span>in ${h ? h + 'h ' : ''}${m}m</span>
      <span class="altar-round-dot">·</span><span class="gold-text">${pendingCount} waiting</span>`;
  }

  function renderAltar(d) {
    const pending = d.pending || [], offered = d.offered || [];
    renderRoundLine(d.pendingCount || 0);

    document.getElementById('altarQueue').innerHTML = pending.length
      ? pending.map(o => `<div class="altar-name"><span>${esc(o.name)}</span>${
          o.dedication ? `<span class="altar-ded">${esc(o.dedication)}</span>` : ''}</div>`).join('')
      : '<p class="altar-empty">Nobody is waiting. Yours would be the first stick of the round.</p>';

    document.getElementById('altarOffered').innerHTML = offered.length
      ? offered.map(o => {
          const clip = safeLink(o.clip);
          const when = new Date(o.offeredAt).toLocaleString('en-SG',
            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' });
          return `<div class="altar-name offered"><span>${esc(o.name)}</span><span class="altar-ded">🪔 ${when}${
            clip ? ` · <a href="${esc(clip)}" target="_blank" rel="noopener noreferrer">watch</a>` : ''}</span></div>`;
        }).join('')
      : '<p class="altar-empty">No round has been offered yet.</p>';
  }

  function loadAltar() {
    renderAltarFrame();
    renderRoundLine(0);
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderAltar)
      .catch(() => {
        document.getElementById('altarQueue').innerHTML =
          '<p class="altar-empty">The altar is quiet just now — try again shortly.</p>';
      });
  }

  function initAltar() {
    const form = document.getElementById('offeringForm');
    const note = document.getElementById('offeringNote');
    const btn = document.getElementById('offeringSubmit');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(LS_OFFERING) === todaySG()) {
          note.textContent = 'You have already joined a round today. One offering a day.';
          return;
        }
      } catch (err) {}

      const name = document.getElementById('offeringName').value.trim();
      if (!name) return;
      btn.disabled = true;
      note.textContent = 'Adding your name to the round…';

      fetch('/api/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dedication: document.getElementById('offeringDedication').value.trim(),
          altar: form.querySelector('.wish-altar').value
        })
      })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(() => {
          try { localStorage.setItem(LS_OFFERING, todaySG()); } catch (err) {}
          note.textContent = '🪔 Your name is in the next round. We will show it here once the caretaker has offered it.';
          document.getElementById('offeringDedication').value = '';
          if (window.Sound) Sound.bowl();
          loadAltar();
        })
        .catch(() => { note.textContent = 'The altar did not take your name — please try again.'; })
        .finally(() => { btn.disabled = false; });
    });
  }

  // ── Altar board: the display that stands beside the real altar ──
  function loadBoard() {
    document.getElementById('boardTemple').textContent = ALTAR.templeName || '';
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const names = d.pending || [];
        document.getElementById('boardNames').innerHTML = names.length
          ? names.map(o => `<div class="board-name">${esc(o.name)}${
              o.dedication ? `<span>${esc(o.dedication)}</span>` : ''}</div>`).join('')
          : '<div class="board-empty">静候 · awaiting names</div>';
        const { at } = nextRound();
        document.getElementById('boardFoot').textContent =
          `${names.length} offering${names.length === 1 ? '' : 's'} · round at ${fmtTime(at)}`;
      })
      .catch(() => {});
  }

  // Board is a wall display: keep it fresh without anyone touching it
  setInterval(() => {
    const v = document.querySelector('.view.active');
    if (v && v.dataset.view === 'board') loadBoard();
  }, 30000);

  // ── Temple keeper (moderation) ──
  const LS_KEEPER = 'temple_keeper';

  const keeperKey = () => {
    try { return localStorage.getItem(LS_KEEPER) || ''; } catch (e) { return ''; }
  };

  function renderKeeperWall(wishes, count) {
    const wall = document.getElementById('keeperWall');
    document.getElementById('keeperCount').textContent =
      count ? `${count.toLocaleString()} wishes on the wall.` : '';
    if (!wishes.length) {
      wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">No wishes hang on the wall yet.</p>';
      return;
    }
    wall.innerHTML = wishes.map(w => `
      <div class="wish-plaque" data-id="${esc(w.id || '')}">
        <div class="wish-plaque-text">${esc(w.wish)}</div>
        <div class="wish-plaque-meta">${w.name ? esc(w.name) : '无名 Anonymous'} · ${new Date(w.ts).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })}</div>
        <button class="wish-remove" title="Take this wish down">✕</button>
      </div>`).join('');
  }

  function loadKeeperAltar() {
    const box = document.getElementById('keeperAltar');
    box.hidden = !keeperKey();
    if (box.hidden) return;
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const n = d.pendingCount || 0;
        document.getElementById('keeperRoundState').innerHTML = n
          ? `<strong class="gold-text">${n}</strong> name${n === 1 ? '' : 's'} waiting for the next round.`
          : 'Nobody is waiting. Nothing to offer right now.';
      })
      .catch(() => { document.getElementById('keeperRoundState').textContent = 'Could not read the round.'; });
  }

  function loadKeeperWall() {
    const wall = document.getElementById('keeperWall');
    const note = document.getElementById('keeperNote');
    loadKeeperAltar();
    document.getElementById('keeperWallTitle').hidden = !keeperKey();
    if (!keeperKey()) {
      wall.innerHTML = '';
      document.getElementById('keeperCount').textContent = '';
      note.textContent = 'The room is locked.';
      return;
    }
    note.textContent = 'Unlocked. Click ✕ on a plaque to take it down.';
    wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Reading the wall&hellip;</p>';
    fetch('/api/wishes?limit=200', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => renderKeeperWall(d.wishes || [], d.count || 0))
      .catch(() => { wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Could not read the wall.</p>'; });
  }

  function initKeeper() {
    const form = document.getElementById('keeperForm');
    const input = document.getElementById('keeperKey');
    const note = document.getElementById('keeperNote');
    const wall = document.getElementById('keeperWall');

    if (keeperKey()) input.value = keeperKey();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) {
        try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
        loadKeeperWall();
        return;
      }
      try { localStorage.setItem(LS_KEEPER, key); } catch (err) {}
      loadKeeperWall();
    });

    // Record a round the caretaker has already made at the altar
    document.getElementById('keeperRoundForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const rNote = document.getElementById('keeperRoundNote');
      const rBtn = document.getElementById('keeperRoundBtn');
      rBtn.disabled = true;
      rNote.textContent = 'Recording the round…';

      fetch('/api/offerings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-temple-key': keeperKey() },
        body: JSON.stringify({ clip: document.getElementById('keeperClip').value.trim() })
      })
        .then(r => {
          if (r.status === 401) {
            try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
            throw new Error('key');
          }
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(d => {
          rNote.textContent = d.offered
            ? `🪔 Round recorded — ${d.offered} offering${d.offered === 1 ? '' : 's'} now shown as made.`
            : 'Nobody was waiting, so nothing changed.';
          document.getElementById('keeperClip').value = '';
          // The blob listing trails the writes by a moment, so state the known
          // outcome now and reconcile shortly after
          document.getElementById('keeperRoundState').textContent =
            'Nobody is waiting. Nothing to offer right now.';
          setTimeout(loadKeeperAltar, 3000);
        })
        .catch(err => {
          rNote.textContent = err.message === 'key'
            ? 'That key was not accepted. Enter it again.'
            : 'Could not record the round — try again.';
        })
        .finally(() => { rBtn.disabled = false; });
    });

    wall.addEventListener('click', (e) => {
      const btn = e.target.closest('.wish-remove');
      if (!btn) return;
      const plaque = btn.closest('.wish-plaque');
      const id = plaque && plaque.dataset.id;
      if (!id) return;
      btn.disabled = true;
      plaque.classList.add('removing');

      fetch('/api/wishes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-temple-key': keeperKey() },
        body: JSON.stringify({ id })
      })
        .then(r => {
          if (r.status === 401) {
            try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
            throw new Error('key');
          }
          if (!r.ok) throw new Error(r.status);
          plaque.remove();
          note.textContent = 'Wish taken down.';
          wallLoaded = false; // public wall refetches on next visit
        })
        .catch(err => {
          plaque.classList.remove('removing');
          btn.disabled = false;
          note.textContent = err.message === 'key'
            ? 'That key was not accepted. Enter it again.'
            : 'Could not take that wish down — try again.';
        });
    });
  }

  // ── Init ──
  window.addEventListener('DOMContentLoaded', () => {
    initKauChim();
    initDreams();
    initChecker();
    initIncense();
    initDaily();
    initAltar();
    initPrayerWall();
    initKeeper();
  });

  return { hash, num4, dreamNumbers, numberInfo, numberDetail, normalizeNumber,
    loadWishes, loadKeeperWall, loadAltar, loadBoard, ALTAR, FORTUNES, DREAMS };
})();
