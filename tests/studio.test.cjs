'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
for(const file of ['catalogue','data','engine','export'])require(path.join(root,'assets',file+'.js'));
const V=globalThis.VISUA;
function mockCanvas(width=850,height=460){
  const events=new Map(),commands=[];
  const methods=['setTransform','save','restore','clearRect','fillRect','translate','scale','beginPath','closePath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','stroke','fill','arc','fillText','setLineDash'];
  const ctx={};methods.forEach(name=>ctx[name]=(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${name}: nonfinite value`);if(name==='arc')assert.ok(args[2]>=0);if(name==='fillRect')assert.ok(args[2]>=0&&args[3]>=0);commands.push([name,...args]);});
  const canvas={width,height,getContext:()=>ctx,getBoundingClientRect:()=>({width,height,left:0,top:0}),addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setPointerCapture:()=>{}};
  return {canvas,events,commands};
}
test('catalogue: 300 unique presets, 30 renderers, 10 contexts, 50/category',()=>{
  assert.equal(V.models.length,300);assert.equal(new Set(V.models.map(m=>m.id)).size,300);assert.equal(new Set(V.models.map(m=>m.name)).size,300);
  assert.equal(V.families.length,30);assert.equal(V.scenarios.length,10);
  for(const group of V.groups)assert.equal(V.models.filter(m=>m.category===group.id).length,50);
  for(const scenario of V.scenarios)assert.equal(V.models.filter(m=>m.scenario===scenario.id).length,30);
});
test('reproducible data and edge endpoint invariants at 1/50/1250 agents',()=>{
  assert.deepEqual(V.data.generate(120,42),V.data.generate(120,42));assert.notDeepEqual(V.data.generate(120,42),V.data.generate(120,43));
  for(const size of [1,50,1250]){const d=V.data.generate(size,29),ids=new Set(d.nodes.map(n=>n.id));assert.equal(ids.size,size);assert.ok(d.edges.every(e=>ids.has(e.source)&&ids.has(e.target)&&e.source!==e.target));assert.deepEqual(V.data.validate(d).nodes,d.nodes);}
});
test('validation rejects duplicate IDs, dangling edges, invalid coordinates, time, NaN and oversize',()=>{
  const mutate=fn=>{const d=V.data.generate(10);fn(d);return d;};
  for(const d of [mutate(d=>d.nodes[1].id=d.nodes[0].id),mutate(d=>d.edges[0].target='missing'),mutate(d=>d.nodes[0].x=101),mutate(d=>d.nodes[0].group=1.5),mutate(d=>d.nodes[0].value=NaN),mutate(d=>d.edges[0].end=-1),mutate(d=>d.nodes[0].end=d.nodes[0].start-1),mutate(d=>d.coordinateSystem='EPSG:4326'),mutate(d=>d.nodes=Array(1251).fill(d.nodes[0]))])assert.throws(()=>V.data.validate(d));
  assert.throws(()=>V.data.validate(null));assert.throws(()=>V.data.generate(1251));assert.throws(()=>V.data.generate(4.1));
  const d=V.data.validate({nodes:[{id:'X'}],edges:[]});assert.equal(d.nodes[0].x,50);assert.equal(d.synthetic,false);assert.equal(d.nodes[0].end,100);
});
test('time filtering and aggregate values match source edges exactly',()=>{
  const d=V.data.validate({nodes:[{id:'A'},{id:'B'}],edges:[{id:'E1',source:'A',target:'B',value:7,time:20,end:40},{id:'E2',source:'B',target:'A',value:11,time:60,end:80}]});
  const a=V.data.stats(d,10),b=V.data.stats(d,30),c=V.data.stats(d,70);assert.equal(a.total,0);assert.equal(b.total,7);assert.equal(b.active,1);assert.equal(c.total,18);assert.equal(c.sums.get('A').incoming,11);assert.equal(c.sums.get('A').outgoing,7);assert.equal(c.sums.get('A').degree,2);
});
test('all 300 presets render at 0/20/60/100, reduced thumbnail and maximum count',()=>{
  for(const model of V.models){const d=V.data.generate(50,model.seed,model.scenario),{canvas,commands,events}=mockCanvas();const e=V.engine.create(canvas,model,d,{roles:V.scenarios.find(s=>s.id===model.scenario).roles});
    for(const t of [0,20,60,100])e.render(t);assert.ok(commands.some(c=>['fill','fillRect','stroke'].includes(c[0])),model.id);assert.ok(e.getState().hits>=0);e.zoomBy(100);assert.equal(e.getState().zoom,4);e.zoomBy(.001);assert.equal(e.getState().zoom,.5);e.resetView();e.setOptions({group:2});e.render(50);e.destroy();assert.equal(events.size,0);
    const thumb=V.engine.create(mockCanvas(280,160).canvas,model,d,{thumb:true});thumb.render(20);thumb.destroy();
  }
  const data=V.data.generate(1250);for(const family of V.families){const model=V.models.find(m=>m.family===family.id),e=V.engine.create(mockCanvas().canvas,model,data);e.render(60);e.select(data.nodes[0].id);e.destroy();}
});
test('node picking, zoom and drag preserve actual entity identity',()=>{
  const d=V.data.validate({nodes:[{id:'known',label:'Test',x:50,y:50,start:0,end:100}],edges:[]}),{canvas,events}=mockCanvas();let picked=null;
  const e=V.engine.create(canvas,{family:'agents'},d,{onSelect:p=>picked=p});
  // Defaults: x=58+(850-58-34)*.5, y=42+(460-42-46)*.5.
  const event={clientX:437,clientY:228,pointerId:1};events.get('pointerdown')(event);events.get('pointerup')(event);assert.equal(picked.id,'known');assert.equal(e.getState().selected,'known');
  e.zoomBy(2);e.resetView();events.get('pointerdown')(event);events.get('pointermove')({...event,clientX:470});events.get('pointerup')({...event,clientX:470});assert.equal(picked.id,'known');e.destroy();
});
test('standalone exports are self-contained and escape hostile input',()=>{
  const data=V.data.generate(10),payload='</script><img src=x onerror=alert(1)>&\u2028';data.nodes[0].label=payload;data.source=payload;
  const html=V.exporter.buildHTML(V.models[0],data,{time:50,roles:V.scenarios[0].roles,playing:false});
  assert.equal((html.match(/<script>/g)||[]).length,1);assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.ok(!html.includes('<img src=x'));assert.ok(!/cdn|<script[^>]*src=|<link[^>]*href=/i.test(html));
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(script));assert.ok(html.includes('\\u003c/script\\u003e'));
  const iframe=V.exporter.iframeCode(html);assert.ok(iframe.includes('sandbox="allow-scripts"'));assert.ok(iframe.includes('srcdoc="&lt;!doctype html&gt;'));
});
test('all DOM ID references and local assets exist',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8'),ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  assert.equal(ids.size,[...html.matchAll(/id="([^"]+)"/g)].length);
  for(const match of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),`Missing DOM id ${match[1]}`);
  for(const match of html.matchAll(/(?:src|href)="(assets\/[^"#?]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1])));
});
// Minimal DOM executes the generated widget without third-party dependencies.
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.textContent='';this.style={};this.attrs={};this.classList={toggle:()=>{}};}
  append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(){}getBoundingClientRect(){return {width:800,height:450,left:0,top:0};}
}
test('exported widget executes: controls, scrub, search and source values',()=>{
  const data=V.data.generate(50),html=V.exporter.buildHTML(V.models[0],data,{time:50,roles:V.scenarios[0].roles,playing:false,speed:1}),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));Object.assign(elements.get('viz'),mockCanvas(800,450).canvas);
  const document={hidden:false,getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),addEventListener:()=>{}};
  const sandbox={document,window:{addEventListener:()=>{},matchMedia:()=>({matches:false})},Intl,requestAnimationFrame:()=>{},console};vm.createContext(sandbox);vm.runInContext(script,sandbox);
  assert.ok(elements.get('source').textContent.includes('50 tác tử'));assert.equal(elements.get('time').textContent,'50.0%');
  elements.get('timeline').oninput({target:{value:'73'}});assert.equal(elements.get('time').textContent,'73.0%');elements.get('restart').onclick();assert.equal(elements.get('time').textContent,'0.0%');
  elements.get('search').value='A0001';elements.get('search').onchange();assert.ok(elements.get('detail').textContent.includes('A0001'));
  elements.get('zoomIn').onclick();elements.get('zoomOut').onclick();elements.get('reset').onclick();elements.get('legend').children[0].onclick();elements.get('unpin').onclick();assert.ok(elements.get('detail').textContent.includes('ghim'));
});
