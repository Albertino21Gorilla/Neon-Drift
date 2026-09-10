const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
async function scenario(){
 const profile={best_score:0,energy:0,points:0,lifetime_points:0,energy_tier:0,score_tier:0,played:false,
 inventory:{ability:['overdrive'],skin:['neon'],trail:['pulse']},equipped:{ability:'overdrive',skin:'neon',trail:'pulse'}};
 let calls=[],failSave=false,uid='pilot-a';
 const client={auth:{getUser:async()=>({data:{user:{id:uid}}})},rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='nd_start')return {data:'ticket-1'};
  if(name==='nd_finish'&&failSave)return {error:{message:'Network failure'}};
  return {data:profile};
 }};
 let banner;
 const context={Map,Number,String,Object,Error,Promise,console,
 mockImport:async()=>({createClient:()=>client}),location:{replace:()=>assert.fail('Unexpected redirect')},
 document:{createElement:()=>({style:{},children:[],setAttribute(){},append(...items){this.children.push(...items)},set textContent(value){this.text=value},get textContent(){return this.text??this.children.map(item=>item.textContent??'').join('')}}),body:{append(el){if(!banner)banner=el;}}},
 window:{addEventListener(){}}};
 const source=readFileSync(path.join(__dirname,'cloud-game.js'),'utf8').replace(/await import\('[^']+'\)/,'await mockImport()');
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 assert.equal(context.window._1sGsdG.getItem('neon-drift-points'),'0');
 let stopped=false;
 banner.children[1].onclick({stopPropagation(){stopped=true}});
 assert(stopped); assert.equal(banner.hidden,true);
 assert.equal(await context.window.ndCloud.start('hard'),true);
 assert.equal(banner.hidden,true,'Routine messages stay dismissed');
 failSave=true;
 await context.window.ndCloud.finish(123,2.25,10);
 assert.match(banner.textContent,/Not saved/);
 assert.equal(banner.hidden,false,'Save errors reappear');
 failSave=false;
 await context.window.ndCloud.start('normal');
 const finishes=calls.filter(c=>c.name==='nd_finish');
 assert.equal(finishes.length,2);
 assert.deepEqual(finishes[0].args,finishes[1].args);
 assert.equal(calls.at(-1).name,'nd_start');
 uid='different-account';
 const before=calls.length;
 await context.window.ndCloud.buy('skin','nova');
 assert.equal(calls.length,before,'Cross-account mutation blocked');
 assert.match(banner.textContent,/Session changed/);
 console.log('PASS: profile seed, run registration, failed save retained/retried before restart, account isolation');
}
scenario().catch(e=>{console.error(e);process.exitCode=1;});
