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
  window.addEventListener('DOMContentLoaded', () => {
    renderHeroStats();
    renderCountdown();
    renderPredictions();
    renderDigitFreqChart();
    renderPositionChart();
    renderSumChart();
    renderOddEvenChart();
    renderHotCold();
    renderResultsTable();
    renderPairAnalysis();
    renderGapAnalysis();
    initNav();
    hideLoading();
  });

  // ── Loading ──
  function hideLoading() {
    setTimeout(() => {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }, 800);
  }

  // ── Mobile Nav ──
  function initNav() {
    document.getElementById('navToggle').addEventListener('click', () => {
      document.getElementById('nav').classList.toggle('open');
    });
    document.querySelectorAll('.nav a').forEach(a => {
      a.addEventListener('click', () => document.getElementById('nav').classList.remove('open'));
    });
  }

  // ── Hero Stats ──
  function renderHeroStats() {
    document.getElementById('totalDraws').textContent = results.length;
    const totalNums = results.length * 23; // 3 prizes + 10 starters + 10 consolation
    document.getElementById('totalNumbers').textContent = totalNums.toLocaleString();
  }

  // ── Countdown ──
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

      document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
      document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
      document.getElementById('cd-mins').textContent = String(mins).padStart(2, '0');
      document.getElementById('cd-secs').textContent = String(secs).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
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
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

})();
