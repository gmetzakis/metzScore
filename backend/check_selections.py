import json, os, requests
from dotenv import load_dotenv
import sys
sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()
API_URL = os.getenv('API_URL')
DEFAULT_HEADERS = json.loads(os.getenv('DEFAULT_HEADERS'))

resp = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=15)
data = resp.json()
events = data.get('events', {})
markets = data.get('markets', {})
selections = data.get('selections', {})

# Print RAW field names for first 3 selections in any type=13 market
found = 0
for mk_id, mk in markets.items():
    if mk.get('typeId') != 13:
        continue
    sids = mk.get('selectionIdList', [])
    print(f'\n=== Type 13 market id={mk_id}, name={mk.get("name")!r} ===')
    for sid in sids[:8]:
        s = selections.get(str(sid), {})
        print(f'  RAW selection id={sid}: {json.dumps(s, ensure_ascii=False)}')
    found += 1
    if found >= 3:
        break

# Also type 34 (Corners O/U)
found = 0
for mk_id, mk in markets.items():
    if mk.get('typeId') != 34:
        continue
    sids = mk.get('selectionIdList', [])
    print(f'\n=== Type 34 market id={mk_id}, name={mk.get("name")!r} ===')
    for sid in sids[:8]:
        s = selections.get(str(sid), {})
        print(f'  RAW selection id={sid}: {json.dumps(s, ensure_ascii=False)}')
    found += 1
    if found >= 2:
        break
