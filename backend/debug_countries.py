import json
import requests
from dotenv import load_dotenv
import os
load_dotenv()
API_URL = os.getenv('API_URL')
DEFAULT_HEADERS = json.loads(os.getenv('DEFAULT_HEADERS'))

response = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=10)
raw_data = response.json()

from services.fetch_service import extract_football_matches

matches = extract_football_matches(raw_data)

# Find thailand matches
thailand_matches = [m for m in matches if m.get('country_code') == 'thailand']
with open('country_debug.txt', 'w', encoding='utf-8') as f:
    f.write(f"Thailand matches found: {len(thailand_matches)}\n")
    for m in thailand_matches[:3]:
        f.write(f"  ID: {m.get('id')}, Country: {m.get('country_name')}, Code: {m.get('country_code')}, League: {m.get('league')}\n")