'use strict';
// Berth-level tracker. No GPS interpolation, signal aspects or automatic
// joining across TD areas. A headcode can legitimately recur.
function makeTDState({staleAfterMs=180000,historyLimit=25}={}) {
  const trains=new Map();
  const recent=[];
  const key=(area,description)=>String(area).toUpperCase()+'|'+String(description).toUpperCase();
  function apply(event) {
    if(!event || !['CA','CB','CC'].includes(event.msg_type))return false;
    const area=String(event.area_id||'').toUpperCase();
    const description=String(event.description||'').toUpperCase();
    const time=Date.parse(event.event_time);
    if(!area||!description||!Number.isFinite(time))return false;
    const id=key(area,description);
    const prior=trains.get(id);
    if(prior&&time<prior.time)return false; // late delivery must not rewind a train
    const berth=String(event.to_berth??event.berth??event.from_berth??'');
    const history=prior?.history?prior.history.slice():[];
    history.push({type:event.msg_type,from:event.from_berth??null,to:event.to_berth??null,time:event.event_time});
    if(history.length>historyLimit)history.splice(0,history.length-historyLimit);
    // Cancellation deletes berth association but keeps a short audit history.
    trains.set(id,{
      area_id:area,description,
      berth:event.msg_type==='CB'?null:berth||null,
      active:event.msg_type!=='CB',
      time,event_time:event.event_time,history
    });
    recent.push({area_id:area,description,msg_type:event.msg_type,event_time:event.event_time,from_berth:event.from_berth??null,to_berth:event.to_berth??null});
    if(recent.length>500)recent.shift();
    return true;
  }
  function snapshot(now=Date.now()){
    const active=[...trains.values()].filter(t=>t.active).map(t=>({
      area_id:t.area_id,description:t.description,berth:t.berth,
      event_time:t.event_time,stale:now-t.time>staleAfterMs,
      history:t.history.slice()
    }));
    return {generated_at:new Date(now).toISOString(),
      trains:active.sort((a,b)=>b.event_time.localeCompare(a.event_time)),
      events:recent.slice(-150).reverse()};
  }
  return {apply,snapshot};
}
module.exports={makeTDState};