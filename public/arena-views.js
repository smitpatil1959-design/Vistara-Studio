(function(){
  var isTop=false;
  try{isTop=window.self===window.top;}catch(e){}
  if(!isTop)return;
  window.__ARENA_META={generationId:"kimi-k3",tournamentId:"46b826a0-11de-493b-9416-0de7d4f708fb"};
  var payload={tournamentId:"46b826a0-11de-493b-9416-0de7d4f708fb",modelId:"kimi-k3"};
  try{
    var r=document.referrer;
    if(r){var u=new URL(r);payload.referrerDomain=u.hostname;}
  }catch(e){}
  try{
    var vid=null;
    try{vid=localStorage.getItem('arena_vid');}catch(e){}
    if(!vid){
      vid=typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,32);
      try{localStorage.setItem('arena_vid',vid);}catch(e){}
    }
    if(vid)payload.viewerId=vid;
  }catch(e){}
  try{
    fetch("https://www.designarena.ai/api/agon/page-views",{"method":"POST","headers":{"Content-Type":"application/json"},"body":JSON.stringify(payload),"keepalive":true});
  }catch(e){}
})();
