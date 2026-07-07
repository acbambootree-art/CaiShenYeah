/**
 * 4D Prediction Engine
 * Combines multiple statistical models to predict likely 4D numbers.
 *
 * Models:
 * 1. Weighted Frequency - Numbers that appear often, with recency bias
 * 2. Position-based - Predict likely digits per position
 * 3. Pattern Matching - Find numbers matching current statistical patterns
 * 4. Ensemble - Combine all models with confidence scoring
 */

const Predictor = (() => {

  /**
   * Model 1: Weighted Frequency with Recency Bias
   * More recent appearances get higher weight
   */
  function weightedFrequencyModel(results) {
    const scores = {};
    const totalDraws = results.length;

    results.forEach((r, idx) => {
      // Recency weight: more recent draws get higher weight
      const recencyWeight = 1 - (idx / totalDraws) * 0.7;

      const prizeWeights = {
        first: 3.0,
        second: 2.5,
        third: 2.0,
        starters: 1.0,
        consolation: 0.8
      };

      const addScore = (num, weight) => {
        if (!num) return;
        scores[num] = (scores[num] || 0) + weight * recencyWeight;
      };

      addScore(r.first, prizeWeights.first);
      addScore(r.second, prizeWeights.second);
      addScore(r.third, prizeWeights.third);
      (r.starters || []).forEach(n => addScore(n, prizeWeights.starters));
      (r.consolation || []).forEach(n => addScore(n, prizeWeights.consolation));
    });

    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([number, score]) => ({ number, score }));
  }

  /**
   * Model 2: Position-based Prediction
   * Analyze which digits are most likely in each position, then combine
   */
  function positionBasedModel(results) {
    const posFreq = Analysis.digitFrequencyByPosition(results);
    const candidates = [];

    // Generate numbers by picking top digits for each position
    const topDigits = posFreq.map(pos => {
      const total = pos.reduce((a, b) => a + b, 0);
      return pos.map((count, digit) => ({
        digit,
        probability: count / total
      })).sort((a, b) => b.probability - a.probability);
    });

    // Generate top combinations using top 4 digits per position
    const top = 4;
    for (let a = 0; a < top; a++) {
      for (let b = 0; b < top; b++) {
        for (let c = 0; c < top; c++) {
          for (let d = 0; d < top; d++) {
            const num = `${topDigits[0][a].digit}${topDigits[1][b].digit}${topDigits[2][c].digit}${topDigits[3][d].digit}`;
            const score = topDigits[0][a].probability *
                          topDigits[1][b].probability *
                          topDigits[2][c].probability *
                          topDigits[3][d].probability * 10000;
            candidates.push({ number: num, score });
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Model 3: Pattern Matching
   * Find numbers that match current statistical patterns (sum range, odd/even ratio)
   */
  function patternMatchModel(results) {
    const topNumbers = Analysis.getTopPrizeNumbers(results);

    // Calculate ideal sum range (middle 50% of historical sums)
    const sums = topNumbers.map(n => n.split('').reduce((a, d) => a + parseInt(d), 0));
    sums.sort((a, b) => a - b);
    const q1 = sums[Math.floor(sums.length * 0.25)];
    const q3 = sums[Math.floor(sums.length * 0.75)];

    // Calculate ideal odd/even ratio
    const oddCounts = topNumbers.map(n => n.split('').filter(d => parseInt(d) % 2 === 1).length);
    const avgOdd = oddCounts.reduce((a, b) => a + b, 0) / oddCounts.length;

    // Score numbers from frequency model based on pattern match
    const freqResults = weightedFrequencyModel(results);
    const maxFreqScore = freqResults[0]?.score || 1;

    return freqResults.map(({ number, score }) => {
      const digits = number.split('').map(Number);
      const sum = digits.reduce((a, b) => a + b, 0);
      const oddCount = digits.filter(d => d % 2 === 1).length;

      let patternScore = score / maxFreqScore;

      // Bonus for being in ideal sum range
      if (sum >= q1 && sum <= q3) patternScore *= 1.3;

      // Bonus for matching odd/even pattern
      const oddDiff = Math.abs(oddCount - avgOdd);
      if (oddDiff <= 0.5) patternScore *= 1.2;
      else if (oddDiff <= 1) patternScore *= 1.1;

      return { number, score: patternScore };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Model 4: Due Number Model
   * Numbers that historically appear frequently but haven't appeared recently
   */
  function dueNumberModel(results) {
    const coldNums = Analysis.coldNumbers(results, 20);
    return coldNums.map(n => ({
      number: n.number,
      score: n.historicalCount / (n.drawsSinceLastSeen + 1)
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Ensemble: Combine all models
   * Returns top N predictions with confidence scores
   */
  function predict(results, topN = 20) {
    const models = [
      { name: 'Weighted Frequency', results: weightedFrequencyModel(results), weight: 0.35 },
      { name: 'Position-based', results: positionBasedModel(results), weight: 0.25 },
      { name: 'Pattern Match', results: patternMatchModel(results), weight: 0.25 },
      { name: 'Due Numbers', results: dueNumberModel(results), weight: 0.15 }
    ];

    const combined = {};

    models.forEach(model => {
      const maxScore = model.results[0]?.score || 1;

      model.results.slice(0, 200).forEach((item, rank) => {
        const normalizedScore = (item.score / maxScore) * model.weight;
        const rankBonus = model.weight * (1 - rank / 200) * 0.1;

        if (!combined[item.number]) {
          combined[item.number] = { number: item.number, totalScore: 0, modelHits: 0, models: [] };
        }
        combined[item.number].totalScore += normalizedScore + rankBonus;
        combined[item.number].modelHits++;
        combined[item.number].models.push(model.name);
      });
    });

    // Bonus for appearing in multiple models
    Object.values(combined).forEach(item => {
      if (item.modelHits >= 3) item.totalScore *= 1.3;
      else if (item.modelHits >= 2) item.totalScore *= 1.15;
    });

    const ranked = Object.values(combined)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, topN);

    // Normalize to confidence percentage
    const maxTotal = ranked[0]?.totalScore || 1;
    return ranked.map((item, idx) => ({
      rank: idx + 1,
      number: item.number,
      confidence: Math.min(99, (item.totalScore / maxTotal * 85 + 10)).toFixed(1),
      modelHits: item.modelHits,
      models: item.models
    }));
  }

  /**
   * Get next draw info
   */
  function getNextDrawInfo(results) {
    const latestDraw = results[0];
    if (!latestDraw) return null;

    const nextDrawNo = latestDraw.drawNo + 1;

    // Next draw date: advance to the next Wed (3), Sat (6), or Sun (0)
    const lastDate = new Date(latestDraw.date);
    let nextDate = new Date(lastDate);
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (![0, 3, 6].includes(nextDate.getDay()));

    return {
      drawNo: nextDrawNo,
      date: nextDate.toISOString().split('T')[0],
      dateFormatted: nextDate.toLocaleDateString('en-SG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    };
  }

  /**
   * Walk-forward backtest of a single draw: predict topN using ONLY draws
   * older than results[idx], then record which predictions actually won.
   */
  function backtestDraw(results, idx, topN = 100) {
    const draw = results[idx];
    const predictions = predict(results.slice(idx + 1), topN);

    const prizeOf = {};
    if (draw.first) prizeOf[draw.first] = '1st Prize';
    if (draw.second) prizeOf[draw.second] = '2nd Prize';
    if (draw.third) prizeOf[draw.third] = '3rd Prize';
    (draw.starters || []).forEach(n => { if (!prizeOf[n]) prizeOf[n] = 'Starter'; });
    (draw.consolation || []).forEach(n => { if (!prizeOf[n]) prizeOf[n] = 'Consolation'; });

    const hits = predictions
      .filter(p => prizeOf[p.number])
      .map(p => ({
        drawNo: draw.drawNo,
        date: draw.date,
        number: p.number,
        prizeType: prizeOf[p.number],
        rank: p.rank,
        confidence: p.confidence
      }));

    return { drawNo: draw.drawNo, date: draw.date, topN, hits };
  }

  /**
   * P(X >= k) for X ~ Poisson(lambda): the chance of seeing k or more hits
   * from pure luck. Small values (< 0.01) would indicate real predictive skill.
   */
  function poissonTail(k, lambda) {
    let p = Math.exp(-lambda), cum = 0;
    for (let i = 0; i < k; i++) { cum += p; p *= lambda / (i + 1); }
    return Math.max(0, Math.min(1, 1 - cum));
  }

  /**
   * Summarize backtestDraw results at a given list size: hits vs the number
   * expected by chance (23 winning numbers per draw out of 10,000).
   */
  function backtestStats(perDraw, listSize) {
    const tested = perDraw.length;
    let anyHits = 0, top3Hits = 0;
    perDraw.forEach(d => d.hits.forEach(h => {
      if (h.rank <= listSize) {
        anyHits++;
        if (h.prizeType === '1st Prize' || h.prizeType === '2nd Prize' || h.prizeType === '3rd Prize') top3Hits++;
      }
    }));
    const anyExpected = tested * listSize * 23 / 10000;
    const top3Expected = tested * listSize * 3 / 10000;
    return {
      tested, listSize,
      anyHits, anyExpected, anyPValue: poissonTail(anyHits, anyExpected),
      top3Hits, top3Expected, top3PValue: poissonTail(top3Hits, top3Expected)
    };
  }

  function validatePredictions(results, topN = 100, drawsToCheck = 20) {
    const hits = [];
    for (let idx = 0; idx < Math.min(drawsToCheck, results.length - 10); idx++) {
      hits.push(...backtestDraw(results, idx, topN).hits);
    }
    return hits;
  }

  return {
    weightedFrequencyModel,
    positionBasedModel,
    patternMatchModel,
    dueNumberModel,
    predict,
    getNextDrawInfo,
    validatePredictions,
    backtestDraw,
    backtestStats,
    poissonTail
  };
})();
