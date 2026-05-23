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

with open('country_debug.txt', 'w', encoding='utf-8') as f:
    for m in matches[:10]:
        f.write(f"ID: {m.get('id')}, League: {m.get('league')}, Country: {m.get('country_name')}\n")