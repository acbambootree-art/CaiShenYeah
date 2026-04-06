/**
 * 4D Analysis Engine
 * Performs frequency analysis, pattern detection, and statistical modeling
 * on Singapore Pools 4D historical results.
 */

const Analysis = (() => {
  /**
   * Count frequency of each digit (0-9) in each position (0-3)
   */
  function digitFrequencyByPosition(results) {
    const freq = Array.from({ length: 4 }, () => Array(10).fill(0));
    const numbers = getAllWinningNumbers(results);

    numbers.forEach(num => {
      for (let pos = 0; pos < 4; pos++) {
        const digit = parseInt(num[pos]);
        freq[pos][digit]++;
      }
    });

    return freq;
  }

  /**
   * Get all winning numbers from results (1st, 2nd, 3rd, starters, consolation)
   */
  function getAllWinningNumbers(results) {
    const numbers = [];
    results.forEach(r => {
      if (r.first) numbers.push(r.first);
      if (r.second) numbers.push(r.second);
      if (r.third) numbers.push(r.third);
      if (r.starters) numbers.push(...r.starters);
      if (r.consolation) numbers.push(...r.consolation);
    });
    return numbers;
  }

  /**
   * Get only top 3 prize numbers
   */
  function getTopPrizeNumbers(results) {
    const numbers = [];
    results.forEach(r => {
      if (r.first) numbers.push(r.first);
      if (r.second) numbers.push(r.second);
      if (r.third) numbers.push(r.third);
    });
    return numbers;
  }

  /**
   * Number frequency - how often each 4-digit number appears across all prizes
   */
  function numberFrequency(results) {
    const freq = {};
    const numbers = getAllWinningNumbers(results);

    numbers.forEach(num => {
      freq[num] = (freq[num] || 0) + 1;
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([number, count]) => ({ number, count }));
  }

  /**
   * Hot numbers - most frequently drawn in recent N draws
   */
  function hotNumbers(results, recentDraws = 30) {
    const recent = results.slice(0, recentDraws);
    return numberFrequency(recent).slice(0, 20);
  }

  /**
   * Cold numbers - least frequently drawn (numbers that appeared but are overdue)
   */
  function coldNumbers(results, recentDraws = 30) {
    const recent = results.slice(0, recentDraws);
    const all = results.slice(0, Math.min(results.length, 100));

    const recentFreq = {};
    getAllWinningNumbers(recent).forEach(n => {
      recentFreq[n] = (recentFreq[n] || 0) + 1;
    });

    const allFreq = {};
    getAllWinningNumbers(all).forEach(n => {
      allFreq[n] = (allFreq[n] || 0) + 1;
    });

    // Numbers that appeared historically but not recently
    const cold = [];
    for (const [num, count] of Object.entries(allFreq)) {
      if (!recentFreq[num]) {
        cold.push({ number: num, historicalCount: count, drawsSinceLastSeen: findLastSeen(results, num) });
      }
    }

    return cold.sort((a, b) => b.historicalCount - a.historicalCount).slice(0, 20);
  }

  /**
   * Find how many draws since a number was last seen
   */
  function findLastSeen(results, number) {
    for (let i = 0; i < results.length; i++) {
      const all = [
        results[i].first, results[i].second, results[i].third,
        ...(results[i].starters || []),
        ...(results[i].consolation || [])
      ];
      if (all.includes(number)) return i;
    }
    return results.length;
  }

  /**
   * Digit pair frequency - how often pairs of digits appear together
   */
  function pairAnalysis(results) {
    const pairs = {};
    const numbers = getAllWinningNumbers(results);

    numbers.forEach(num => {
      const digits = num.split('');
      for (let i = 0; i < digits.length; i++) {
        for (let j = i + 1; j < digits.length; j++) {
          const pair = [digits[i], digits[j]].sort().join('');
          pairs[pair] = (pairs[pair] || 0) + 1;
        }
      }
    });

    return Object.entries(pairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([pair, count]) => ({ pair, count }));
  }

  /**
   * Odd/Even ratio analysis
   */
  function oddEvenAnalysis(results) {
    const ratios = { '0odd': 0, '1odd': 0, '2odd': 0, '3odd': 0, '4odd': 0 };
    const numbers = getTopPrizeNumbers(results);

    numbers.forEach(num => {
      const oddCount = num.split('').filter(d => parseInt(d) % 2 === 1).length;
      ratios[oddCount + 'odd']++;
    });

    const total = numbers.length;
    return Object.entries(ratios).map(([key, count]) => ({
      label: key.replace('odd', ' Odd'),
      count,
      percentage: ((count / total) * 100).toFixed(1)
    }));
  }

  /**
   * Sum analysis - distribution of digit sums
   */
  function sumAnalysis(results) {
    const sums = {};
    const numbers = getTopPrizeNumbers(results);

    numbers.forEach(num => {
      const sum = num.split('').reduce((acc, d) => acc + parseInt(d), 0);
      sums[sum] = (sums[sum] || 0) + 1;
    });

    return Object.entries(sums)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([sum, count]) => ({ sum: parseInt(sum), count }));
  }

  /**
   * Gap analysis - average draws between number appearances
   */
  function gapAnalysis(results) {
    const lastSeen = {};
    const gaps = {};

    for (let i = results.length - 1; i >= 0; i--) {
      const r = results[i];
      const numbers = [r.first, r.second, r.third, ...(r.starters || []), ...(r.consolation || [])];

      numbers.forEach(num => {
        if (lastSeen[num] !== undefined) {
          if (!gaps[num]) gaps[num] = [];
          gaps[num].push(lastSeen[num] - i);
        }
        lastSeen[num] = i;
      });
    }

    const avgGaps = Object.entries(gaps)
      .filter(([, g]) => g.length >= 2)
      .map(([number, g]) => ({
        number,
        avgGap: (g.reduce((a, b) => a + b, 0) / g.length).toFixed(1),
        appearances: g.length + 1
      }))
      .sort((a, b) => parseFloat(a.avgGap) - parseFloat(b.avgGap));

    return avgGaps.slice(0, 30);
  }

  /**
   * Trend analysis - is each digit trending up or down?
   */
  function digitTrend(results, windowSize = 10) {
    const windows = [];
    for (let i = 0; i < Math.min(5, Math.floor(results.length / windowSize)); i++) {
      const slice = results.slice(i * windowSize, (i + 1) * windowSize);
      const freq = Array(10).fill(0);
      getAllWinningNumbers(slice).forEach(num => {
        num.split('').forEach(d => freq[parseInt(d)]++);
      });
      windows.push(freq);
    }
    return windows;
  }

  /**
   * Overall digit frequency (0-9) across all numbers
   */
  function overallDigitFrequency(results) {
    const freq = Array(10).fill(0);
    const numbers = getAllWinningNumbers(results);

    numbers.forEach(num => {
      num.split('').forEach(d => freq[parseInt(d)]++);
    });

    const total = freq.reduce((a, b) => a + b, 0);
    return freq.map((count, digit) => ({
      digit,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    }));
  }

  /**
   * Recent winning numbers for display
   */
  function recentResults(results, count = 10) {
    return results.slice(0, count);
  }

  return {
    digitFrequencyByPosition,
    getAllWinningNumbers,
    getTopPrizeNumbers,
    numberFrequency,
    hotNumbers,
    coldNumbers,
    pairAnalysis,
    oddEvenAnalysis,
    sumAnalysis,
    gapAnalysis,
    digitTrend,
    overallDigitFrequency,
    recentResults,
    findLastSeen
  };
})();
