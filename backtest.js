/**
 * 4D Predictor Backtest (CLI)
 * Measures real predictive accuracy: for each historical draw, trains the
 * predictor on all prior draws only, predicts topN numbers, and counts hits
 * among that draw's 23 winning numbers. Compares against the expected hit
 * count under pure chance (topN * 23/10000 per draw) with a Poisson p-value.
 *
 * Usage: node backtest.js [topN...]              (default: 10 20 50 100)
 *        BACKTEST_DRAWS=all node backtest.js 20  (test every draw, slower)
 */
const fs = require('fs');
const path = require('path');

const results = JSON.parse(fs.readFileSync(path.join(__dirname, '4d_results.json'), 'utf8'));

// Load the site's browser modules (IIFEs assigned to consts)
eval(fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8').replace('const Analysis', 'globalThis.Analysis'));
eval(fs.readFileSync(path.join(__dirname, 'js/predictor.js'), 'utf8').replace('const Predictor', 'globalThis.Predictor'));

const MIN_TRAIN = 60; // minimum prior draws required before testing a draw
const drawsEnv = process.env.BACKTEST_DRAWS || '500';
const maxDraws = drawsEnv === 'all' ? Infinity : parseInt(drawsEnv, 10);

function backtest(topN) {
  const perDraw = [];
  const limit = Math.min(maxDraws, results.length - MIN_TRAIN);
  for (let idx = 0; idx < limit; idx++) {
    perDraw.push(Predictor.backtestDraw(results, idx, topN));
  }
  const s = Predictor.backtestStats(perDraw, topN);
  console.log(`\ntopN=${topN} — walk-forward over ${s.tested} draws (trained only on data before each draw):`);
  console.log(`  any prize : ${s.anyHits} hits vs ${s.anyExpected.toFixed(1)} expected by chance  (p=${s.anyPValue.toFixed(3)})`);
  console.log(`  top 3     : ${s.top3Hits} hits vs ${s.top3Expected.toFixed(1)} expected by chance  (p=${s.top3PValue.toFixed(3)})`);
}

const topNs = process.argv.slice(2).map(Number).filter(n => n > 0);
(topNs.length ? topNs : [10, 20, 50, 100]).forEach(backtest);

console.log('\nA model only beats chance if hits consistently exceed expected with small p (< 0.01) out of sample.');
