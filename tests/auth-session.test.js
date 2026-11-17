import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {AUTH_STORAGE_KEY,observeAuthSession,persistentAuthOptions,persistentStorageAvailable} from '../src/auth-session.js';
const flush=async()=>{await setImmediate();};
const session=id=>({user:{id},access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function setup(getSession){
  let callback,unsubscribed=false;const states=[],win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';
  const timers=new Map();let next=0,calls=0;
  const auth={getSession:()=>{calls++;return getSession();},onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe:()=>{unsubscribed=true;}}}};}};
  const observer=observeAuthSession(auth,value=>states.push(value),{window:win,document:doc,setTimer:fn=>{timers.set(++next,fn);return next;},clearTimer:id=>timers.delete(id)});
  return {observer,states,win,doc,timers,event:(event,value)=>callback(event,value),calls:()=>calls,unsubscribed:()=>unsubscribed};
}
test('restoring a persisted login does not flash a guest state',async()=>{
  const pending=deferred(),h=setup(()=>pending.promise);assert.equal(h.states.at(-1).status,'restoring');
  pending.resolve({data:{session:session('owner')},error:null});await flush();
  assert.equal(h.states.at(-1).status,'authenticated');assert.equal(h.states.at(-1).session.user.id,'owner');assert.ok(h.states.every(s=>s.status!=='guest'));h.observer.dispose();
});
test('an older startup read cannot overwrite a new sign-in',async()=>{
  const pending=deferred(),h=setup(()=>pending.promise);await flush();h.event('SIGNED_IN',session('new-owner'));
  pending.resolve({data:{session:null},error:null});await flush();assert.equal(h.states.at(-1).session.user.id,'new-owner');h.observer.dispose();
});
test('an explicit sign-out wins over an in-flight session restore and stale INITIAL_SESSION events',async()=>{
  const pending=deferred(),h=setup(()=>pending.promise);await flush();h.event('SIGNED_OUT',null);h.event('INITIAL_SESSION',session('old-owner'));
  pending.resolve({data:{session:session('old-owner')},error:null});await flush();assert.equal(h.states.at(-1).status,'guest');assert.equal(h.states.at(-1).session,null);h.observer.dispose();
});
test('a network error retains the current login and reconnects automatically on returning online',async()=>{
  let broken=false;const renewed={...session('owner'),access_token:'rotated'};
  const h=setup(async()=>broken?{data:{session:null},error:Error('offline')}:{data:{session:renewed},error:null});await flush();broken=true;
  await h.observer.recover();assert.equal(h.states.at(-1).session.user.id,'owner');assert.equal(h.states.at(-1).status,'authenticated');assert.ok(h.states.at(-1).error);assert.equal(h.timers.size,1);
  broken=false;h.win.dispatchEvent(new Event('online'));await flush();assert.equal(h.states.at(-1).error,'');assert.equal(h.states.at(-1).session.access_token,'rotated');assert.equal(h.timers.size,0);h.observer.dispose();
});
test('failed initial refresh waits for recovery instead of switching to a writable guest account',async()=>{
  let offline=true;const h=setup(async()=>offline?{data:{session:null},error:Error('offline')}:{data:{session:session('owner')},error:null});await flush();h.event('INITIAL_SESSION',null);
  assert.equal(h.states.at(-1).status,'restoring');assert.equal(h.states.at(-1).session,null);assert.equal(h.timers.size,1);offline=false;
  const retry=[...h.timers.values()][0];retry();await flush();assert.equal(h.states.at(-1).status,'authenticated');h.observer.dispose();
});
test('foreground, focus, and online recovery coalesce and stop after disposal',async()=>{
  const pending=deferred(),h=setup(()=>pending.promise);await flush();h.win.dispatchEvent(new Event('online'));h.win.dispatchEvent(new Event('focus'));h.win.dispatchEvent(new Event('pageshow'));assert.equal(h.calls(),1);
  h.observer.dispose();const count=h.states.length;pending.resolve({data:{session:session('old')},error:null});await flush();h.win.dispatchEvent(new Event('online'));assert.equal(h.states.length,count);assert.equal(h.calls(),1);assert.equal(h.unsubscribed(),true);assert.equal(h.timers.size,0);
});
test('a background tab waits until visible before requesting a session',async()=>{
  const h=setup(async()=>({data:{session:null},error:null}));await flush();const count=h.calls();h.doc.visibilityState='hidden';h.win.dispatchEvent(new Event('focus'));await h.observer.recover();assert.equal(h.calls(),count);
  h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(h.calls(),count+1);assert.equal(h.states.at(-1).status,'guest');h.observer.dispose();
});
test('persistent auth keeps the existing storage key and probes storage without touching tokens',()=>{
  const map=new Map([[AUTH_STORAGE_KEY,'existing SDK session']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  assert.equal(persistentStorageAvailable(storage),true);assert.deepEqual([...map],[[AUTH_STORAGE_KEY,'existing SDK session']]);assert.equal(persistentStorageAvailable({setItem:()=>{throw Error('blocked');}}),false);assert.equal(persistentStorageAvailable(null),false);
  assert.equal(persistentAuthOptions.storageKey,AUTH_STORAGE_KEY);assert.equal(persistentAuthOptions.persistSession,true);assert.equal(persistentAuthOptions.autoRefreshToken,true);
});
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const jwt=exp=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp,iat:Math.floor(Date.now()/1000),role:'authenticated',aud:'authenticated'})).toString('base64url'),'synthetic-test-signature'].join('.');
function sdkHarness(){
  const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)},requests=[];
  const fetch=async(url,options)=>{
    const type=new URL(url).searchParams.get('grant_type');requests.push(type||'logout');
    if(String(url).includes('/logout'))return Response.json({});
    return Response.json({access_token:jwt(Math.floor(Date.now()/1000)+3600),refresh_token:type==='refresh_token'?'rotated-refresh':'initial-refresh',token_type:'bearer',expires_in:3600,user});
  };
  const make=()=>createClient('https://auth-persistence-test.supabase.co','public-test-key',{auth:{...persistentAuthOptions,storage},global:{fetch}});
  return {map,storage,requests,make};
}
test('the installed Supabase SDK restores the same login from persistent storage after creating a fresh client',async t=>{
  const h=sdkHarness(),first=h.make();t.after(()=>first.auth.stopAutoRefresh());
  const signed=await first.auth.signInWithPassword({email:user.email,password:'synthetic-test-password'});assert.equal(signed.error,null);assert.ok(h.map.has(AUTH_STORAGE_KEY));await first.auth.stopAutoRefresh();
  const second=h.make();t.after(()=>second.auth.stopAutoRefresh());const restored=await second.auth.getSession();assert.equal(restored.error,null);assert.equal(restored.data.session.user.id,user.id);assert.equal(h.requests.filter(r=>r==='password').length,1);
});
test('the installed SDK rotates expired tokens in the same storage and sign-out removes the stored session',async t=>{
  const h=sdkHarness(),expired={access_token:jwt(Math.floor(Date.now()/1000)-120),refresh_token:'expired-access-refresh',expires_at:Math.floor(Date.now()/1000)-120,expires_in:3600,token_type:'bearer',user};
  h.map.set(AUTH_STORAGE_KEY,JSON.stringify(expired));const client=h.make();t.after(()=>client.auth.stopAutoRefresh());const result=await client.auth.getSession();assert.equal(result.error,null);assert.equal(result.data.session.refresh_token,'rotated-refresh');assert.equal(JSON.parse(h.map.get(AUTH_STORAGE_KEY)).refresh_token,'rotated-refresh');assert.ok(h.requests.includes('refresh_token'));
  const signout=await client.auth.signOut({scope:'local'});assert.equal(signout.error,null);assert.equal(h.map.has(AUTH_STORAGE_KEY),false);assert.equal((await client.auth.getSession()).data.session,null);
});
