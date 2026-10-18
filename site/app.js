/* Stockport Rail Atlas | Phase 1 | No simulated live train states */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = 'stockport-rail-atlas-research-v1';
  const state = {
    data: null, map: null, selected: null, selectedFeature: null, boxesLayer: null, regionalBoxLayer: null, regionalBoxes: [],
    railLayer: null, signalTileLayer: null, studyLayer: null, researchLayer: null,
    osmLayer: null, OSM: [], mapStyle: 'dark', activeLayers: {
      railways: true, signalTiles: false, boxes: true, radius: true, osmFeatures: true, drafts: true
    }, markers: new Map(), lastOSMQuery: '', fetchInProgress: false,
    osmTimeout: null, drawPoints: [], drawActive: false, drawingLayer: null,
    draftPending: null, research: loadResearch(), currentPanel: ''
  };
  const FIXED_ORDER = ['edgeley-1','edgeley-2','stockport-1','stockport-2','heaton-norris'];
  const URLS = {
    darkVector: 'https://tiles.openfreemap.org/styles/dark',
    lightVector: 'https://tiles.openfreemap.org/styles/positron',
    base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    railway: 'https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    signals: 'https://tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png'
  };
  let baseTiles = null;
  let toastTimeout = null;
  let baseErrors = 0;
  let railwayErrors = 0;
  function mapHealth(message) {
    const el = $('#map-health');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function rasterBasemap(map) {
    if (baseTiles && map.hasLayer(baseTiles)) map.removeLayer(baseTiles);
    baseTiles = L.tileLayer(URLS.base, {
      maxZoom:19,
      referrerPolicy:'strict-origin-when-cross-origin',
      className:'atlas-basemap' + (state.mapStyle === 'dark' ? ' atlas-basemap-dark' : ''),
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);
    baseTiles.bringToBack();
    baseTiles.on('tileerror', () => {
      if (++baseErrors === 3) mapHealth('Background tiles could not load. Check whether your browser blocks third-party mapping requests.');
    });
  }
  function addBasemap(map) { rasterBasemap(map); }
  function escapeHTML(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function validURL(s) { try { const u = new URL(s); return ['http:','https:'].includes(u.protocol); } catch { return false; } }
  function number(value) { return Number(value).toLocaleString('en-GB'); }
  function loadResearch() {
    try { const r=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); return Array.isArray(r) ? r.filter(d=>Array.isArray(d.geometry)&&typeof d.boxId==='string') : []; }
    catch { return []; }
  }
  function saveResearch() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state.research)); } catch { toast('Browser storage unavailable. Export your research to retain it.'); } updateLayerHints(); }
  function toast(msg) { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),4800); }
  function fmtCoords(coords) { return `${coords[0].toFixed(5)}° N, ${Math.abs(coords[1]).toFixed(5)}° W`; }
  function makeLink(url, text='View source') { return validURL(url) ? `<a class="source-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHTML(text)}</a>` : ''; }

  function initMap() {
    if (!window.L) { $('#map').innerHTML='<div class="map-placeholder">Could not load Leaflet from CDN. Check your internet connection.</div>'; toast('Map library unavailable. Check internet access.'); return; }
    const {centre, radiusMetres} = state.data.study;
    $('#map').innerHTML='';
    const map=L.map('map',{zoomControl:true,attributionControl:true,preferCanvas:true,worldCopyJump:false,minZoom:7,maxZoom:19}).setView(centre,13);
    state.map=map;
    // Put railway and signalling tiles above the vector basemap but below markers and annotations.
    map.createPane('railway-tracks');
    map.getPane('railway-tracks').style.zIndex='335';
    map.getPane('railway-tracks').style.pointerEvents='none';
    map.createPane('railway-signals');
    map.getPane('railway-signals').style.zIndex='345';
    map.getPane('railway-signals').style.pointerEvents='none';
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => requestAnimationFrame(() => map.invalidateSize({pan:false,animate:false})));
      observer.observe($('#map'));
    }
    requestAnimationFrame(() => map.invalidateSize({pan:false,animate:false}));
    addBasemap(map);
    state.railLayer=L.tileLayer(URLS.railway,{pane:'railway-tracks',maxZoom:19,opacity:.88,referrerPolicy:'strict-origin-when-cross-origin',attribution:'Style: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA), data: OpenStreetMap contributors'}).addTo(map);
    state.railLayer.on('tileerror',() => {
      if (++railwayErrors === 4) mapHealth('OpenRailwayMap railway tiles could not load. Try again later or turn off the railway overlay.');
    });
    state.signalTileLayer=L.tileLayer(URLS.signals,{pane:'railway-signals',maxZoom:19,opacity:.96,referrerPolicy:'strict-origin-when-cross-origin',attribution:'OpenRailwayMap signals, static OSM data'});
    // The boundary and centre point are one managed layer so the checkbox hides both.
    state.studyLayer=L.featureGroup([
      L.circle(centre,{radius:radiusMetres,weight:2,color:'#62adc6',dashArray:'7 8',opacity:.9,fillColor:'#5294c6',fillOpacity:.018,interactive:false}),
      L.circleMarker(centre,{radius:5,color:'#eafaff',weight:2,fillColor:'#66c2ef',fillOpacity:.9})
        .bindTooltip('Stockport station · centre of study',{className:'map-label',direction:'bottom',offset:[0,8]})
    ]).addTo(map);
    state.boxesLayer=L.layerGroup().addTo(map);
    state.regionalBoxLayer=L.layerGroup().addTo(map);
    state.osmLayer=L.layerGroup().addTo(map);
    state.researchLayer=L.layerGroup().addTo(map);
    state.drawingLayer=L.layerGroup().addTo(map);
    drawBoxes(); drawResearch();
    map.on('moveend zoomend', () => { $('#map-context').textContent='20-MILE STUDY AREA · Z'+map.getZoom(); if (state.activeLayers.osmFeatures) scheduleFetchOSM(); updateLayerHints(); });
    map.on('click', e => {
      if (!state.drawActive) return;
      state.drawPoints.push([+e.latlng.lat.toFixed(6),+e.latlng.lng.toFixed(6)]);
      redrawInProgress(); renderDetails();
    });
    $('#map-context').textContent='20-MILE STUDY AREA · Z' + map.getZoom();
    scheduleFetchOSM();
    fetchRegionalBoxes();
    updateLayerHints();
  }
  function drawBoxes() {
    state.boxesLayer.clearLayers(); state.markers.clear();
    for(const box of state.data.boxes){
      const icon=L.divIcon({html:`<div class="signalbox-pin${state.selected===box.id?' active':''}"><span>⌘</span></div>`,className:'',iconSize:[27,27],iconAnchor:[13,13]});
      const marker=L.marker(box.coordinates,{icon,zIndexOffset:1000}).addTo(state.boxesLayer);
      marker.bindTooltip(box.name,{className:'map-label',direction:'right',offset:[13,0]});
      marker.on('click',()=>selectBox(box.id));
      state.markers.set(box.id,marker);
    }
  }
  function drawResearch(){
    if(!state.researchLayer)return;
    state.researchLayer.clearLayers();
    for(const d of state.research){
      const p=L.polygon(d.geometry,{color:'#a69afe',dashArray:'6 6',weight:2,fillColor:'#796ad0',fillOpacity:.17}).addTo(state.researchLayer);
      p.bindTooltip(`${d.boxName} · unverified draft`,{className:'map-label'});
      p.on('click',()=>selectBox(d.boxId));
    }
  }
  function syncLayers(){
    if (!state.map) return;
    const pairs=[['railways',state.railLayer],['signalTiles',state.signalTileLayer],['boxes',state.boxesLayer],['radius',state.studyLayer],['osmFeatures',state.osmLayer],['drafts',state.researchLayer]];
    for(const [name,layer] of pairs){if(state.activeLayers[name]&&!state.map.hasLayer(layer))layer.addTo(state.map);if(!state.activeLayers[name]&&state.map.hasLayer(layer))state.map.removeLayer(layer);}
    if (state.activeLayers.osmFeatures) scheduleFetchOSM();
    if (state.regionalBoxLayer) { if(state.activeLayers.boxes && !state.map.hasLayer(state.regionalBoxLayer))state.regionalBoxLayer.addTo(state.map);if(!state.activeLayers.boxes && state.map.hasLayer(state.regionalBoxLayer))state.regionalBoxLayer.remove(); }
    $('#count-features').textContent=state.OSM.length ? number(state.OSM.length):'—';
    updateLayerHints();
  }
  function zoomCorridor(){ state.map?.flyTo([53.4057,-2.1645],14,{duration:.65}); }
  function zoomRegion(){ if (!state.map)return; state.map.flyToBounds(state.studyLayer.getBounds(),{duration:.75,padding:[24,24]}); }

  function populateList(){
    $('#box-list').innerHTML=state.data.boxes.map(b=>`<button class="box-item ${state.selected===b.id?'selected':''}" data-box="${escapeHTML(b.id)}"><span class="box-icon">⌘</span><span class="box-item-name">${escapeHTML(b.name)}<span class="box-item-meta">Published location · controls under research</span></span><span class="box-arrow">›</span></button>`).join('');
    $$('[data-box]').forEach(el=>el.addEventListener('click',()=>selectBox(el.dataset.box)));
    $('#count-boxes').textContent=String(state.data.boxes.length);
  }
  function selectBox(id, fly=true){
    const b=state.data.boxes.find(v=>v.id===id); if (!b) return;
    state.selected=b.id;state.selectedFeature=null; state.currentPanel='box';
    if (state.drawActive) cancelDraw();
    populateList();drawBoxes();renderDetails();
    if(fly)state.map?.flyTo(b.coordinates,Math.max(state.map.getZoom(),15),{duration:.5});
    $('#inspector').classList.add('open');
    $('#sidebar').classList.remove('open');
  }
  function panelEmpty(){
    $('#inspector-content').innerHTML=`<div class="inspector-empty"><div class="inspector-illustration"><span>╱╲</span><span>◇</span><span>╲╱</span></div><div class="empty-label">NO SELECTION</div><h2>Explore the network</h2><p>Select a signal box, railway signal or set of points to inspect its known infrastructure and supporting sources.</p><button class="primary-button" id="empty-start">Explore Stockport boxes ↗</button></div>`;
    $('#empty-start').addEventListener('click',()=>selectBox('stockport-2'));
  }
  function renderDetails(){
    if(state.selectedFeature) return renderOSMFeature(state.selectedFeature);
    const b=state.data?.boxes.find(x=>x.id===state.selected);
    if(!b){panelEmpty();return;}
    const ownDrafts=state.research.filter(d=>d.boxId===b.id);
    const hist=Array.isArray(b.historicalExamples)?`<div class="note-card amber" style="margin-top:11px"><b>1981 examples (historical only)</b><br>${b.historicalExamples.map(v=>escapeHTML(v)).join('<br>')}</div>`:'';
    const scheme=FIXED_ORDER.map(id=>{const a=state.data.boxes.find(x=>x.id===id);return `<div class="scheme-row"><div class="scheme-track"><span class="scheme-node ${id===b.id?'on':''}"></span></div><span class="scheme-name">${escapeHTML(a.short)}</span></div>`;}).join('');
    const drawForm=state.draftPending?.boxId===b.id?`<div class="detail-section"><h3>SAVE UNVERIFIED BOUNDARY</h3><p class="research-help">Save a research annotation with supporting evidence. It will always be labelled an unverified draft, not a verified control boundary.</p><form id="save-draft-form" class="research-fields"><label>Source URL (required)<input id="draft-source" type="url" required placeholder="https://…" /></label><label>Annotation / date (optional)<input id="draft-note" type="text" placeholder="Source, applicable period or uncertainty" maxlength="240" /></label><button class="primary-button" type="submit">Save local research draft</button><button type="button" class="outline-button" id="cancel-draft">Cancel</button></form></div>`:'';
    const drawing=state.drawActive?`<div class="note-card amber">Boundary tracing active: click points around the mapped area. ${state.drawPoints.length} vertices added. This is a draft only.</div><div class="detail-btn-row"><button id="finish-draw" class="primary-button" ${state.drawPoints.length<3?'disabled':''}>Finish outline (${state.drawPoints.length})</button><button id="cancel-draw" class="outline-button">Cancel</button></div>`:'';
    $('#inspector-content').innerHTML=`
      <div class="detail-type">SIGNALLING / CONTROL LOCATION</div><h2 class="detail-heading">${escapeHTML(b.name)}</h2>
      <p class="detail-sub">${escapeHTML(b.description)}</p>
      <div class="pills"><span class="pill blue">MAPPED LOCATION</span><span class="pill warning">CONTROL EXTENT UNVERIFIED</span></div>
      <div class="detail-section"><h3>LOCATION RECORD</h3><dl class="detail-dl"><dt>Type</dt><dd>${escapeHTML(b.type)}</dd><dt>Coordinates</dt><dd>${fmtCoords(b.coordinates)}</dd><dt>Precision</dt><dd>${escapeHTML(b.locationAccuracy)}</dd><dt>Present-day equipment control</dt><dd>Individual signal/point allocations not yet verified</dd><dt>Verified control boundary</dt><dd>Not available</dd></dl>${makeLink(b.locationSource,'Published location source')}</div>
      <div class="detail-section"><h3>ADJOINING SIGNALLING LOCATIONS</h3><ul class="connection-list">${b.adjacent.map(id=>{const n=state.data.boxes.find(t=>t.id===id);return `<li><button data-neighbour="${escapeHTML(id)}">↗ ${escapeHTML(n?.name||id)}</button></li>`;}).join('')}</ul><p class="scheme-caption">These are documented neighbouring boxes, not measured signalling control polygons.</p>${makeLink(b.relationshipSource,'Corridor relationship source')}</div>
      <div class="detail-section"><h3>CORRIDOR SCHEMATIC</h3><div class="schematic">${scheme}</div><p class="scheme-caption">Conceptual north–south sequence of five signal boxes, not a track, route-setting or signal-aspect diagram.</p></div>
      <div class="detail-section"><h3>HISTORICAL RECORD</h3><div class="note-card amber">${escapeHTML(b.historicContext)}</div>${hist}${makeLink(b.historicSource,'Read historical source')}</div>
      <div class="detail-section"><h3>INDIVIDUAL SIGNALS & POINTS</h3><div class="note-card">No present-day signal-to-box or point-to-box assignments have been verified. Zoom in and enable OSM signals & points to view mapped physical features independently of control ownership.</div></div>
      <div class="detail-section"><h3>CONTROL BOUNDARY RESEARCH</h3><div class="note-card">${ownDrafts.length?`${ownDrafts.length} local, unverified research draft(s) attached to this box.`:'No verified polygon available. You can trace a provisional outline, but it will remain labelled as unverified.'}</div>${ownDrafts.map(d=>`<div class="detail-btn-row"><button class="outline-button" data-delete-draft="${escapeHTML(d.id)}">Remove draft ${escapeHTML(d.id.slice(-4))}</button></div>`).join('')}${drawing||drawForm||`<div class="detail-btn-row"><button id="start-draw" class="outline-button">✎ Trace research draft</button><button id="focus-selected" class="outline-button">⌖ Locate box</button></div>`}</div>
    `;
    $$('[data-neighbour]').forEach(btn=>btn.addEventListener('click',()=>selectBox(btn.dataset.neighbour)));
    $$('[data-delete-draft]').forEach(btn=>btn.addEventListener('click',()=>{state.research=state.research.filter(d=>d.id!==btn.dataset.deleteDraft);saveResearch();drawResearch();renderDetails();toast('Local draft removed.');}));
    $('#focus-selected')?.addEventListener('click',()=>state.map?.flyTo(b.coordinates,16));
    $('#start-draw')?.addEventListener('click',startDraw);
    $('#cancel-draw')?.addEventListener('click',cancelDraw);
    $('#finish-draw')?.addEventListener('click',finishDraw);
    $('#cancel-draft')?.addEventListener('click',()=>{state.draftPending=null;renderDetails();});
    $('#save-draft-form')?.addEventListener('submit',(event)=>{
      event.preventDefault(); const source=$('#draft-source').value.trim(), note=$('#draft-note').value.trim();
      if(!validURL(source)){toast('Enter a valid http(s) source URL.');return;}
      const item={id:`draft-${Date.now()}`,boxId:b.id,boxName:b.name,geometry:state.draftPending.geometry,source,note,status:'unverified',createdAt:new Date().toISOString()};
      state.research.push(item);state.draftPending=null;saveResearch();drawResearch();renderDetails();toast('Unverified draft saved in this browser.');
    });
  }
  function startDraw(){if(!state.map)return;state.drawActive=true;state.drawPoints=[];state.draftPending=null;state.map.getContainer().style.cursor='crosshair';redrawInProgress();renderDetails();toast('Click three or more vertices on the map to trace a provisional area.');}
  function cancelDraw(){state.drawActive=false;state.drawPoints=[];state.draftPending=null;state.map?.getContainer().style.removeProperty('cursor');state.drawingLayer?.clearLayers();renderDetails();}
  function redrawInProgress(){if(!state.drawingLayer)return;state.drawingLayer.clearLayers();if(state.drawPoints.length){ L.polyline(state.drawPoints,{color:'#d4b6ff',dashArray:'6 6',weight:3}).addTo(state.drawingLayer); for(const p of state.drawPoints)L.circleMarker(p,{radius:4,color:'#fff',fillColor:'#ac80ef',fillOpacity:1}).addTo(state.drawingLayer);}}
  function finishDraw(){if(state.drawPoints.length<3)return;state.draftPending={boxId:state.selected,geometry:[...state.drawPoints]};state.drawActive=false;state.drawPoints=[];state.drawingLayer.clearLayers();state.map.getContainer().style.removeProperty('cursor');renderDetails();}
  function renderOSMFeature(item){
    const {tags={},lat,lon}=item, type=tags.railway || 'railway feature', name=tags.name||tags.ref|| (type==='signal'?'Unnumbered mapped signal':'Unnumbered mapped point');
    const details=Object.entries(tags).filter(([key])=>['name','ref','railway','railway:signal:direction','railway:signal:main','railway:signal:position','railway:signal_box','railway:switch','railway:local_operated','operator','source','survey:date'].includes(key)).slice(0,12);
    const url=`https://www.openstreetmap.org/${item.type}/${item.id}`;
    $('#inspector-content').innerHTML=`<div class="detail-type">OPENSTREETMAP / PHYSICAL EQUIPMENT</div><h2 class="detail-heading">${escapeHTML(name)}</h2><p class="detail-sub">A community-mapped ${escapeHTML(type)}. Its present signalling state and controlling signal box cannot be inferred from an OSM marker.</p><div class="pills"><span class="pill blue">STATIC OSM RECORD</span><span class="pill warning">NOT LIVE DATA</span></div><div class="detail-section"><h3>MAP RECORD</h3><dl class="detail-dl"><dt>Category</dt><dd>${escapeHTML(type)}</dd><dt>Coordinates</dt><dd>${fmtCoords([lat,lon])}</dd>${details.map(([key,value])=>`<dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd>`).join('')}<dt>Signal aspect</dt><dd>Not available</dd><dt>Controller</dt><dd>Not verified</dd></dl>${makeLink(url,'View original OpenStreetMap object')}</div><div class="detail-section"><h3>DATA INTERPRETATION</h3><div class="note-card">The presence of a feature on OpenRailwayMap does not establish its operating state, controlling box, current identity or linkage to any train describer berth. Those relationships require separate verified references.</div></div>`;
  }
  function selectOSMFeature(item){if(state.drawActive)return;state.selected=null;state.selectedFeature=item;state.currentPanel='feature';populateList();drawBoxes();renderDetails();$('#inspector').classList.add('open');}
  function scheduleFetchOSM(){clearTimeout(state.osmTimeout);state.osmTimeout=setTimeout(fetchOSM,750);}
  async function fetchOSM(){
    if(!state.map||!state.activeLayers.osmFeatures)return;
    const zoom=state.map.getZoom();
    if(zoom<15){state.OSM=[];state.osmLayer.clearLayers();$('#count-features').textContent='Zoom in';updateLayerHints();return;}
    const b=state.map.getBounds();const centre=state.data.study.centre;
    // Overpass requests are deliberately limited to detailed map views near the study area.
    const sw=b.getSouthWest(), ne=b.getNorthEast();
    if(b.getNorth()-b.getSouth()>0.15 || b.getEast()-b.getWest()>0.20){$('#count-features').textContent='Zoom in';updateLayerHints();return;}
    const bbox=[sw.lat,sw.lng,ne.lat,ne.lng].map(v=>v.toFixed(3)).join(',');
    const cacheKey=bbox;
    if(state.lastOSMQuery===cacheKey||state.fetchInProgress)return;
    state.fetchInProgress=true;
    $('#count-features').textContent='Loading';
    updateLayerHints();
    const q=`[out:json][timeout:17];(node["railway"~"^(signal|switch)$"](${bbox}););out body;`;
    const mirrors=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
    let result=null;
    for(const endpoint of mirrors){
      const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),11500);
      try{
        const resp=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:q}),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctrl.signal});
        if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
        const parsed=await resp.json();if(!Array.isArray(parsed.elements))throw new Error('Invalid OSM response');
        result=parsed;clearTimeout(timer);break;
      }catch(err){clearTimeout(timer);console.warn('OSM endpoint temporarily unavailable:',err.message);}
    }
    state.fetchInProgress=false;
    if(!result){$('#count-features').textContent='Unavailable';layerHint('osmFeatures','OSM data unavailable · retry on map movement');return;}
    state.lastOSMQuery=cacheKey;state.OSM=result.elements.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.tags);
    state.osmLayer.clearLayers();
    for(const item of state.OSM){
      const signal=item.tags.railway==='signal';
      const pin=L.circleMarker([item.lat,item.lon],{radius:signal?4:3,color:signal?'#f5ce9e':'#baf7e0',fillColor:signal?'#ed9a5d':'#4bbc9b',fillOpacity:.9,weight:1.4});
      pin.on('click',()=>selectOSMFeature(item));pin.bindTooltip(item.tags.ref||item.tags.name||(signal?'Signal (OSM)':'Points (OSM)'),{className:'map-label'});pin.addTo(state.osmLayer);
    }
    $('#count-features').textContent=number(state.OSM.length);
    layerHint('osmFeatures',state.OSM.length?`${state.OSM.length} mapped signals and points`:'No mapped signals or points in this view');
  }
  async function fetchRegionalBoxes(){
    const {centre,radiusMetres}=state.data.study;
    const q=`[out:json][timeout:25];(node["railway"="signal_box"](around:${Math.round(radiusMetres)},${centre[0]},${centre[1]});way["railway"="signal_box"](around:${Math.round(radiusMetres)},${centre[0]},${centre[1]}););out center tags;`;
    const urls=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
    let elements=null;
    for(const url of urls){
      const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),17000);
      try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:q}),signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const js=await r.json();if(!Array.isArray(js.elements))throw new Error('Invalid response');elements=js.elements;clearTimeout(tm);break;}
      catch(err){console.warn('Regional signal box discovery unavailable:',err.message);clearTimeout(tm);}
    }
    if(!elements){$('#regional-box-list').innerHTML='<div class="loading-text">Regional OSM discovery unavailable. Railway tiles and the five reference boxes still work.</div>';return;}
    const core=state.data.boxes;
    const dist=(a,b)=>Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*66000);
    state.regionalBoxes=elements.map(e=>({type:e.type,id:e.id,tags:e.tags||{},lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon})).filter(e=>Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&!core.some(b=>dist(b.coordinates,[e.lat,e.lon])<230)).sort((a,b)=>String(a.tags.name||'').localeCompare(String(b.tags.name||'')));
    $('#regional-count').textContent=String(state.regionalBoxes.length);
    state.regionalBoxLayer.clearLayers();
    for(const item of state.regionalBoxes){
      const icon=L.divIcon({html:'<div class="signalbox-pin" style="height:21px;width:21px;background:#38304f;border-color:#c1a8ee"><span style="font-size:12px">⌘</span></div>',className:'',iconSize:[22,22],iconAnchor:[11,11]});
      const marker=L.marker([item.lat,item.lon],{icon}).addTo(state.regionalBoxLayer);
      marker.bindTooltip(item.tags.name||item.tags.ref||'OSM-mapped signal box',{className:'map-label'});
      marker.on('click',()=>selectOSMFeature(item));
    }
    $('#regional-box-list').innerHTML=state.regionalBoxes.length?state.regionalBoxes.map(item=>`<button class="box-item" data-regional="${escapeHTML(item.id)}"><span class="box-icon" style="color:#c3b3e8">◇</span><span class="box-item-name">${escapeHTML(item.tags.name||'Unnamed OSM signal box')}<span class="box-item-meta">OSM tagged · operation unverified</span></span><span class="box-arrow">›</span></button>`).join(''):'<div class="loading-text">No additional OSM signal boxes identified within this radius.</div>';
    $$('[data-regional]').forEach(el=>el.addEventListener('click',()=>{const item=state.regionalBoxes.find(e=>String(e.id)===el.dataset.regional);if(item){selectOSMFeature(item);state.map?.flyTo([item.lat,item.lon],15);$('#sidebar').classList.remove('open');}}));
  }
  function exportResearch(){
    const payload={name:'Stockport Rail Atlas research export',exportedAt:new Date().toISOString(),warning:'User-authored drafts are not verified operational signalling control boundaries.',records:state.research};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='stockport-signal-box-research.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Research drafts exported as JSON.');
  }
  function bindUI(){
    $('#layer-list input').forEach(el=>el.addEventListener('change',()=>{
      const layerName=el.dataset.layer;
      state.activeLayers[layerName]=el.checked;
      syncLayers();
      if(el.checked && (layerName==='signalTiles'||layerName==='osmFeatures') && state.map && state.map.getZoom()<15) {
        state.map.flyTo(state.data.study.centre,16,{duration:.65});
        toast('Zooming into Stockport to show detailed mapped signals and points.');
      }
    }));
    $('#focus-region').addEventListener('click',zoomRegion);
    $('#zoom-region').addEventListener('click',zoomRegion);
    $('#zoom-stockport').addEventListener('click',zoomCorridor);
    $('#empty-start').addEventListener('click',()=>selectBox('stockport-2'));
    $('#close-inspector').addEventListener('click',()=>{state.selected=null;state.selectedFeature=null;state.currentPanel='';if(state.drawActive)cancelDraw();populateList();drawBoxes();panelEmpty();$('#inspector').classList.remove('open');});
    $('#open-sidebar').addEventListener('click',()=>$('#sidebar').classList.add('open'));
    $('#close-sidebar').addEventListener('click',()=>$('#sidebar').classList.remove('open'));
    const modal=$('#modal-backdrop');
    $('#open-sources').addEventListener('click',()=>modal.classList.remove('hidden'));
    $('#close-modal').addEventListener('click',()=>modal.classList.add('hidden'));
    $('#modal-done').addEventListener('click',()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});
    $('#export-research').addEventListener('click',exportResearch);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.add('hidden');$('#sidebar').classList.remove('open');if(state.drawActive)cancelDraw();}});
    $$('[data-map-style]').forEach(el=>el.addEventListener('click',()=>{
      if(!state.map)return;
      const style=el.dataset.mapStyle;if(state.mapStyle===style)return;
      state.mapStyle=style;
      baseTiles?.getContainer()?.classList.toggle('atlas-basemap-dark',style==='dark');
      $$('[data-map-style]').forEach(x=>x.classList.toggle('mode-active',x.dataset.mapStyle===style));
    }));
  }
  function loadScriptWithTimeout(source, timeoutMs=6500) {
    return new Promise(resolve => {
      if (window.L) return resolve(true);
      const el=document.createElement('script');
      el.src=source;el.async=true;el.referrerPolicy='strict-origin-when-cross-origin';
      let finished=false;
      const finish=(ok) => {
        if (finished) return;
        finished=true;
        clearTimeout(timer);
        el.onload=null;el.onerror=null;
        if (!ok) el.remove();
        resolve(ok && !!window.L);
      };
      const timer=setTimeout(()=>finish(false),timeoutMs);
      el.onload=()=>finish(!!window.L);
      el.onerror=()=>finish(false);
      document.head.appendChild(el);
    });
  }
  async function ensureLeaflet() {
    if (window.L) return true;
    const sources=[
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
    ];
    for (const source of sources) {
      if (await loadScriptWithTimeout(source)) return true;
      console.warn('Map library source unavailable:',source);
    }
    return false;
  }
  async function start(){
    try {
      bindUI();
    } catch (error) {
      console.error('Controls initialisation problem:',error);
    }
    try {
      const response=await fetch('./data/stockport-boxes.json',{cache:'no-store'});
      if (!response.ok) throw new Error('Reference data request failed: '+response.status);
      state.data=await response.json();
      populateList();
      $('#count-verified').textContent=state.data.boxes.filter(b=>b.verifiedBoundary).length;
    } catch(error) {
      console.error('Reference data failed:',error);
      $('#box-list').innerHTML='<div class="loading-text">Reference records could not be loaded. Reload the page to try again.</div>';
      mapHealth('Unable to retrieve the local signal-box records.');
      $('#map').innerHTML='<div class="map-placeholder">Reference data unavailable.</div>';
      return;
    }
    $('#map').innerHTML='<div class="map-placeholder">Starting geographical map…</div>';
    const ready=await ensureLeaflet();
    if (!ready) {
      $('#map').innerHTML='<div class="map-placeholder">The mapping library is currently unavailable. Signal-box records are still accessible on the left.</div>';
      mapHealth('Mapping library could not load from either CDN. Please try reloading.');
      return;
    }
    try {
      initMap();
    } catch(error) {
      console.error('Map initialisation problem:',error);
      $('#map').innerHTML='<div class="map-placeholder">Map could not initialise. Signal-box records remain available in the sidebar.</div>';
      mapHealth('Map initialisation failed; please reload the page.');
    }
  }
  start();
})();
