"""Refresh the public Ubatuba harmonic tide snapshot; never publish incomplete data."""
import json, urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
URL='https://tidecheck.com/api/station/ubatuba-282a-bra-uhslc_rq/tides?datum=LAT&days=14'
req=urllib.request.Request(URL,headers={'User-Agent':'CODE tide updater/1.0','Accept':'application/json'})
with urllib.request.urlopen(req,timeout=45) as response: data=json.load(response)
assert data['station']['id']=='ubatuba-282a-bra-uhslc_rq' and data['datum']=='LAT'
events={}
for e in data['extremes']:
 if e['type'] not in ('low','high'): continue
 height=float(e['height']);assert 0<=height<10
 dt=datetime.fromisoformat(e['localTime']);day=dt.astimezone(ZoneInfo('America/Sao_Paulo')).date().isoformat()
 events.setdefault(day,[]).append({'type':e['type'],'time':dt.strftime('%H:%M'),'height':height})
now=datetime.now(ZoneInfo('America/Sao_Paulo'))
for i in range(8): assert len(events.get((now.date()+timedelta(days=i)).isoformat(),[]))>=2,'Incomplete tide week'
for rows in events.values():rows.sort(key=lambda e:e['time'])
result={'location':'Ubatuba, SP','timezone':'America/Sao_Paulo','datum':'LAT','source':'TideCheck / TICON-4 (SHOM)','updated':now.isoformat(),'events':events}
Path(__file__).resolve().parents[1].joinpath('tides.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Updated Ubatuba tide snapshot:',min(events),'to',max(events))
