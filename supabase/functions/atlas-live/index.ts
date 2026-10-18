// Public read-only, reduced Train Describer event endpoint.
// Deployment: Supabase Edge Function 'atlas-live', set verify_jwt=false for public site.
// The Supabase service-role secret exists ONLY in this server runtime.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const headers={
  'access-control-allow-origin':'https://mikelnewell.github.io',
  'access-control-allow-methods':'GET, OPTIONS',
  'access-control-allow-headers':'content-type',
  'cache-control':'no-store',
  'content-type':'application/json'
};
function respond(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers})}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return respond({error:'Method not allowed'},405);
 const allowed=Deno.env.get('ATLAS_TD_AREAS')?.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean)||[];
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key||!allowed.length)return respond({status:'unconfigured',generated_at:new Date().toISOString(),events:[],message:'Server needs verified TD area IDs and a Supabase connection.'},503);
 try{
   const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const since=new Date(Date.now()-1000*60*45).toISOString();
   const {data,error}=await db.from('td_events')
     .select('area_id,msg_type,description,from_berth,to_berth,berth,event_time')
     .in('area_id',allowed).gte('event_time',since)
     .order('event_time',{ascending:false}).limit(150);
   if(error)throw error;
   const events=data||[];
   const recent=events.length && Date.now()-new Date(events[0].event_time).getTime()<180000;
   return respond({
     status:recent?'recent_events':'no_recent_events',
     generated_at:new Date().toISOString(),
     newest_event_time:events.length?events[0].event_time:null,
     observation:'Train Describer berth descriptions, not GPS positions. Signal aspects not included.',
     areas:allowed,events
   });
 }catch(error){console.error('Read-only TD API failure',error);return respond({status:'unavailable',generated_at:new Date().toISOString(),events:[]},503)}
});
