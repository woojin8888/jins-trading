"""Refresh public Korean names and KOSPI/KOSDAQ codes from Naver Finance."""
import concurrent.futures, datetime, json, math, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
def fetch(market, page):
    url = f'https://m.stock.naver.com/api/stocks/marketValue/{market}?page={page}&pageSize=100'
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=25) as response:
        return market, json.load(response)
first = [fetch(market, 1) for market in ['KOSPI', 'KOSDAQ']]
jobs = [(market, page) for market, data in first for page in range(2, math.ceil(data['totalCount']/100)+1)]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    pages = first + list(pool.map(lambda args: fetch(*args), jobs))
stocks = {}
for market, data in pages:
    for row in data['stocks']:
        code = row.get('itemCode', '')
        if len(code) == 6 and code.isalnum() and code[0].isdigit() and row.get('stockName'):
            stocks[code] = {'name': row['stockName'], 'exchange': market}
if len(stocks) < 2500:
    raise ValueError('Incomplete stock-name catalog; existing snapshot was preserved.')
catalog = {'asOf': datetime.datetime.now(datetime.timezone.utc).date().isoformat(), 'source': 'Naver Finance · KOSPI/KOSDAQ market-value listings', 'stocks': dict(sorted(stocks.items()))}
(ROOT/'server/korean-stocks.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))+'\n')
print('Korean stock names and exchange codes:', len(stocks), 'as of', catalog['asOf'])
