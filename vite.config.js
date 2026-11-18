import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {routeMarket} from './server/market.js';
export default defineConfig({build:{rolldownOptions:{output:{codeSplitting:{groups:[{debugName:'supabase-client',name(moduleId){return moduleId.includes('/node_modules/@supabase/')?'supabase-client':null;}}]}}}},plugins:[react(),{name:'market-development-api',configureServer(server){server.middlewares.use('/api/market',async(req,res)=>{try{const result=await routeMarket(new URL(req.url,'http://localhost'));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());}catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'데이터 조회 중 오류가 발생했습니다.'}));}});}}]});
