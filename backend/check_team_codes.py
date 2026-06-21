import json, os, sys, signal
signal.signal(signal.SIGINT, lambda s,f: sys.exit(0))
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv; load_dotenv()
sys.path.insert(0, 'backend')
from services.match_detail_service import get_match_detail

d = get_match_detail(84610860)
if d is None:
    print('None')
    sys.exit(1)

teams_codes = list(d['statistics']['teams'].keys())
# print('sorted team codes:', sorted(teams_codes, key=int))
# print()
# print('statistics.event:', json.dumps(d['statistics']['event']))
# print()
# print('results:', json.dumps(d['results']))
