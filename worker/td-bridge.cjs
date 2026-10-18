'use strict';
/*
 * Phase 2 integration scaffold: authenticated Network Rail STOMP -> Supabase.
 * Requires a persistent process and external credentials. Not deployed as part
 * of Phase 1. Never publish your service role key or feed password to frontend.
 */
const stompit = require('stompit');
const {parseTD} = require('./td-parser.cjs');
const required = ['NETWORK_RAIL_USERNAME','NETWORK_RAIL_PASSWORD','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TD_AREA_IDS'];
const missing = required.filter(v => !process.env[v]);
if (missing.length) { console.error(`Missing environment variables: ${missing.join(', ')}`); process.exit(1); }

const settings = {
  host: process.env.NETWORK_RAIL_HOST || 'publicdatafeeds.networkrail.co.uk',
  port: Number(process.env.NETWORK_RAIL_PORT || '61618'),
  topic: process.env.NETWORK_RAIL_TOPIC || '/topic/TD_ALL_SIG_AREA',
  permittedAreas: process.env.TD_AREA_IDS.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),
  url: process.env.SUPABASE_URL.replace(/\/$/, ''),
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  maxQueue: 6000,
};
if (!settings.permittedAreas.length) { console.error('Provide explicitly approved TD_AREA_IDS after verifying local coverage.'); process.exit(1); }
let retry = 1000;
let client = null;
let queue = [];
let processing = false;
let active = true;

async function persist(batch) {
  const response = await fetch(`${settings.url}/rest/v1/td_events?on_conflict=area_id,msg_type,event_time,from_berth,to_berth,description`, {
    method: 'POST',
    headers: {
      apikey: settings.serviceKey,
      Authorization: `Bearer ${settings.serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(batch)
  });
  if(!response.ok) throw new Error(`Supabase error ${response.status}: ${(await response.text()).slice(0,200)}`);
}
async function flush() {
  if (processing || !queue.length || !client) return;
  processing = true;
  const chunk = queue.splice(0,100);
  try {
    const records = chunk.flatMap(item => item.rows);
    if (records.length) await persist(records);
    // ACK only after persistence (or deliberate exclusion by geographic filter).
    for (const item of chunk) { try { item.client.ack(item.frame); } catch {} }
  } catch (error) {
    console.error('Persistence failed, messages left unacknowledged:',error.message);
    queue.unshift(...chunk);
    if (client) { try { client.disconnect(); } catch {} }
    client=null;
    retryLater();
  } finally {processing=false;}
}
function retryLater(){
  if(!active)return;
  const delay=retry; retry=Math.min(retry*2,60000);
  console.error(`Reconnecting after ${Math.round(delay/1000)} s`);
  setTimeout(connect,delay);
}
function connect(){
  if(!active)return;
  const headers={host:settings.host,login:process.env.NETWORK_RAIL_USERNAME,passcode:process.env.NETWORK_RAIL_PASSWORD,'heart-beat':'10000,10000','client-id':`stockport-rail-atlas-${process.env.WORKER_CLIENT_SUFFIX||'primary'}`};
  stompit.connect({host:settings.host,port:settings.port,connectHeaders:headers},(error,c)=>{
    if(error){
      console.error('Broker connection failed:',error.message);
      if(/auth|credential|denied|not authorized|unknown user/i.test(error.message)){console.error('Authentication/authorisation failure, stopping to avoid repeated attempts.');process.exitCode=1;active=false;return;}
      retryLater();return;
    }
    client=c;retry=1000;queue=[];
    console.log(`Connected to Network Rail. Subscribing to ${settings.topic}; area filters: ${settings.permittedAreas.join(',')}`);
    c.on('error',err=>{console.error('Broker error:',err.message);client=null;retryLater();});
    c.subscribe({destination:settings.topic,ack:'client-individual','activemq.subscriptionName':`stockport-atlas-${process.env.WORKER_CLIENT_SUFFIX||'primary'}`},(subErr,frame)=>{
      if(subErr){console.error('Subscription error:',subErr.message);try{c.disconnect();}catch{}client=null;retryLater();return;}
      let body='';
      frame.on('data',buf=>{body+=buf.toString('utf8');});
      frame.on('end',()=>{
        if(queue.length>=settings.maxQueue){console.error('Queue capacity exceeded, pausing connection rather than dropping messages.');try{c.disconnect();}catch{} client=null;retryLater();return;}
        const rows=parseTD(body,settings.permittedAreas);
        queue.push({client:c,frame,rows});
        if(queue.length>=50)void flush();
      });
    });
  });
}
setInterval(()=>{if(client)void flush();},1000).unref();
process.on('SIGINT',()=>{active=false;if(client)try{client.disconnect();}catch{}process.exit(0);});
process.on('SIGTERM',()=>{active=false;if(client)try{client.disconnect();}catch{}process.exit(0);});
connect();
