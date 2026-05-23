import sys, json
sys.path.insert(0, 'backend')
from services.match_detail_service import get_match_detail
d = get_match_detail(84610860)
if d is None:
    print('d is None')
    sys.exit(1)

print('statistics.teams:')
print(json.dumps(d['statistics']['teams'], indent=2))
print()
print('statistics.event:', json.dumps(d['statistics']['event']))
print()
print('results (liveData.results):', json.dumps(d['results']))
print()
print('score:', json.dumps(d['score']))
print('home_team.id:', d['home_team']['id'])
print('away_team.id:', d['away_team']['id'])
