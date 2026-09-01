/**
 * 4D Oracle - App Controller
 * Wires together data, analysis, prediction, and UI rendering.
 */

(function () {
  'use strict';

  const results = HISTORICAL_RESULTS;

  // ── Chart.js global defaults ──
  Chart.defaults.color = '#a0a0a0';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const GOLD = '#d4af37';
  const GOLD_LIGHT = '#f0d060';
  const GOLD_DARK = '#a88a2a';
  const RED = '#ff4444';
  const BLUE = '#4488ff';
  const GREEN = '#44ff88';

  // ── Init ──
  // Courtyard + halls: only the cheap, always-visible work runs at load.
  // Chart/backtest halls initialize on first entry (lazy, and Chart.js needs
  // a visible container to size itself anyway).
  window.addEventListener('DOMContentLoaded', () => {
    renderDoorTeasers();
    renderCountdown();
    renderResultsTable();
    initRouter();
    initGate();
    initSoundUI();
    initEmbers();
    hideLoading();
  });

  // ── Temple gate ──
  // You enter through the doors every visit: it is the site's signature, and
  // that push is also the gesture browsers require before any audio may play.
  function initGate() {
    const gate = document.getElementById('templeGate');
    gate.hidden = false;
    // Swap in the generated door art when the asset exists
    const art = new Image();
    art.onload = () => gate.classList.add('gate-art');
    art.src = 'gate.jpg';
    document.getElementById('gateEnter').addEventListener('click', () => {
      Sound.arm();
      Sound.gong();
      gate.classList.add('open');
      setTimeout(() => gate.remove(), 2000);
    }, { once: true });
  }

  // ── Sound toggle + ritual tap sounds ──
  function initSoundUI() {
    const btn = document.getElementById('soundToggle');
    const paint = (on) => { btn.textContent = on ? '🔔' : '🔕'; };
    paint(Sound.enabled());
    btn.addEventListener('click', () => paint(Sound.toggle()));

    // Wood-fish tok on temple taps (chips, doors, tabs, buttons)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.dream-chip, .door, .tabbar a, .nav a, .temple-btn')) Sound.tok();
    });
  }

  // ── Courtyard embers ──
  function initEmbers() {
    const canvas = document.getElementById('embersCanvas');
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx2d = canvas.getContext('2d');
    const N = 36;
    let parts = [];
    let running = false;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function spawn(y) {
      return {
        x: Math.random() * canvas.width,
        y: y !== undefined ? y : Math.random() * canvas.height,
        r: 0.8 + Math.random() * 2,
        vy: 0.15 + Math.random() * 0.45,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 0.2 + Math.random() * 0.5,
        a: 0.15 + Math.random() * 0.5
      };
    }

    function frame() {
      if (!running) return;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.y -= p.vy;
        p.sway += 0.012;
        p.x += Math.sin(p.sway) * p.swayAmp;
        if (p.y < -6) Object.assign(p, spawn(canvas.height + 6));
        const flicker = p.a * (0.75 + 0.25 * Math.sin(p.sway * 3));
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(240, 208, 96, ${flicker})`;
        ctx2d.shadowColor = 'rgba(212, 175, 55, 0.8)';
        ctx2d.shadowBlur = 6;
        ctx2d.fill();
      }
      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      parts = Array.from({ length: N }, () => spawn());
      requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    window.addEventListener('resize', () => { if (running) resize(); });
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : maybeRun();
    });
    embersControl = maybeRun;

    function maybeRun() {
      const home = document.querySelector('.view-home').classList.contains('active');
      home && !document.hidden ? start() : stop();
    }
    maybeRun();
  }

  let embersControl = null;

  // ── Hall router ──
  // 'keeper' and 'board' are routable but unlisted: moderation at #/keeper,
  // and #/board is the display that stands beside the real altar
  const HALLS = ['home', 'ask', 'incense', 'dreams', 'check', 'oracle', 'patterns', 'keeper', 'board'];
  // Old #anchor deep links land in the hall that now holds that section
  const LEGACY = {
    kauchim: 'ask', daily: 'ask', dreams: 'dreams', checker: 'check',
    history: 'check', 'proven-winners': 'oracle', predictions: 'oracle',
    performance: 'oracle', fairness: 'oracle', analysis: 'patterns',
    hotcold: 'patterns', statistics: 'patterns'
  };
  const hallInited = {};

  function initHall(hall) {
    if (hallInited[hall]) return;
    hallInited[hall] = true;
    if (hall === 'oracle') {
      renderPredictions();
      renderDrawFairness();
      runBacktest();
    } else if (hall === 'patterns') {
      renderDigitFreqChart();
      renderPositionChart();
      renderSumChart();
      renderOddEvenChart();
      renderHotCold();
      renderPairAnalysis();
      renderGapAnalysis();
    }
  }

  function currentHall() {
    const h = location.hash.replace(/^#\/?/, '');
    if (HALLS.includes(h)) return h;
    if (LEGACY[h]) return LEGACY[h];
    return 'home';
  }

  let lastHall = null;

  function showHall(hall) {
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('active', v.dataset.view === hall));
    document.querySelectorAll('[data-nav]').forEach(a =>
      a.classList.toggle('active', a.dataset.nav === hall));
    document.body.classList.toggle('at-home', hall === 'home');
    window.scrollTo(0, 0);
    initHall(hall);
    if (hall === 'incense') { Temple.loadWishes(); Temple.loadAltar(); } // idempotent; retries after a failed load
    if (hall === 'keeper') Temple.loadKeeperWall();
    if (hall === 'board') Temple.loadBoard();
    document.body.classList.toggle('board-mode', hall === 'board');
    if (lastHall !== null && hall !== lastHall && hall !== 'home') Sound.gong();
    lastHall = hall;
    if (embersControl) embersControl();
  }

  function initRouter() {
    window.addEventListener('hashchange', () => showHall(currentHall()));
    showHall(currentHall());
  }

  // ── Courtyard door teasers ──
  function renderDoorTeasers() {
    document.getElementById('totalDraws').textContent = results.length.toLocaleString();

    const latest = results[0];
    document.getElementById('doorTeaseCheck').textContent =
      `Latest: Draw #${latest.drawNo} · ${formatDate(latest.date)}`;

    let askTease = 'The sticks await you';
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
      const stick = JSON.parse(localStorage.getItem('temple_kauchim') || 'null');
      const incense = JSON.parse(localStorage.getItem('temple_incense') || 'null');
      if (stick && stick.date === today) askTease = `Today's stick: 第 ${stick.n} 签`;
      if (incense && incense.date === today) {
        document.getElementById('doorTeaseIncense').textContent =
          `🔥 Lit today · ${incense.streak}-day streak of devotion`;
      }
    } catch (e) {}
    document.getElementById('doorTeaseAsk').textContent = askTease;
  }

  // ── Loading ──
  function hideLoading() {
    setTimeout(() => {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }, 800);
  }

  // ── Countdown chip (header, always visible) ──
  function renderCountdown() {
    const nextDraw = Predictor.getNextDrawInfo(results);
    if (!nextDraw) return;

    document.getElementById('nextDrawLabel').textContent = `Draw #${nextDraw.drawNo}`;

    function update() {
      // Next draw at 6:30 PM SGT
      const target = new Date(nextDraw.date + 'T18:30:00+08:00');
      const now = new Date();
      let diff = target - now;

      // If past, find next draw
      if (diff < 0) {
        const d = new Date(target);
        const day = d.getDay();
        if (day === 0) d.setDate(d.getDate() + 3);
        else if (day === 3) d.setDate(d.getDate() + 3);
        else if (day === 6) d.setDate(d.getDate() + 1);
        else d.setDate(d.getDate() + (3 - day + 7) % 7);
        diff = d - now;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      document.getElementById('countdownCompact').textContent =
        days > 0 ? `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
                 : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }

    update();
    setInterval(update, 1000);
  }

  // ── Walk-forward Backtest (feeds Proven Winners + Model Performance) ──
  const BACKTEST_DRAWS = 50;   // draws measured for performance stats
  const WINNERS_DRAWS = 20;    // draws displayed in Proven Winners
  const BACKTEST_TOPN = 100;

  function runBacktest() {
    const total = Math.min(BACKTEST_DRAWS, Math.max(0, results.length - 60));
    const winnersContainer = document.getElementById('provenWinnersContent');
    if (!total) {
      winnersContainer.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Not enough historical data yet.</p>';
      return;
    }
    winnersContainer.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Verifying predictions against past draws&hellip;</p>';

    const perDraw = [];
    let idx = 0;

    // One draw per tick, yielding to the event loop between each. Each
    // backtestDraw retrains over the full history (~0.25s on 5k+ draws),
    // so a larger chunk would visibly stutter the page.
    function step() {
      perDraw.push(Predictor.backtestDraw(results, idx, BACKTEST_TOPN));
      idx++;
      const bar = document.getElementById('performanceProgressBar');
      const txt = document.getElementById('performanceProgressText');
      if (bar) bar.style.width = `${(idx / total) * 100}%`;
      if (txt) txt.textContent = `Backtesting draw ${idx} of ${total}…`;

      if (idx < total) {
        setTimeout(step, 0);
      } else {
        renderProvenWinners(perDraw);
        renderModelPerformance(perDraw);
      }
    }
    step();
  }

  // ── Model Performance ──
  function renderModelPerformance(perDraw) {
    const container = document.getElementById('performanceContent');
    const stats = [20, 100].map(n => Predictor.backtestStats(perDraw, n));

    const verdict = (p) => {
      if (p < 0.01) return { label: 'Beating chance', cls: 'badge-hot' };
      if (p < 0.1) return { label: 'Above chance — not significant', cls: 'badge-model' };
      return { label: 'Consistent with chance', cls: 'badge-cold' };
    };

    const row = (label, hits, expected, p) => {
      const v = verdict(p);
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="color:var(--white-muted);">${label}</div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div><strong class="gold-text">${hits}</strong> hits vs <strong>${expected.toFixed(1)}</strong> expected by chance</div>
            <div style="color:var(--white-muted);font-size:0.85rem;">p = ${p.toFixed(2)}</div>
            <span class="badge ${v.cls}">${v.label}</span>
          </div>
        </div>`;
    };

    const [s20, s100] = stats;
    container.innerHTML = `
      ${row('Top 20 picks &middot; any prize', s20.anyHits, s20.anyExpected, s20.anyPValue)}
      ${row('Top 20 picks &middot; 1st/2nd/3rd prize', s20.top3Hits, s20.top3Expected, s20.top3PValue)}
      ${row('Top 100 picks &middot; any prize', s100.anyHits, s100.anyExpected, s100.anyPValue)}
      ${row('Top 100 picks &middot; 1st/2nd/3rd prize', s100.top3Hits, s100.top3Expected, s100.top3PValue)}
      <p style="color:var(--white-muted);font-size:0.85rem;margin-top:14px;">
        Measured over the last <span class="gold-text">${s20.tested} draws</span>, each predicted using only draws that came before it.
        The p-value is the probability of scoring at least this many hits by pure luck &mdash; only consistent p &lt; 0.01 would demonstrate real predictive skill.
      </p>`;
  }

  // ── Draw Fairness ──
  function renderDrawFairness() {
    const f = Analysis.drawFairness(results);

    const verdictEl = document.getElementById('fairnessVerdict');
    verdictEl.textContent = f.fair ? 'UNIFORM ✓' : 'BIAS DETECTED';
    verdictEl.className = `badge ${f.fair ? 'badge-cold' : 'badge-hot'}`;

    document.getElementById('fairnessPositions').innerHTML = f.positions.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="color:var(--white-muted);">Position ${p.position}</div>
        <div style="display:flex;align-items:center;gap:14px;">
          <span>&chi;&sup2; = ${p.chi2.toFixed(1)}</span>
          <span style="color:var(--white-muted);">p = ${p.pValue.toFixed(3)}</span>
          <span class="badge ${p.pass ? 'badge-cold' : 'badge-hot'}">${p.pass ? 'PASS' : 'FAIL'}</span>
        </div>
      </div>`).join('');

    const covDiff = ((f.distinct - f.expectedDistinct) / f.expectedDistinct * 100);
    document.getElementById('fairnessCoverage').innerHTML = `
      <div style="display:flex;gap:32px;flex-wrap:wrap;margin:14px 0;">
        <div>
          <div style="font-size:2rem;font-weight:700;" class="gold-text">${f.distinct.toLocaleString()}</div>
          <div style="color:var(--white-muted);font-size:0.85rem;">distinct numbers drawn</div>
        </div>
        <div>
          <div style="font-size:2rem;font-weight:700;">${Math.round(f.expectedDistinct).toLocaleString()}</div>
          <div style="color:var(--white-muted);font-size:0.85rem;">expected if perfectly uniform</div>
        </div>
      </div>
      <p style="color:var(--white-muted);font-size:0.85rem;">
        Across ${f.totalNumbers.toLocaleString()} winning numbers, coverage is within
        <span class="gold-text">${Math.abs(covDiff).toFixed(1)}%</span> of the uniform-draw expectation
        &mdash; ${f.fair ? 'no detectable bias in the Singapore Pools draw.' : 'a deviation worth investigating.'}
      </p>`;
  }

  // ── Proven Winners ──
  function renderProvenWinners(perDraw) {
    const hits = perDraw.slice(0, WINNERS_DRAWS).flatMap(d => d.hits);
    const container = document.getElementById('provenWinnersContent');

    if (hits.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--white-muted);">No matches found in recent draws. Check back after the next draw!</p>';
      return;
    }

    const prizeClass = (type) => {
      if (type === '1st Prize') return 'prize-1st';
      if (type === '2nd Prize') return 'prize-2nd';
      if (type === '3rd Prize') return 'prize-3rd';
      if (type === 'Starter') return 'prize-starter';
      return 'prize-consolation';
    };

    const prizeIcon = (type) => {
      if (type === '1st Prize') return '🥇';
      if (type === '2nd Prize') return '🥈';
      if (type === '3rd Prize') return '🥉';
      return '✅';
    };

    container.innerHTML = `
      <div class="winners-grid">
        ${hits.map(h => `
          <div class="winner-card animate-in ${prizeClass(h.prizeType)}">
            <div class="winner-draw">Draw #${h.drawNo} &middot; ${formatDate(h.date)}</div>
            <div class="winner-number">${h.number}</div>
            <div class="winner-prize">${prizeIcon(h.prizeType)} ${h.prizeType}</div>
            <div class="winner-meta">
              Predicted Rank <strong>#${h.rank}</strong> &middot; ${h.confidence}% confidence
            </div>
          </div>
        `).join('')}
      </div>
      <p style="text-align:center;color:var(--white-muted);font-size:0.85rem;margin-top:16px;">
        Showing matches from our <span class="gold-text">top 100 predictions</span> against the last 20 draws
      </p>
    `;
  }

  // ── Predictions ──
  function renderPredictions() {
    const predictions = Predictor.predict(results, 16);
    const grid = document.getElementById('predictionsGrid');
    grid.innerHTML = '';

    predictions.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = `prediction-card animate-in${i < 3 ? ' top-3' : ''}`;
      card.innerHTML = `
        <div class="rank">#${p.rank}</div>
        <div class="number">${p.number}</div>
        <div class="confidence"><strong>${p.confidence}%</strong> confidence</div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;">
          ${p.models.map(m => `<span class="badge badge-model" style="font-size:0.6rem;padding:2px 6px;">${m.split(' ')[0]}</span>`).join('')}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // ── Digit Frequency Chart ──
  function renderDigitFreqChart() {
    const freq = Analysis.overallDigitFrequency(results);
    const ctx = document.getElementById('digitFreqChart').getContext('2d');

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: freq.map(f => f.digit),
        datasets: [{
          label: 'Frequency',
          data: freq.map(f => f.count),
          backgroundColor: freq.map((f, i) => {
            const max = Math.max(...freq.map(x => x.count));
            const ratio = f.count / max;
            return `rgba(212, 175, 55, ${0.3 + ratio * 0.7})`;
          }),
          borderColor: GOLD,
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            borderColor: GOLD_DARK,
            borderWidth: 1,
            titleColor: GOLD,
            bodyColor: '#f5f5f5',
            callbacks: {
              label: (ctx) => `Count: ${ctx.raw} (${freq[ctx.dataIndex].percentage}%)`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono'" } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  // ── Position Heatmap Chart ──
  function renderPositionChart() {
    const posFreq = Analysis.digitFrequencyByPosition(results);
    const ctx = document.getElementById('positionChart').getContext('2d');

    const datasets = [];
    for (let pos = 0; pos < 4; pos++) {
      const colors = ['#d4af37', '#f0d060', '#a88a2a', '#fff8e1'];
      datasets.push({
        label: `Position ${pos + 1}`,
        data: posFreq[pos],
        backgroundColor: colors[pos] + '99',
        borderColor: colors[pos],
        borderWidth: 1,
        borderRadius: 4
      });
    }

    new Chart(ctx, {
      type: 'bar',
      data: { labels: [0,1,2,3,4,5,6,7,8,9], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 16, color: '#a0a0a0' } },
          tooltip: { backgroundColor: '#1a1a1a', borderColor: GOLD_DARK, borderWidth: 1, titleColor: GOLD }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono'" } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  // ── Sum Distribution Chart ──
  function renderSumChart() {
    const sums = Analysis.sumAnalysis(results);
    const ctx = document.getElementById('sumChart').getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: sums.map(s => s.sum),
        datasets: [{
          label: 'Count',
          data: sums.map(s => s.count),
          borderColor: GOLD,
          backgroundColor: 'rgba(212,175,55,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: GOLD,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1a1a1a', borderColor: GOLD_DARK, borderWidth: 1, titleColor: GOLD }
        },
        scales: {
          x: { title: { display: true, text: 'Digit Sum', color: '#a0a0a0' }, grid: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  // ── Odd/Even Chart ──
  function renderOddEvenChart() {
    const oe = Analysis.oddEvenAnalysis(results);
    const ctx = document.getElementById('oddEvenChart').getContext('2d');

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: oe.map(o => o.label),
        datasets: [{
          data: oe.map(o => o.count),
          backgroundColor: [
            'rgba(68,136,255,0.8)',
            'rgba(68,136,255,0.5)',
            'rgba(212,175,55,0.7)',
            'rgba(255,68,68,0.5)',
            'rgba(255,68,68,0.8)'
          ],
          borderColor: '#1a1a1a',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, color: '#a0a0a0' } },
          tooltip: {
            backgroundColor: '#1a1a1a',
            borderColor: GOLD_DARK,
            borderWidth: 1,
            titleColor: GOLD,
            callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} (${oe[ctx.dataIndex].percentage}%)` }
          }
        }
      }
    });
  }

  // ── Hot & Cold Pills ──
  function renderHotCold() {
    const hot = Analysis.hotNumbers(results, 20);
    const cold = Analysis.coldNumbers(results, 20);

    const hotContainer = document.getElementById('hotPills');
    hotContainer.innerHTML = hot.slice(0, 15).map(h =>
      `<span class="number-pill hot">${h.number} <small style="opacity:0.6">×${h.count}</small></span>`
    ).join('');

    const coldContainer = document.getElementById('coldPills');
    coldContainer.innerHTML = cold.slice(0, 15).map(c =>
      `<span class="number-pill cold">${c.number} <small style="opacity:0.6">${c.drawsSinceLastSeen}d ago</small></span>`
    ).join('');
  }

  // ── Results Table ──
  function renderResultsTable() {
    const recent = Analysis.recentResults(results, 15);
    const tbody = document.getElementById('resultsBody');

    tbody.innerHTML = recent.map(r => {
      const starters = (r.starters || []).slice(0, 5).join(', ');
      return `<tr>
        <td>#${r.drawNo}</td>
        <td class="draw-date">${formatDate(r.date)}</td>
        <td class="prize-num first-prize">${r.first}</td>
        <td class="prize-num">${r.second}</td>
        <td class="prize-num">${r.third}</td>
        <td style="font-family:var(--font-mono);font-size:0.8rem;">${starters}...</td>
      </tr>`;
    }).join('');
  }

  // ── Pair Analysis Bars ──
  function renderPairAnalysis() {
    const pairs = Analysis.pairAnalysis(results);
    const container = document.getElementById('pairBars');
    const maxCount = pairs[0]?.count || 1;

    container.innerHTML = pairs.slice(0, 10).map(p => {
      const width = (p.count / maxCount * 100).toFixed(0);
      return `<div class="stat-bar-item">
        <div class="stat-bar-label" style="font-family:var(--font-mono);">${p.pair[0]}-${p.pair[1]}</div>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:${width}%">
            <span class="stat-bar-value">${p.count}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Gap Analysis Bars ──
  function renderGapAnalysis() {
    const gaps = Analysis.gapAnalysis(results);
    const container = document.getElementById('gapBars');
    const maxGap = Math.max(...gaps.slice(0, 10).map(g => parseFloat(g.avgGap)));

    container.innerHTML = gaps.slice(0, 10).map(g => {
      const width = (parseFloat(g.avgGap) / maxGap * 100).toFixed(0);
      return `<div class="stat-bar-item">
        <div class="stat-bar-label" style="font-family:var(--font-mono);">${g.number}</div>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:${width}%">
            <span class="stat-bar-value">${g.avgGap} draws</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Helpers ──
  const isMobile = window.innerWidth <= 768;

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isMobile) {
      return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    }
    return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

})();
