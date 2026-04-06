#!/usr/bin/env python3
"""
Singapore Pools 4D Results Scraper (Python version)

Usage: python3 scrape_4d.py [startDrawNo] [endDrawNo]
Example: python3 scrape_4d.py 5000 5429
"""

import urllib.request
import base64
import re
import json
import os
import sys
import time

BASE_URL = 'https://www.singaporepools.com.sg/en/product/Pages/4D_results.aspx?sppl='

def encode_draw_number(draw_no):
    return base64.b64encode(f'DrawNumber={draw_no}'.encode()).decode()

def fetch_page(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')

def parse_result(html, draw_no):
    try:
        date_match = re.search(r'class="drawDate"[^>]*>([^<]+)', html)
        draw_date = date_match.group(1).strip() if date_match else None

        first_match = re.search(r'class="tdFirstPrize"[^>]*>([^<]+)', html)
        second_match = re.search(r'class="tdSecondPrize"[^>]*>([^<]+)', html)
        third_match = re.search(r'class="tdThirdPrize"[^>]*>([^<]+)', html)

        # Extract starters
        starter_section = re.search(r'tbodyStarterPrizes[\s\S]*?</tbody>', html)
        starters = []
        if starter_section:
            nums = re.findall(r'<td[^>]*>(\d{4})</td>', starter_section.group(0))
            starters = nums

        # Extract consolation
        consol_section = re.search(r'tbodyConsolationPrizes[\s\S]*?</tbody>', html)
        consolation = []
        if consol_section:
            nums = re.findall(r'<td[^>]*>(\d{4})</td>', consol_section.group(0))
            consolation = nums

        if not first_match:
            return None

        # Parse date to ISO format
        iso_date = None
        if draw_date:
            # Remove day prefix like "Sun, " or "Wed, "
            cleaned = re.sub(r'^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*', '', draw_date)
            from datetime import datetime
            for fmt in ('%d %B %Y', '%d %b %Y', '%B %d, %Y'):
                try:
                    dt = datetime.strptime(cleaned, fmt)
                    iso_date = dt.strftime('%Y-%m-%d')
                    break
                except ValueError:
                    continue

        return {
            'drawNo': draw_no,
            'date': iso_date or draw_date,
            'first': first_match.group(1).strip(),
            'second': second_match.group(1).strip() if second_match else None,
            'third': third_match.group(1).strip() if third_match else None,
            'starters': starters,
            'consolation': consolation
        }
    except Exception as e:
        print(f'  Error parsing draw {draw_no}: {e}')
        return None

def scrape_range(start, end):
    results_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '4d_results.json')
    existing = []

    if os.path.exists(results_file):
        with open(results_file) as f:
            existing = json.load(f)
        print(f'Loaded {len(existing)} existing results')

    existing_draws = {r['drawNo'] for r in existing}
    new_results = []
    errors = 0

    for draw_no in range(end, start - 1, -1):
        if draw_no in existing_draws:
            continue

        encoded = encode_draw_number(draw_no)
        url = BASE_URL + encoded

        try:
            print(f'Fetching draw {draw_no}...', end=' ', flush=True)
            html = fetch_page(url)
            result = parse_result(html, draw_no)

            if result:
                new_results.append(result)
                print(f'{result["date"]} - 1st: {result["first"]}, 2nd: {result["second"]}, 3rd: {result["third"]}')
                errors = 0
            else:
                print('No data')
                errors += 1

            # Rate limit
            time.sleep(0.8)

        except Exception as e:
            print(f'Error: {e}')
            errors += 1
            time.sleep(2)

        # Stop if too many consecutive errors (likely past valid range)
        if errors >= 10:
            print(f'\n10 consecutive errors, stopping at draw {draw_no}')
            break

        # Save progress every 50 draws
        if len(new_results) % 50 == 0 and len(new_results) > 0:
            all_results = existing + new_results
            all_results.sort(key=lambda r: r['drawNo'], reverse=True)
            seen = set()
            unique = [r for r in all_results if not (r['drawNo'] in seen or seen.add(r['drawNo']))]
            with open(results_file, 'w') as f:
                json.dump(unique, f, indent=2)
            print(f'  [Checkpoint] Saved {len(unique)} draws')

    # Final save
    all_results = existing + new_results
    all_results.sort(key=lambda r: r['drawNo'], reverse=True)
    seen = set()
    unique = [r for r in all_results if not (r['drawNo'] in seen or seen.add(r['drawNo']))]
    with open(results_file, 'w') as f:
        json.dump(unique, f, indent=2)
    print(f'\nTotal: {len(unique)} draws saved')
    print(f'New draws added: {len(new_results)}')

if __name__ == '__main__':
    start_draw = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    end_draw = int(sys.argv[2]) if len(sys.argv) > 2 else 5429

    print(f'Scraping draws {start_draw} to {end_draw}...')
    print(f'URL pattern: {BASE_URL}<base64("DrawNumber=XXXX")>')
    print()
    scrape_range(start_draw, end_draw)
