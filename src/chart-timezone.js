import {timestampKey} from './timeframes.js';

// Display time is independent of the exchange's session and candle boundaries.
export const CHART_TIME_ZONE='Asia/Seoul';
export const CHART_TIME_ZONE_LABEL='한국시간 (KST · UTC+9)';
export const chartDate=time=>typeof time==='number'?new Date(time*1000).toLocaleDateString('sv-SE',{timeZone:CHART_TIME_ZONE}):timestampKey(time);
