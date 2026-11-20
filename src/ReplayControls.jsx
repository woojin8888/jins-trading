import React from 'react';
import {Pause,Play,SkipBack,SkipForward,X} from 'lucide-react';
import {REPLAY_SPEEDS,replayDateIndex} from './bar-replay.js';
import {formatBarTime,timeframeLabel} from './timeframes.js';
export default function ReplayControls({value,onChange,onExit,onStep}){
  const {session,cursor,playing,speed}=value,frame=session.frames[cursor],last=cursor===session.frames.length-1;
  return <section className="replay-controls" aria-label="과거 봉 리플레이"><div className="replay-heading"><strong>과거 봉 리플레이</strong><span>{session.chart.symbol} · {timeframeLabel(session.interval)}봉 · {formatBarTime(frame.time,session.chart.timeZone)}{['W','M'].includes(session.interval)?' ~ '+frame.date:''}</span><button onClick={onExit}><X size={15}/>현재 시세로 복귀</button></div>
    <div className="replay-actions"><button aria-label="이전 봉" disabled={cursor===0} onClick={()=>onStep(-1)}><SkipBack size={16}/></button><button disabled={last&&!playing} onClick={()=>onChange(s=>({...s,playing:!s.playing}))}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'일시정지':'재생'}</button><button aria-label="다음 봉" disabled={last} onClick={()=>onStep(1)}><SkipForward size={16}/></button>
      <label>속도<select aria-label="리플레이 속도" value={speed} onChange={e=>onChange(s=>({...s,speed:Number(e.target.value)}))}>{REPLAY_SPEEDS.map(n=><option value={n} key={n}>{n}배속</option>)}</select></label>
      <label>봉 시작 날짜<input type="date" aria-label="리플레이 시작 날짜" value={frame.startDate} min={session.frames[0].startDate} max={session.frames.at(-1).startDate} onChange={e=>{if(e.target.value)onChange(s=>({...s,cursor:replayDateIndex(session.frames,e.target.value),playing:false}));}}/></label><span>{cursor+1} / {session.frames.length}봉{last?' · 제공 구간 재생 완료':''}</span></div>
    <input className="replay-progress" aria-label="리플레이 봉 위치" type="range" min="0" max={session.frames.length-1} value={cursor} onChange={e=>onChange(s=>({...s,cursor:Number(e.target.value),playing:false}))}/>
    <p>확정된 과거 봉을 한 개씩 보여줍니다. 봉 내부 체결 순서와 매매 체결은 재현하지 않습니다. 지표·매물대·CSV는 공개한 봉까지만 계산하며 현재 시세·알림 생성·분할 화면은 숨깁니다. 기존 서버 알림은 계속 동작합니다. 분봉의 일봉 카드는 그 시점 이전의 확정 일봉 기준입니다. 그리기는 임시 저장하며 종료하면 사라집니다. 종목·봉 주기·비교 지수 변경 시 리플레이를 종료합니다.</p>
  </section>;
}
