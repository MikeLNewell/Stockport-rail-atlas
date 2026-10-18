// Reliable static railway geometry import for the Stockport area.
// Primary: RailEasy's GB railway reference line dataset (Network Rail/OGL),
// distributed under CC BY-SA 4.0. Secondary: OpenStreetMap/ODbL Overpass.
import {writeFile} from 'node:fs/promises';
const centre=[53.40545,-2.16304], radius=32186.88;
const dataUrl='https://raw.githubusercontent.com/raileasyuk/railway-gis-data/main/rail-map/track%20only.geojson';
const lat=centre[0],lon=centre[1];
function distanceKm(coord) {
 const dy=(coord[1]-lat)*111.32;
 const dx=(coord[0]-lon)*111.32*Math.cos(lat*Math.PI/180);
 return Math.hypot(dx,dy);
}
function simplifyAndClip(input,kind){
 const out=[];
 const inputs=input.type==='FeatureCollection'?input.features||[]:input.type==='Feature'?[input]:[];
 for(const feature of inputs){
  const geom=feature?.geometry;
  if(!geom||!['LineString','MultiLineString'].includes(geom.type))continue;
  const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
  for(const coords of lines) {
   if(!Array.isArray(coords)||coords.length<2)continue;
   let run=[];
   const flush=()=>{
    if(run.length>1){
     out.push({type:'Feature',properties:{
      source:kind,reference:feature.properties?.ref??feature.properties?.ELR??null,
      source_geometry_type:geom.type,verified_signalling_control:false
     },geometry:{type:'LineString',coordinates:run}});
    }
    run=[];
   };
   for(let i=0;i<coords.length-1;i++){
    const p=coords[i],q=coords[i+1];
    if(!Array.isArray(p)||!Array.isArray(q)||!Number.isFinite(p[0])||!Number.isFinite(p[1])){flush();continue;}
    // Retain crossing segments intact; if both endpoints outside, omit.
    // This is clipped by distance to reference points, not a surveyed signalling boundary.
    const within=distanceKm(p)<34.5||distanceKm(q)<34.5;
    if(within){
      if(!run.length)run.push([+p[0].toFixed(6),+p[1].toFixed(6)]);
      run.push([+q[0].toFixed(6),+q[1].toFixed(6)]);
    } else flush();
   }
   flush();
  }
 }
 return out;
}
async function request(url,timeoutMs=100000){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try {const r=await fetch(url,{signal:ctl.signal,headers:{'user-agent':'StockportRailAtlas/0.2 open-rail-geometry-import'}});
 if(!r.ok)throw Error('HTTP '+r.status+' '+url);return await r.json();
 }finally{clearTimeout(timer)}
}
let features=[],sourceLabel='',licence='',attribution='';
try{
 const data=await request(dataUrl);
 features=simplifyAndClip(data,'Network Rail reference linework / RailEasy');
 if(features.length<15)throw Error('Source returned only '+features.length+' usable line segments');
 sourceLabel='Raileasy railway-gis-data, Network Rail reference line model (simplified)';
 licence='CC BY-SA 4.0, with underlying Network Rail Open Government Licence data';
 attribution='© Raileasy Ltd; contains Network Rail data licensed under OGL v3';
 console.log('Imported',features.length,'reference-line features from verified open dataset');
}catch(e){console.warn('Reference line source failed:',e.message)}
if(features.length<15) {
 const q='[out:json][timeout:100];way["railway"~"^(rail|light_rail|tram)$"](around:'+Math.round(radius)+','+lat+','+lon+');out geom qt;';
 for(const endpoint of ['https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']){
  try{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),130000);
   let r;
   try{r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:q}),signal:ctl.signal});}
   finally{clearTimeout(timer)}
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   const geo={type:'FeatureCollection',features:(data.elements||[]).filter(e=>e.type==='way'&&e.geometry?.length>1).map(e=>({type:'Feature',properties:{ref:e.tags?.ref||null},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}}))};
   features=simplifyAndClip(geo,'OpenStreetMap');
   if(features.length<15)throw Error('Only '+features.length+' lines returned');
   sourceLabel='OpenStreetMap via Overpass';licence='ODbL';attribution='© OpenStreetMap contributors';
   break;
  }catch(e){console.warn('Overpass fallback unavailable',endpoint,e.message)}
 }
}
if(features.length<15)throw Error('No verified railway geometry could be downloaded. Existing track file left unchanged.');
if(features.length>50000)throw Error('Unexpected feature count: '+features.length);
const payload={type:'FeatureCollection',metadata:{
 source:sourceLabel,licence,attribution,source_url:sourceLabel.startsWith('Raileasy')?'https://github.com/raileasyuk/railway-gis-data':null,
 retrieved_at:new Date().toISOString(),centre,radius_metres:radius,
 warning:'Simplified railway reference geometry. It does not establish individual rails, signal aspects, point positions or signal-box control boundaries.'
},features};
await writeFile('site/data/railway.geojson',JSON.stringify(payload));
console.log('Stored',features.length,'segments, bytes',Buffer.byteLength(JSON.stringify(payload)));
