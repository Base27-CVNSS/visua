(function(root){
  'use strict';
  /** Pure data helpers. Identical seed/config produces identical demo data. */
  function dataFactory(){
    const MAX_NODES=1250, MAX_EDGES=10000;
    const finite=(v,name,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${name}: cần số hữu hạn từ ${min} đến ${max}`);return v;};
    function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
    function generate(count=120,seed=104729,scenario='funds'){
      finite(count,'Số tác tử',1,MAX_NODES);if(!Number.isInteger(count))throw Error('Số tác tử phải nguyên');
      const random=rng(seed), nodes=Array.from({length:count},(_,i)=>({
        id:`A${String(i+1).padStart(4,'0')}`,label:`Tác tử ${i+1}`,group:i%6,stage:Math.floor(random()*6),
        value:Math.round(10+random()*990),score:Math.round(random()*100),
        x:+(8+random()*84).toFixed(3),y:+(8+random()*84).toFixed(3),
        start:Math.floor(random()*45),end:Math.floor(65+random()*36)
      }));
      const edges=[];
      for(let i=0;i<count*3;i++){
        const a=i<count?i:Math.floor(random()*count);
        let b=(a+1+Math.floor(random()*Math.max(1,count-1)))%count;
        if(count===1)break;
        const start=Math.floor(random()*92);
        edges.push({id:`E${String(i+1).padStart(5,'0')}`,source:nodes[a].id,target:nodes[b].id,
          value:Math.round(1+random()*199),time:start,end:Math.min(100,start+8+Math.floor(random()*20))});
      }
      return {version:1,source:'Dữ liệu mô phỏng tái lập',synthetic:true,scenario,seed,
        unit:'đơn vị giá trị',coordinateSystem:'schematic-2d',nodes,edges};
    }
    function validate(input){
      if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Dữ liệu phải là JSON object');
      if(!Array.isArray(input.nodes)||input.nodes.length<1||input.nodes.length>MAX_NODES)throw Error(`nodes: cần 1–${MAX_NODES} tác tử`);
      if(!Array.isArray(input.edges)||input.edges.length>MAX_EDGES)throw Error(`edges: tối đa ${MAX_EDGES} liên kết`);
      if(input.coordinateSystem&&input.coordinateSystem!=='schematic-2d')throw Error('Tọa độ đầu vào phải schematic-2d (x/y từ 0 đến 100); hãy chiếu dữ liệu GIS trước khi nhập.');
      const ids=new Set(),edgeIds=new Set();
      const nodes=input.nodes.map((n,i)=>{
        if(!n||typeof n.id!=='string'||!n.id.trim()||n.id.length>100||ids.has(n.id))throw Error(`nodes[${i}]: ID rỗng hoặc trùng`);
        ids.add(n.id);const group=n.group??0,stage=n.stage??0;
        finite(group,'group',0,5);finite(stage,'stage',0,5);
        if(!Number.isInteger(group)||!Number.isInteger(stage))throw Error('group/stage phải nguyên');
        const start=finite(n.start??0,'start',0,100),end=finite(n.end??100,'end',0,100);
        if(end<start)throw Error('end phải >= start');
        return {id:n.id,label:String(n.label??n.id).slice(0,160),group,stage,
          value:finite(n.value??1,'value',0,1e12),score:finite(n.score??0,'score',0,100),
          x:finite(n.x??50,'x',0,100),y:finite(n.y??50,'y',0,100),start,end};
      });
      const edges=input.edges.map((e,i)=>{
        if(!e||!ids.has(e.source)||!ids.has(e.target))throw Error(`edges[${i}]: đầu liên kết không tồn tại`);
        const id=String(e.id??`E${i+1}`);if(edgeIds.has(id))throw Error('ID liên kết trùng');edgeIds.add(id);
        const time=finite(e.time??0,'time',0,100),end=finite(e.end??100,'end',0,100);if(end<time)throw Error('end liên kết phải >= time');
        return {id,source:e.source,target:e.target,value:finite(e.value??1,'edge.value',0,1e12),time,end};
      });
      return {version:1,synthetic:input.synthetic===true,source:String(input.source??'Dữ liệu nhập').slice(0,160),
        scenario:String(input.scenario??'custom'),unit:String(input.unit??'đơn vị giá trị').slice(0,60),
        coordinateSystem:'schematic-2d',seed:input.seed??0,nodes,edges};
    }
    function stats(data,time=100){
      const visible=data.edges.filter(e=>e.time<=time),sums=new Map(data.nodes.map(n=>[n.id,{incoming:0,outgoing:0,degree:0}]));
      visible.forEach(e=>{const a=sums.get(e.source),b=sums.get(e.target);a.outgoing+=e.value;a.degree++;b.incoming+=e.value;b.degree++;});
      return {edgeCount:visible.length,total:visible.reduce((s,e)=>s+e.value,0),active:visible.filter(e=>time<=e.end).length,sums};
    }
    return {generate,validate,stats,rng,MAX_NODES,MAX_EDGES};
  }
  root.VISUA=Object.assign(root.VISUA||{},{dataFactory,data:dataFactory()});
  if(typeof module!=='undefined')module.exports=root.VISUA;
})(typeof window!=='undefined'?window:globalThis);
