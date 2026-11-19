import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {evaluateAlert,ALERT_TYPES} from './shared/alert-engine.js';
import {quoteUnit} from './shared/instruments.js';
const url=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
async function same(a:string,b:string){const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(v)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=req.headers.get('x-trading-worker-token');if(!token)return new Response('Unauthorized',{status:401});
 const {data:expected,error:authError}=await db.rpc('trading_worker_key');
 if(authError||!expected||!await same(token,expected))return new Response('Unauthorized',{status:401});
 const {data:rules,error}=await db.rpc('trading_claim_alerts');if(error){console.error('claim',error.code);return Response.json({error:'claim failed'},{status:500});}
 const cache=new Map();let checked=0,triggered=0,failed=0;
 const groups=Map.groupBy(rules||[],r=>r.market+':'+r.symbol),jobs=[...groups.values()];
 async function process(){let group;while((group=jobs.shift())){
   let history;try{const first=group[0],params=new URLSearchParams({action:'history',market:first.market,symbol:first.symbol,range:'2y',fresh:String(Date.now())});const response=await fetch('https://jins-trading.vercel.app/api/market?'+params,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('시세 조회 실패 '+response.status);history=await response.json();cache.set(first.symbol,history);}catch(error){for(const rule of group)await db.from('trading_alerts').update({last_error:String(error.message).slice(0,300),last_checked:new Date().toISOString()}).eq('id',rule.id);failed+=group.length;continue;}
   for(const rule of group){try{const result=evaluateAlert(rule,history);if(result.trigger){
     const message=`${rule.name||rule.symbol} · ${ALERT_TYPES[rule.kind]} ${rule.kind==='ma_cross'?rule.period+'일':rule.threshold} · 확인값 ${result.value.toLocaleString('ko-KR',{maximumFractionDigits:6})} ${rule.kind==='volume_above'?'배':rule.kind==='rs_above'?'RS':quoteUnit(rule.symbol,history.currency)}`;
     const {error}=await db.rpc('trading_finish_alert',{rule_id:rule.id,condition_value:result.condition,source_time:result.sourceAt,bar_time:String(result.barAt),notification_message:message,notify:true});if(error)throw error;triggered++;
   }else{const {error}=await db.rpc('trading_finish_alert',{rule_id:rule.id,condition_value:result.condition,source_time:result.sourceAt,bar_time:String(result.barAt),notification_message:'',notify:false});if(error)throw error;}checked++;
   }catch(error){failed++;await db.from('trading_alerts').update({last_error:String(error.message).slice(0,300),last_checked:new Date().toISOString()}).eq('id',rule.id);}}
 }}
 await Promise.all(Array.from({length:Math.min(3,jobs.length)},process));return Response.json({checked,triggered,failed});
});
