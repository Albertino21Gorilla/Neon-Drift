// Balances and inventory are loaded from RPCs, never imported from offline saves.
const values = new Map();
window._1sGsdG = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)) };
const banner = document.createElement('div');
banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#101b30;color:#d9fffa;padding:8px;text-align:center;font:13px system-ui';
banner.setAttribute('role','status');
document.body.append(banner);
const say = text => banner.textContent=text;
say('Connecting to your account…');
let client, userId, run, pending, saving, busy=false;
function seed(p) {
 const map={best:p.best_score,energy:p.energy,points:p.points,'lifetime-points':p.lifetime_points,
 abilities:JSON.stringify(p.inventory.ability),skins:JSON.stringify(p.inventory.skin),trails:JSON.stringify(p.inventory.trail),
 equipped:p.equipped.ability,skin:p.equipped.skin,trail:p.equipped.trail,
 multiplier:[1,1.25,1.5,1.75,2,4,5][p.energy_tier],'score-multiplier':[1,1.25,1.5,1.75,2,4,5][p.score_tier],
 achievements:JSON.stringify(p.played?['played']:[])};
 for(const [k,v] of Object.entries(map)) values.set('neon-drift-'+k,String(v));
 window.ndApplyProfile?.(p);
}
async function rpc(name,args) {
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError || user?.id!==userId) throw new Error('Session changed. Return to your account and sign in.');
 const {data,error}=await client.rpc(name,args); if(error) throw error; return data;
}
async function flush() {
 if(saving) return saving;
 if(!pending) return;
 saving=(async()=>{
  const p=await rpc('nd_finish',pending); seed(p); pending=null; run=null;
  say('Saved to your account ✓');
 })();
 try { await saving; } finally { saving=null; }
}
window.ndCloud={
 async start(difficulty) {
  if(busy) return false; busy=true;
  try { await flush(); run=await rpc('nd_start',{p_difficulty:difficulty}); say('Online run · Rewards saved when the run ends'); return true; }
  catch(e){say(e.message);return false;}finally{busy=false;}
 },
 finish(score,energy,seconds) {
  pending={p_run:run,p_score:score,p_energy:energy,p_seconds:seconds};
  say('Saving your run…');
  return flush().catch(e=>{say('Not saved: '+e.message+' · Click here to retry before leaving.');});
 },
 async buy(kind,item) {
  if(busy)return;busy=true;
  try{await flush();seed(await rpc('nd_buy',{p_kind:kind,p_item:item}));say('Purchase / equipment saved ✓');}
  catch(e){say(e.message);}finally{busy=false;}
 }
};
banner.onclick=()=>{if(pending)flush().catch(e=>say('Still not saved: '+e.message));};
window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
try {
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
 client=createClient('https://pyxzktxzvoalyklpjgsm.supabase.co','sb_publishable_Ak3J64sxAfnH9fjwHE0wjg_k0e_4WaA',
 {auth:{flowType:'pkce',storageKey:'neon-drift-online-auth'}});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){location.replace('index.html');}else{
  userId=user.id;const p=await rpc('nd_my_profile');
  if(!p.inventory)throw new Error('Run cloud-v2.sql in Supabase first.');
  seed(p);
  const script=document.createElement('script');script.src='game.js?v=cloud-v2';
  script.onload=()=>say('Account loaded · Ready to fly');script.onerror=()=>say('Game failed to load. Refresh to retry.');
  document.body.append(script);
 }
}catch(e){say('Cannot load your account: '+e.message);}
