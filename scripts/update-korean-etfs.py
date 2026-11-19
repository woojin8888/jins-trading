"""Refresh native Korean ETF names; quotes still come from the live chart feed."""
import datetime,json,pathlib,urllib.request
request=urllib.request.Request('https://finance.naver.com/api/sise/etfItemList.nhn',headers={'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(request,timeout=20) as response:
    raw=response.read();charset=response.headers.get_content_charset()
for encoding in [charset,'utf-8','euc-kr']:
    if not encoding:continue
    try:data=json.loads(raw.decode(encoding));break
    except (UnicodeDecodeError,json.JSONDecodeError):continue
rows=data['result']['etfItemList']
names={r['itemcode']:r['itemname'] for r in rows if len(r.get('itemcode',''))==6 and r.get('itemname')}
if len(names)<300:raise ValueError('Incomplete ETF catalog; previous snapshot preserved')
path=pathlib.Path(__file__).resolve().parents[1]/'server/korean-etfs.json'
path.write_text(json.dumps({'asOf':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'source':'Naver Finance ETF directory','names':names},ensure_ascii=False,separators=(',',':'))+'\n')
print('Korean ETF names:',len(names))
