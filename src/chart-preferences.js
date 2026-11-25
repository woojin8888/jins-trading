import {MAX_STUDIES,normalizeStudy} from './indicators.js';
import {MA_TYPES,MA_SOURCES} from './technical-math.js';
export const CHART_SETTINGS_KEY='jins-trading:chart-preferences:v1';
export const MAX_MOVING_AVERAGES=8;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
const integer=(value,min,max,fallback)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
export function defaultMovingAverages(){return [20,50,150,200].map((period,index)=>({id:'ma-'+period,type:'sma',source:'close',period,color:['#111111','#3478ef','#9c6cda','#ec6d9d'][index],width:period===20?3:1,visible:true}));}
export function defaultChartPreferences(){return {version:5,logScale:false,rsMode:'uploaded',showTickerWatermark:true,movingAverages:defaultMovingAverages(),showRS:true,showVolume:true,showProfile:false,autoRefresh:true,volume:{position:'overlay',height:20,format:'korean',mode:'bars',averageVisible:true,averagePeriod:20,averageType:'sma',averageColor:'#5c6678',averageWidth:1},profile:{mode:'visible',rows:32,width:150,valueArea:70,fixedBars:150,color:'#9a9a9a',pocColor:'#6b7280',showPOC:true,showVA:true},studies:[],pendingSeparatedProfiles:[]};}
export function normalizeMovingAverage(raw){
  if(typeof raw?.id!=='string'||!/^ma-[\w-]{1,76}$/.test(raw.id))return null;
  return {id:raw.id,type:MA_TYPES.some(([type])=>type===raw.type)?raw.type:'sma',source:MA_SOURCES.some(([source])=>source===raw.source)?raw.source:'close',period:integer(raw.period,1,500,20),color:color(raw.color,'#111111'),width:integer(raw.width,1,4,raw.period===20?3:1),visible:raw.visible!==false};
}
export function normalizePreferences(raw){
  const defaults=defaultChartPreferences();if(![1,2,3,4,5].includes(raw?.version))return defaults;
  const seen=new Set(),studies=[],legacyProfiles=[],pendingSeparatedProfiles=[];
  for(const candidate of (Array.isArray(raw.studies)?raw.studies:[]).slice(0,100)){
    const study=normalizeStudy(candidate);if(!study||seen.has(study.id)||study.id.startsWith('ma-'))continue;
    seen.add(study.id);studies.push(study);
    if(candidate.type==='minerviniTemplate'&&Object.hasOwn(candidate.params||{},'showFixedProfile')&&candidate.params.showFixedProfile!==false)legacyProfiles.push(candidate);
    if(studies.length===MAX_STUDIES)break;
  }
  // Preserve existing slots first. A split profile waits if all 12 are occupied.
  function keepProfile(profile){if(!profile||profile.type!=='pineVolumeProfile'||seen.has(profile.id)||profile.id.startsWith('ma-'))return;seen.add(profile.id);if(studies.length<MAX_STUDIES)studies.push(profile);else if(pendingSeparatedProfiles.length<MAX_STUDIES)pendingSeparatedProfiles.push(profile);}
  for(const saved of (Array.isArray(raw.pendingSeparatedProfiles)?raw.pendingSeparatedProfiles:[]).slice(0,MAX_STUDIES))keepProfile(normalizeStudy(saved));
  for(const legacy of legacyProfiles){
    let suffix='-pine-vp',id=legacy.id.slice(0,80-suffix.length)+suffix,index=1;
    while(seen.has(id)){suffix='-pine-vp-'+index++;id=legacy.id.slice(0,80-suffix.length)+suffix;}
    keepProfile(normalizeStudy({...legacy,id,type:'pineVolumeProfile',color:typeof legacy.color==='string'&&legacy.color.toLowerCase()==='#ef5350'?defaults.profile.pocColor:legacy.color,params:{...legacy.params,showPOC:true}}));
  }
  let movingAverages;
  if(raw.version===1)movingAverages=defaultMovingAverages().map(ma=>({...ma,visible:Array.isArray(raw.averages)?raw.averages.includes(ma.period):true}));
  else if(!Array.isArray(raw.movingAverages))movingAverages=defaults.movingAverages;
  else{const ids=new Set();movingAverages=raw.movingAverages.slice(0,50).map(normalizeMovingAverage).filter(ma=>{if(!ma||ids.has(ma.id))return false;ids.add(ma.id);return true;}).slice(0,MAX_MOVING_AVERAGES);}
  const v=raw.volume||{},p=raw.profile||{};
  return {...defaults,...Object.fromEntries(['showRS','showVolume','showProfile','autoRefresh','showTickerWatermark','logScale'].map(key=>[key,typeof raw[key]==='boolean'?raw[key]:defaults[key]])),movingAverages,studies,pendingSeparatedProfiles,autoRefresh:raw.version<5?true:(typeof raw.autoRefresh==='boolean'?raw.autoRefresh:true),rsMode:raw.rsMode==='benchmark'?'benchmark':'uploaded',
    volume:{position:v.position==='panel'?'panel':'overlay',height:integer(v.height,10,40,20),format:raw.version<3?'korean':['shares','compact','korean'].includes(v.format)?v.format:'korean',mode:v.mode==='line'?'line':'bars',averageVisible:v.averageVisible!==false,averagePeriod:integer(v.averagePeriod,1,500,20),averageType:['sma','ema'].includes(v.averageType)?v.averageType:'sma',averageColor:color(v.averageColor,defaults.volume.averageColor),averageWidth:integer(v.averageWidth,1,4,1)},
    profile:{mode:p.mode==='recent'?'recent':'visible',rows:integer(p.rows,8,120,32),width:integer(p.width,60,260,150),valueArea:integer(p.valueArea,1,100,70),fixedBars:integer(p.fixedBars,10,2000,150),color:raw.version<4&&typeof p.color==='string'&&p.color.toLowerCase()==='#6da4ed'?defaults.profile.color:color(p.color,defaults.profile.color),pocColor:typeof p.pocColor==='string'&&['#dba141','#f59e0b','#ff9800'].includes(p.pocColor.toLowerCase())?defaults.profile.pocColor:color(p.pocColor,defaults.profile.pocColor),showPOC:p.showPOC!==false,showVA:p.showVA!==false}};
}
