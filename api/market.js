import {routeMarket} from '../server/market.js';
export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
  const result=await routeMarket(new URL(req.url,'https://jins-trading.vercel.app'));
  for(const [key,value] of result.headers)res.setHeader(key,value);
  res.status(result.status).send(await result.text());
}
