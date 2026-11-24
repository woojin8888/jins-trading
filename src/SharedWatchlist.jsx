import React from 'react';
import {SHARED_WATCHLIST_GROUPS,SHARED_WATCHLIST_URL} from './shared-watchlist.js';

export default function SharedWatchlist({onSelect,onCopy,disabled,busy}){
  return <div className="shared-watchlist">
    <p className="watch-help">보내주신 공개 목록의 25개 항목을 같은 그룹·순서로 정리했습니다. 2026-11-24에 확인한 목록이며 자동 동기화되지 않습니다.</p>
    <button className="shared-watchlist-copy" disabled={disabled||busy} onClick={onCopy}>{busy?'복사 중…':'차트 지원 22종목을 내 관심목록에 복사'}</button>
    <p className="watch-help">미국 10년물 수익률·USOIL·금 현물은 원본 링크로 표시합니다. 다른 선물이나 추정 가격으로 대체하지 않습니다. 연결한 종목도 시세 공급처와 기준 시각이 TradingView와 다를 수 있습니다.</p>
    {SHARED_WATCHLIST_GROUPS.map(group=><section key={group.name} className="shared-watchlist-group"><h4>{group.name}</h4>{group.rows.map(row=><div key={row.source} className="shared-watchlist-row">{row.symbol?<button onClick={()=>onSelect(row)}><b>{row.name}</b><small>{row.source} · 차트 열기</small></button>:<a href={`https://kr.tradingview.com/chart/?symbol=${encodeURIComponent(row.source)}`} target="_blank" rel="noreferrer"><b>{row.name} ↗</b><small>{row.source} · 원본에서 보기</small><small>{row.reason}</small></a>}</div>)}</section>)}
    <a className="shared-watchlist-source" href={SHARED_WATCHLIST_URL} target="_blank" rel="noreferrer">TradingView 공유목록 원본 ↗</a>
  </div>;
}
