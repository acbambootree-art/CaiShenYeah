#!/usr/bin/env python3
"""
Backfill historical 4D draws from Singapore Pools.

The results page accepts any draw number via the sppl query string
(base64 of "DrawNumber=<n>"), so this walks backwards from the oldest
draw already in 4d_results.json down to draw 1 (or --min-draw).
Checkpoints every 50 draws and is safe to re-run / resume.

Usage:
  python3 backfill_history.py                # backfill everything
  python3 backfill_history.py --min-draw 4000
"""

import argparse
import base64
import json
import os
import re
import time
import urllib.request
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_FILE = os.path.join(SCRIPT_DIR, '4d_results.json')
DATA_JS_FILE = os.path.join(SCRIPT_DIR, 'js', 'data.js')
RESULTS_URL = 'https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?sppl='


def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_result(html, draw_no):
    first_match = re.search(r"class=['\"]tdFirstPrize['\"][^>]*>([^<]+)", html)
    if not first_match:
        return None
    second_match = re.search(r"class=['\"]tdSecondPrize['\"][^>]*>([^<]+)", html)
    third_match = re.search(r"class=['\"]tdThirdPrize['\"][^>]*>([^<]+)", html)

    starter_section = re.search(r'tbodyStarterPrizes[\s\S]*?</tbody>', html)
    starters = re.findall(r'<td[^>]*>(\d{4})</td>', starter_section.group(0)) if starter_section else []

    consol_section = re.search(r'tbodyConsolationPrizes[\s\S]*?</tbody>', html)
    consolation = re.findall(r'<td[^>]*>(\d{4})</td>', consol_section.group(0)) if consol_section else []

    date_match = re.search(r"class=['\"]drawDate['\"][^>]*>([^<]+)", html)
    iso_date = None
    if date_match:
        cleaned = re.sub(r'^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*', '', date_match.group(1).strip())
        for fmt in ('%d %B %Y', '%d %b %Y', '%B %d, %Y'):
            try:
                iso_date = datetime.strptime(cleaned, fmt).strftime('%Y-%m-%d')
                break
            except ValueError:
                continue

    return {
        'drawNo': draw_no,
        'date': iso_date or (date_match.group(1).strip() if date_match else None),
        'first': first_match.group(1).strip(),
        'second': second_match.group(1).strip() if second_match else None,
        'third': third_match.group(1).strip() if third_match else None,
        'starters': starters,
        'consolation': consolation
    }


def generate_data_js(data):
    lines = ['// Auto-generated from 4d_results.json', 'const HISTORICAL_RESULTS = [']
    for r in data:
        starters = ', '.join(f'"{s}"' for s in r['starters'])
        consolation = ', '.join(f'"{c}"' for c in r['consolation'])
        lines.append(f'  {{ drawNo: {r["drawNo"]}, date: "{r["date"]}", first: "{r["first"]}", second: "{r["second"]}", third: "{r["third"]}", starters: [{starters}], consolation: [{consolation}] }},')
    lines.append('];')
    with open(DATA_JS_FILE, 'w') as f:
        f.write('\n'.join(lines))


def save(results):
    results.sort(key=lambda r: r['drawNo'], reverse=True)
    seen = set()
    unique = [r for r in results if not (r['drawNo'] in seen or seen.add(r['drawNo']))]
    with open(RESULTS_FILE, 'w') as f:
        json.dump(unique, f, indent=2)
    return unique


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--min-draw', type=int, default=1, help='Oldest draw number to fetch (default: 1)')
    args = parser.parse_args()

    with open(RESULTS_FILE) as f:
        existing = json.load(f)
    existing_draws = {r['drawNo'] for r in existing}
    oldest = min(existing_draws)
    print(f'Existing: {len(existing)} draws (oldest #{oldest})')

    to_fetch = [n for n in range(oldest - 1, args.min_draw - 1, -1) if n not in existing_draws]
    print(f'Backfilling {len(to_fetch)} draws (#{to_fetch[0]} down to #{to_fetch[-1]})' if to_fetch else 'Nothing to backfill.')

    results = existing
    fetched = 0
    misses = 0
    for i, draw_no in enumerate(to_fetch):
        sppl = base64.b64encode(f'DrawNumber={draw_no}'.encode()).decode()
        try:
            html = fetch(RESULTS_URL + sppl)
            result = parse_result(html, draw_no)
            if result:
                results.append(result)
                fetched += 1
                misses = 0
                if fetched % 25 == 0:
                    print(f'[{i+1}/{len(to_fetch)}] #{draw_no} {result["date"]} 1st: {result["first"]} (total fetched: {fetched})', flush=True)
            else:
                misses += 1
                print(f'[{i+1}/{len(to_fetch)}] #{draw_no}: no data', flush=True)
                if misses >= 20:
                    print('20 consecutive draws with no data - assuming end of archive, stopping.')
                    break
            time.sleep(0.5)
        except Exception as e:
            print(f'[{i+1}/{len(to_fetch)}] #{draw_no}: error {e}', flush=True)
            time.sleep(3)

        if fetched > 0 and fetched % 50 == 0:
            results = save(results)
            print(f'  [Checkpoint] {len(results)} draws saved', flush=True)

    results = save(results)
    generate_data_js(results)
    print(f'\nDone. Total: {len(results)} draws (+{fetched} backfilled). Regenerated js/data.js')


if __name__ == '__main__':
    main()
