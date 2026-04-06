#!/usr/bin/env python3
"""
Quick update script: fetches latest draws from Singapore Pools,
updates 4d_results.json, and regenerates js/data.js.

Can be run manually or via a scheduled task after each draw.
"""

import urllib.request
import re
import json
import os
import time
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_FILE = os.path.join(SCRIPT_DIR, '4d_results.json')
DATA_JS_FILE = os.path.join(SCRIPT_DIR, 'js', 'data.js')
DRAW_LIST_URL = 'https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_draw_list_en.html'
RESULTS_URL = 'https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?'

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')

def get_draw_list():
    html = fetch(DRAW_LIST_URL)
    draws = []
    for m in re.finditer(r"value='(\d+)'\s+queryString='(sppl=[^']+)'[^>]*>([^<]+)", html):
        draws.append({
            'drawNo': int(m.group(1)),
            'sppl': m.group(2),
            'dateStr': m.group(3).strip()
        })
    return draws

def parse_result(html, draw_no, date_str):
    try:
        first_match = re.search(r"class=['\"]tdFirstPrize['\"][^>]*>([^<]+)", html)
        second_match = re.search(r"class=['\"]tdSecondPrize['\"][^>]*>([^<]+)", html)
        third_match = re.search(r"class=['\"]tdThirdPrize['\"][^>]*>([^<]+)", html)

        starter_section = re.search(r'tbodyStarterPrizes[\s\S]*?</tbody>', html)
        starters = re.findall(r'<td[^>]*>(\d{4})</td>', starter_section.group(0)) if starter_section else []

        consol_section = re.search(r'tbodyConsolationPrizes[\s\S]*?</tbody>', html)
        consolation = re.findall(r'<td[^>]*>(\d{4})</td>', consol_section.group(0)) if consol_section else []

        if not first_match:
            return None

        from datetime import datetime
        cleaned = re.sub(r'^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*', '', date_str)
        iso_date = None
        for fmt in ('%d %B %Y', '%d %b %Y', '%B %d, %Y'):
            try:
                iso_date = datetime.strptime(cleaned, fmt).strftime('%Y-%m-%d')
                break
            except ValueError:
                continue

        return {
            'drawNo': draw_no,
            'date': iso_date or date_str,
            'first': first_match.group(1).strip(),
            'second': second_match.group(1).strip() if second_match else None,
            'third': third_match.group(1).strip() if third_match else None,
            'starters': starters,
            'consolation': consolation
        }
    except Exception as e:
        print(f'  Parse error: {e}')
        return None

def generate_data_js(data):
    lines = ['// Auto-generated from 4d_results.json', 'const HISTORICAL_RESULTS = [']
    for r in data:
        starters = ', '.join(f'"{s}"' for s in r['starters'])
        consolation = ', '.join(f'"{c}"' for c in r['consolation'])
        lines.append(f'  {{ drawNo: {r["drawNo"]}, date: "{r["date"]}", first: "{r["first"]}", second: "{r["second"]}", third: "{r["third"]}", starters: [{starters}], consolation: [{consolation}] }},')
    lines.append('];')
    with open(DATA_JS_FILE, 'w') as f:
        f.write('\n'.join(lines))

def git_commit_and_push(new_count, latest_draw):
    """Commit and push if there are changes."""
    os.chdir(SCRIPT_DIR)
    # Check if there are changes
    status = subprocess.run(['git', 'diff', '--stat'], capture_output=True, text=True)
    if not status.stdout.strip():
        print('No git changes to commit.')
        return
    subprocess.run(['git', 'add', '4d_results.json', 'js/data.js'], check=True)
    msg = f'Update results: +{new_count} draw(s), latest #{latest_draw}\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>'
    subprocess.run(['git', 'commit', '-m', msg], check=True)
    subprocess.run(['git', 'push'], check=True)
    print('Committed and pushed to remote.')

def main():
    # Load existing results
    existing = []
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE) as f:
            existing = json.load(f)
    existing_draws = {r['drawNo'] for r in existing}
    print(f'Existing: {len(existing)} draws')

    # Get current draw list from Singapore Pools
    print('Fetching draw list...')
    draws = get_draw_list()
    to_fetch = [d for d in draws if d['drawNo'] not in existing_draws]

    if not to_fetch:
        print('Already up to date - no new draws found.')
        return

    print(f'Found {len(to_fetch)} new draw(s) to fetch\n')

    new_results = []
    for i, draw in enumerate(to_fetch):
        url = RESULTS_URL + draw['sppl']
        try:
            print(f'[{i+1}/{len(to_fetch)}] Draw #{draw["drawNo"]} ({draw["dateStr"]})...', end=' ', flush=True)
            html = fetch(url)
            result = parse_result(html, draw['drawNo'], draw['dateStr'])
            if result:
                new_results.append(result)
                print(f'1st: {result["first"]}, 2nd: {result["second"]}, 3rd: {result["third"]}')
            else:
                print('No data')
            time.sleep(0.6)
        except Exception as e:
            print(f'Error: {e}')
            time.sleep(2)

    if not new_results:
        print('No new results fetched.')
        return

    # Merge, deduplicate, sort
    all_results = existing + new_results
    all_results.sort(key=lambda r: r['drawNo'], reverse=True)
    seen = set()
    unique = [r for r in all_results if not (r['drawNo'] in seen or seen.add(r['drawNo']))]

    # Save JSON
    with open(RESULTS_FILE, 'w') as f:
        json.dump(unique, f, indent=2)
    print(f'\nSaved {len(unique)} total draws (+{len(new_results)} new)')

    # Regenerate data.js
    generate_data_js(unique)
    print(f'Regenerated {DATA_JS_FILE}')

    # Git commit and push
    latest = max(r['drawNo'] for r in new_results)
    git_commit_and_push(len(new_results), latest)

if __name__ == '__main__':
    main()
