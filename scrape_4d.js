/**
 * Singapore Pools 4D Results Scraper
 *
 * Usage: node scrape_4d.js [startDrawNo] [endDrawNo]
 * Example: node scrape_4d.js 5300 5430
 *
 * URL Pattern discovered:
 *   https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?sppl={base64("DrawNumber=XXXX")}
 *
 * The draw list (dates from Apr 2023 to present) is at:
 *   https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_draw_list_en.html
 *
 * The latest 6 draws are always at:
 *   https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html
 */

const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?sppl=';

function encodeDrawNumber(drawNo) {
  return Buffer.from(`DrawNumber=${drawNo}`).toString('base64');
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseResult(html, drawNo) {
  try {
    // Extract draw date
    const dateMatch = html.match(/class="drawDate"[^>]*>([^<]+)/);
    const drawDate = dateMatch ? dateMatch[1].trim() : null;

    // Extract prizes
    const firstMatch = html.match(/class="tdFirstPrize"[^>]*>([^<]+)/);
    const secondMatch = html.match(/class="tdSecondPrize"[^>]*>([^<]+)/);
    const thirdMatch = html.match(/class="tdThirdPrize"[^>]*>([^<]+)/);

    // Extract starters
    const starterSection = html.match(/tbodyStarterPrizes[\s\S]*?<\/tbody>/);
    const starters = [];
    if (starterSection) {
      const nums = starterSection[0].match(/<td[^>]*>(\d{4})<\/td>/g);
      if (nums) nums.forEach(n => {
        const m = n.match(/>(\d{4})</);
        if (m) starters.push(m[1]);
      });
    }

    // Extract consolation
    const consolSection = html.match(/tbodyConsolationPrizes[\s\S]*?<\/tbody>/);
    const consolation = [];
    if (consolSection) {
      const nums = consolSection[0].match(/<td[^>]*>(\d{4})<\/td>/g);
      if (nums) nums.forEach(n => {
        const m = n.match(/>(\d{4})</);
        if (m) consolation.push(m[1]);
      });
    }

    if (!firstMatch) return null;

    // Parse date to ISO format
    let isoDate = null;
    if (drawDate) {
      const d = new Date(drawDate.replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*/, ''));
      if (!isNaN(d.getTime())) {
        isoDate = d.toISOString().split('T')[0];
      }
    }

    return {
      drawNo,
      date: isoDate || drawDate,
      first: firstMatch[1].trim(),
      second: secondMatch ? secondMatch[1].trim() : null,
      third: thirdMatch ? thirdMatch[1].trim() : null,
      starters,
      consolation
    };
  } catch (e) {
    console.error(`Error parsing draw ${drawNo}:`, e.message);
    return null;
  }
}

async function scrapeRange(start, end) {
  const results = [];
  const existingFile = './4d_results.json';
  let existing = [];

  if (fs.existsSync(existingFile)) {
    existing = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    console.log(`Loaded ${existing.length} existing results`);
  }

  const existingDraws = new Set(existing.map(r => r.drawNo));

  for (let drawNo = end; drawNo >= start; drawNo--) {
    if (existingDraws.has(drawNo)) {
      console.log(`Draw ${drawNo} already exists, skipping`);
      continue;
    }

    const encoded = encodeDrawNumber(drawNo);
    const url = BASE_URL + encoded;

    try {
      console.log(`Fetching draw ${drawNo}...`);
      const html = await fetchPage(url);
      const result = parseResult(html, drawNo);

      if (result) {
        results.push(result);
        console.log(`  Got: ${result.date} - 1st: ${result.first}, 2nd: ${result.second}, 3rd: ${result.third}`);
      } else {
        console.log(`  No data found for draw ${drawNo}`);
      }

      // Rate limit: wait 1 second between requests
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`  Error fetching draw ${drawNo}:`, e.message);
    }
  }

  // Merge with existing and sort by draw number descending
  const allResults = [...existing, ...results];
  allResults.sort((a, b) => b.drawNo - a.drawNo);

  // Remove duplicates
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.drawNo)) return false;
    seen.add(r.drawNo);
    return true;
  });

  fs.writeFileSync(existingFile, JSON.stringify(unique, null, 2));
  console.log(`\nTotal: ${unique.length} draws saved to ${existingFile}`);
  console.log(`New draws added: ${results.length}`);
}

// Main
const args = process.argv.slice(2);
const startDraw = parseInt(args[0]) || 5300;
const endDraw = parseInt(args[1]) || 5429;

console.log(`Scraping draws ${startDraw} to ${endDraw}...`);
console.log(`URL pattern: ${BASE_URL}<base64("DrawNumber=XXXX")>`);
console.log('');

scrapeRange(startDraw, endDraw);
