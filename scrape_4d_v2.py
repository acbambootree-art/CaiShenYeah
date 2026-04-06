#!/usr/bin/env python3
"""
Singapore Pools 4D Results Scraper v2
Fetches draw list first, then scrapes each draw using the sppl query string.
"""

import urllib.request
import re
import json
import os
import sys
import time

DRAW_LIST_URL = 'https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_draw_list_en.html'
RESULTS_URL = 'https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')

def get_draw_list():
    """Parse draw list to get all draw numbers and their sppl query strings."""
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
    """Parse the results page HTML."""
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

        # Parse date
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
        print(f'  Parse error for draw {draw_no}: {e}')
        return None

def main():
    results_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '4d_results.json')

    # Load existing
    existing = []
    if os.path.exists(results_file):
        with open(results_file) as f:
            existing = json.load(f)
    existing_draws = {r['drawNo'] for r in existing}
    print(f'Existing: {len(existing)} draws')

    # Get draw list
    print('Fetching draw list...')
    draws = get_draw_list()
    print(f'Found {len(draws)} draws in list (#{draws[-1]["drawNo"]} to #{draws[0]["drawNo"]})')

    # Filter to ones we don't have
    to_fetch = [d for d in draws if d['drawNo'] not in existing_draws]
    print(f'Need to fetch: {len(to_fetch)} draws\n')

    new_results = []
    for i, draw in enumerate(to_fetch):
        url = RESULTS_URL + draw['sppl']
        try:
            print(f'[{i+1}/{len(to_fetch)}] Draw #{draw["drawNo"]} ({draw["dateStr"]})...', end=' ', flush=True)
            html = fetch(url)
            result = parse_result(html, draw['drawNo'], draw['dateStr'])

            if result:
                new_results.append(result)
                print(f'1st: {result["first"]}')
            else:
                print('No data')

            time.sleep(0.6)

        except Exception as e:
            print(f'Error: {e}')
            time.sleep(2)

        # Checkpoint every 50
        if len(new_results) > 0 and len(new_results) % 50 == 0:
            all_r = existing + new_results
            all_r.sort(key=lambda r: r['drawNo'], reverse=True)
            seen = set()
            unique = [r for r in all_r if not (r['drawNo'] in seen or seen.add(r['drawNo']))]
            with open(results_file, 'w') as f:
                json.dump(unique, f, indent=2)
            print(f'  [Checkpoint] {len(unique)} draws saved')

    # Final save
    all_r = existing + new_results
    all_r.sort(key=lambda r: r['drawNo'], reverse=True)
    seen = set()
    unique = [r for r in all_r if not (r['drawNo'] in seen or seen.add(r['drawNo']))]
    with open(results_file, 'w') as f:
        json.dump(unique, f, indent=2)
    print(f'\nDone! Total: {len(unique)} draws saved. New: {len(new_results)}')

if __name__ == '__main__':
    main()
