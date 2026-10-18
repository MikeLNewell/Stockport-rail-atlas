// Import actual OSM railway ways (not imagery) as GeoJSON stored with the GitHub Pages site.
// Data © OpenStreetMap contributors, ODbL. Do not invent missing track alignments.
import {writeFile} from 'node:fs/promises';
const LAT=53.40545, LON=-2.16304, RADIUS=32186.88;
const query='[out:json][timeout:100];way["railway"~"^(rail|light_rail|tram)$"](around:'+Math.round(RADIUS)+','+LAT+','+LON+');out geom qt;';
const urls=['https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
const dedup=new Map();
let succeeded=false,errors=[];
function distanceMetres(a,b) {
 const lat1=a*Math.PI/180,lat2=b*Math.PI/180;
 return Math.abs(lat1-lat2)*6371000;
}
async function fetchWays(endpoint) {
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),145000);
 try {
  const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'StockportRailAtlas/0.2 (openstreetmap geometry import)'},body:new URLSearchParams({data:query}),signal:ctrl.signal});
  if(!res.ok)throw Error('HTTP '+res.status);
  const data=await res.json();
  if(!Array.isArray(data.elements))throw Error('Missing OSM elements');
  return data.elements.filter(w=>w.type==='way'&&Array.isArray(w.geometry)&&w.geometry.length>=2);
 } finally { clearTimeout(timer); }
}
for(const endpoint of urls){
 try {
  const ways=await fetchWays(endpoint);
  if(ways.length<100)throw Error('Insufficient railway features ('+ways.length+'); refusing to overwrite existing dataset');
  for(const w of ways)dedup.set('way/'+w.id,w);
  console.log('Retrieved',ways.length,'railway ways from',endpoint);
  succeeded=true;break;
 }catch(e){console.warn(endpoint,e.message);errors.push(endpoint+': '+e.message);}
}
if(!succeeded)throw Error('All geometry sources failed. Existing published data will remain unchanged. '+errors.join('; '));
const features=[...dedup.values()].map(w=>({
 type:'Feature',
 id:'way/'+w.id,
 properties:{
  osm_id:w.id,osm_type:'way',railway:w.tags?.railway??'rail',
  name:w.tags?.name??null,ref:w.tags?.ref??null,service:w.tags?.service??null,
  usage:w.tags?.usage??null,source:'OpenStreetMap',source_url:'https://www.openstreetmap.org/way/'+w.id
 },
 geometry:{type:'LineString',coordinates:w.geometry.filter(n=>Number.isFinite(n.lon)&&Number.isFinite(n.lat)).map(n=>[+n.lon.toFixed(6),+n.lat.toFixed(6)])}
})).filter(f=>f.geometry.coordinates.length>=2);
const collection={type:'FeatureCollection',metadata:{
 title:'Stockport Rail Atlas OSM railway linework',
 source:'OpenStreetMap via Overpass API',licence:'Open Database Licence (ODbL)',attribution:'© OpenStreetMap contributors',
 retrieved_at:new Date().toISOString(),scope:'Railway ways intersecting approximately 20 miles of Stockport station; unverified operating status',
 radius_metres:RADIUS,centroid:[LAT,LON],verified_control_assignments:false,train_berth_mapping:false
},features};
if(!features.length)throw Error('No valid geometries extracted; aborting');
await writeFile('site/data/railway.geojson',JSON.stringify(collection));
console.log('Wrote',features.length,'OSM railway ways; file can be served statically by GitHub Pages.');