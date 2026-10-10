(function(root){
  'use strict';
  /** Self-contained canvas renderer; serialized verbatim into standalone exports. */
  function engineFactory(){
    const COLORS=['#2563eb','#e17b12','#0e9382','#9b51d1','#d6476a','#52647d'];
    const INK='#19283f',MUTED='#718096',GRID='#edf1f6',TAU=Math.PI*2;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const format=v=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1,notation:v>=1e6?'compact':'standard'}).format(v);
    const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(h,31)+s.charCodeAt(i))>>>0;return h;};
    function create(canvas,model,data,options={}){
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Trình duyệt không hỗ trợ Canvas 2D');
      let width=800,height=480,time=50,zoom=1,pan={x:0,y:0},hits=[],destroyed=false,selected=null;
      let config={labels:true,particles:true,group:-1,thumb:false,roles:['Nhóm 1','Nhóm 2','Nhóm 3','Nhóm 4','Nhóm 5','Nhóm 6'],...options};
      const byId=new Map(data.nodes.map(n=>[n.id,n]));
      const totals=data.nodes.reduce((a,n)=>(a[n.group]+=n.value,a),Array(6).fill(0));
      const maxValue=Math.max(1,...data.nodes.map(n=>n.value));
      let positions=new Map(),drag=null,moved=false,cacheKey=null,summary;
      const on=(name,fn)=>canvas.addEventListener(name,fn);
      function resize(){
        const box=canvas.getBoundingClientRect();width=Math.max(160,box.width||800);height=Math.max(100,box.height||480);
        const dpr=Math.min(2,typeof devicePixelRatio==='number'?devicePixelRatio:1);
        canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);render(time);
      }
      function text(str,x,y,size=11,color=MUTED,align='left'){
        ctx.fillStyle=color;ctx.font=`${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(String(str),x,y);
      }
      function line(x1,y1,x2,y2,color=GRID,w=1){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
      function circle(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.globalAlpha=1;}
      function rect(x,y,w,h,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;}
      function pointHit(x,y,r,payload){if(!config.thumb)hits.push({x,y,r,payload});}
      function boxHit(x,y,w,h,payload){if(!config.thumb)hits.push({x,y,w,h,payload});}
      function polygon(points,color,alpha=1){if(!points.length)return;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
      const margins=()=>({l:config.thumb?18:58,r:config.thumb?18:34,t:config.thumb?25:42,b:config.thumb?26:46});
      function axes(xLabel='Tiến độ · %',yLabel='Giá trị'){
        const m=margins();line(m.l,height-m.b,width-m.r,height-m.b,'#dbe3ed');line(m.l,m.t,m.l,height-m.b,'#dbe3ed');
        if(!config.thumb){text(xLabel,width-m.r,height-12,10,MUTED,'right');text(yLabel,m.l,22,10);}
        for(let i=1;i<5;i++)line(m.l,m.t+(height-m.b-m.t)*i/5,width-m.r,m.t+(height-m.b-m.t)*i/5);
        return m;
      }
      function aggregate(){
        const key=Math.floor(time*2)+':'+config.group;
        if(key===cacheKey)return summary;cacheKey=key;
        const edges=data.edges.filter(e=>e.time<=time&&(config.group<0||byId.get(e.source).group===config.group||byId.get(e.target).group===config.group));
        const matrix=Array.from({length:6},()=>Array(6).fill(0));
        const bins=Array.from({length:6},()=>Array(20).fill(0)),countBins=Array(100).fill(0);
        const sums=new Map(data.nodes.map(n=>[n.id,{incoming:0,outgoing:0,degree:0}]));
        edges.forEach(e=>{const a=byId.get(e.source),b=byId.get(e.target);matrix[a.group][b.group]+=e.value;
          bins[a.group][Math.min(19,Math.floor(e.time/5))]+=e.value;countBins[Math.min(99,Math.floor(e.time))]++;
          sums.get(e.source).outgoing+=e.value;sums.get(e.source).degree++;sums.get(e.target).incoming+=e.value;sums.get(e.target).degree++;});
        summary={edges,matrix,bins,countBins,sums};return summary;
      }
      function nodesShown(){const nodes=data.nodes.filter(n=>config.group<0||n.group===config.group);return config.thumb?nodes.slice(0,60):nodes;}
      function coords(n,moving=false){
        let x=n.x,y=n.y;
        if(moving&&data.synthetic){const p=time/100,seed=hash(n.id)%31;x=clamp(x+Math.sin(p*TAU+seed)*9,3,97);y=clamp(y+Math.cos(p*TAU*1.4+seed)*7,3,97);}
        const m=margins();return [m.l+x/100*(width-m.l-m.r),m.t+y/100*(height-m.t-m.b)];
      }
      function rolePayload(g,value,label='Tổng giá trị'){return {kind:'group',group:g,label:config.roles[g],value,metric:label,unit:data.unit};}
      function node(n,x,y,r=4){
        const active=time>=n.start&&time<=n.end,highlight=selected===n.id;
        circle(x,y,r+(highlight?2:0),COLORS[n.group],active?1:.34);
        if(highlight){ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r+6,0,TAU);ctx.stroke();}
        pointHit(x,y,Math.max(7,r),{kind:'node',...n,...aggregate().sums.get(n.id)});
      }
      function curves(a,b,color,amount,edge,bend=0){
        const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2+bend;
        const related=!selected||edge.source===selected||edge.target===selected;
        ctx.globalAlpha=related?.23:.035;ctx.strokeStyle=color;ctx.lineWidth=clamp(Math.sqrt(amount)/8,0.6,4);
        ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(cx,cy,...b);ctx.stroke();ctx.globalAlpha=1;
        if(edge.time<=time&&time<=edge.end&&config.particles&&related){
          const p=((time-edge.time)/(Math.max(1,edge.end-edge.time))*4+(hash(edge.id)%13)/13)%1;
          const x=(1-p)**2*a[0]+2*(1-p)*p*cx+p*p*b[0],y=(1-p)**2*a[1]+2*(1-p)*p*cy+p*p*b[1];
          circle(x,y,config.thumb?1.8:3,color);pointHit(x,y,5,{kind:'edge',...edge});
          // Direction arrow at the destination, independent of particle phase.
          const angle=Math.atan2(b[1]-cy,b[0]-cx);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...b);
          ctx.lineTo(b[0]-6*Math.cos(angle-.5),b[1]-6*Math.sin(angle-.5));ctx.lineTo(b[0]-6*Math.cos(angle+.5),b[1]-6*Math.sin(angle+.5));ctx.closePath();ctx.fill();
        }
      }
      function layoutGraph(family){
        positions.clear();const nodes=nodesShown(),m=margins(),w=width-m.l-m.r,h=height-m.t-m.b,cx=width/2,cy=height/2;
        const groupCounts=Array(6).fill(0),stageCounts=Array(6).fill(0);
        nodes.forEach(n=>{groupCounts[n.group]++;stageCounts[n.stage]++;});
        const gidx=Array(6).fill(0),sidx=Array(6).fill(0);
        nodes.forEach((n,i)=>{
          const gi=gidx[n.group]++,si=sidx[n.stage]++,ga=n.group/6*TAU-TAU/4;
          let x,y;
          if(family==='chain'){x=m.l+n.stage/5*w;y=m.t+(si+.5)/stageCounts[n.stage]*h;}
          else if(family==='radial'||family==='chord'){const a=i/nodes.length*TAU-TAU/4,r=Math.min(w,h)*.46*(family==='radial'?(0.35+n.stage*.13):1);x=cx+Math.cos(a)*r;y=cy+Math.sin(a)*r;}
          else if(family==='hive'){const r=22+(gi+.5)/groupCounts[n.group]*Math.min(w,h)*.42;x=cx+Math.cos(ga)*r;y=cy+Math.sin(ga)*r;}
          else if(family==='arc'){x=m.l+i/Math.max(1,nodes.length-1)*w;y=height*.77;}
          else if(family==='bundle'){x=m.l+(n.group<3?.1:.9)*w;y=m.t+(n.group%3+(gi+.5)/groupCounts[n.group])/3*h;}
          else if(family==='tree'){x=m.l+(n.stage+1)/7*w;y=m.t+(n.group+(gi+.5)/groupCounts[n.group])/6*h;}
          else {const radius=10+Math.sqrt((gi+.5)/groupCounts[n.group])*Math.min(w,h)*.19,a=gi*2.39996323+(model.variant||0)*.2;
            x=cx+Math.cos(ga)*w*.28+Math.cos(a)*radius;y=cy+Math.sin(ga)*h*.28+Math.sin(a)*radius;}
          positions.set(n.id,[x,y]);
        });
        if(family==='hive')for(let g=0;g<6;g++)line(cx,cy,cx+Math.cos(g/6*TAU-TAU/4)*Math.min(w,h)*.47,cy+Math.sin(g/6*TAU-TAU/4)*Math.min(w,h)*.47,'#dbe3ed');
        if(family==='tree'){
          const root=[m.l+8,height/2];circle(...root,5,INK);
          for(let g=0;g<6;g++){
            const gx=m.l+w*.2,gy=m.t+(g+.5)/6*h;
            if(!groupCounts[g])continue;
            line(...root,gx,gy,COLORS[g],1.2);circle(gx,gy,4,COLORS[g]);pointHit(gx,gy,8,rolePayload(g,totals[g]));
            if(!config.thumb)text(`G${g+1}`,gx+6,gy-8,10,INK);
            nodes.filter(n=>n.group===g).forEach((n,i)=>{
              const x=m.l+w*.55+n.stage/5*w*.4,y=m.t+(g+(i+.5)/groupCounts[g])/6*h;positions.set(n.id,[x,y]);
              line(gx,gy,x,y,COLORS[g],.5);node(n,x,y,config.thumb?2:3);
            });
          }
          return;
        }
        const edges=aggregate().edges.filter(e=>positions.has(e.source)&&positions.has(e.target));
        const limit=config.thumb?100:1800;
        let shown=0;
        for(const e of edges){if(selected&&e.source!==selected&&e.target!==selected)continue;if(shown++>=limit)break;
          const a=positions.get(e.source),b=positions.get(e.target),bend=family==='arc'?-Math.abs(b[0]-a[0])*.4:family==='chord'?(height/2-(a[1]+b[1])/2)*1.1:family==='bundle'?(height/2-(a[1]+b[1])/2)*.7:0;
          curves(a,b,COLORS[byId.get(e.source).group],e.value,e,bend);
        }
        nodes.forEach((n,i)=>{const p=positions.get(n.id);node(n,...p,config.thumb?2.6:3+Math.sqrt(n.value/maxValue)*3);
          if(!config.thumb&&config.labels&&(i<14||selected===n.id))text(n.id,p[0]+7,p[1]-6,10,INK);});
        if(!config.thumb){text(`${nodes.length} tác tử · vẽ ${Math.min(shown,limit)}/${selected?edges.filter(e=>e.source===selected||e.target===selected).length:edges.length} liên kết`,m.l,height-14,10);}
      }
      function chord(){
        const m=margins(),cx=width/2,cy=height/2,r=Math.min(width-m.l-m.r,height-m.t-m.b)*.42;
        const {matrix}=aggregate(),max=Math.max(1,...matrix.flat()),anchors=[];
        for(let g=0;g<6;g++){
          const a=g/6*TAU-TAU/4;anchors[g]=[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
          ctx.strokeStyle=COLORS[g];ctx.lineWidth=9;ctx.beginPath();ctx.arc(cx,cy,r,a-.37,a+.37);ctx.stroke();
          pointHit(...anchors[g],13,rolePayload(g,matrix[g].reduce((s,v)=>s+v,0),'Tổng đi ra'));
          if(!config.thumb)text(`G${g+1}`,cx+Math.cos(a)*(r+20),cy+Math.sin(a)*(r+20)+4,10,INK,'center');
        }
        for(let i=0;i<6;i++)for(let j=0;j<6;j++){
          const value=matrix[i][j];if(!value)continue;
          const a=anchors[i],b=anchors[j],c=i===j?[cx+(a[0]-cx)*.45,cy+(a[1]-cy)*.45]:[cx,cy];
          ctx.strokeStyle=COLORS[i];ctx.globalAlpha=.24;ctx.lineWidth=1+value/max*13;ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(...c,...b);ctx.stroke();ctx.globalAlpha=1;
          if(config.particles){const p=(time/22+i*.17+j*.11)%1,x=(1-p)**2*a[0]+2*(1-p)*p*c[0]+p*p*b[0],y=(1-p)**2*a[1]+2*(1-p)*p*c[1]+p*p*b[1];circle(x,y,2.5,COLORS[i]);pointHit(x,y,6,{kind:'relation',label:`${config.roles[i]} → ${config.roles[j]}`,value,unit:data.unit});}
        }
        if(!config.thumb)text(`Độ dày: 0 – ${format(max)} ${data.unit}`,m.l,height-14,10);
      }
      function matrix(){
        const m=margins(),size=Math.min(width-m.l-m.r,height-m.t-m.b),cell=size/6,x=(width-size)/2,y=m.t;
        const {matrix}=aggregate(),max=Math.max(1,...matrix.flat());
        for(let i=0;i<6;i++)for(let j=0;j<6;j++){
          rect(x+j*cell,y+i*cell,cell-3,cell-3,COLORS[i],.08+.92*matrix[i][j]/max);
          if(!config.thumb)text(format(matrix[i][j]),x+(j+.5)*cell,y+(i+.55)*cell,11,matrix[i][j]/max>.6?'white':INK,'center');
          boxHit(x+j*cell,y+i*cell,cell,cell,{kind:'relation',label:`${config.roles[i]} → ${config.roles[j]}`,value:matrix[i][j],unit:data.unit});
        }
        if(!config.thumb){for(let g=0;g<6;g++){text(`G${g+1}`,x-12,y+(g+.55)*cell,10,MUTED,'right');text(`G${g+1}`,x+(g+.5)*cell,y-10,10,MUTED,'center');}text(`Cường độ 0 – ${format(max)} ${data.unit}`,x,height-14,10);}
      }
      function sankey(){
        const m=margins(),{matrix}=aggregate(),w=width-m.l-m.r,h=height-m.t-m.b,x1=m.l+16,x2=width-m.r-16;
        const rows=matrix.map(r=>r.reduce((a,b)=>a+b,0)),cols=matrix[0].map((_,j)=>matrix.reduce((s,r)=>s+r[j],0)),total=rows.reduce((a,b)=>a+b,0)||1;
        const usable=h-30,ys=[],yt=[];let a=m.t,b=m.t;
        for(let g=0;g<6;g++){ys[g]=a;yt[g]=b;rect(x1-10,a,10,rows[g]/total*usable,COLORS[g]);rect(x2,b,10,cols[g]/total*usable,COLORS[g]);
          boxHit(x1-10,a,15,Math.max(6,rows[g]/total*usable),rolePayload(g,rows[g],'Tổng đi ra'));if(!config.thumb)text(config.roles[g],x1+5,a+10,10,INK);a+=rows[g]/total*usable+6;b+=cols[g]/total*usable+6;}
        const so=[...ys],to=[...yt];for(let i=0;i<6;i++)for(let j=0;j<6;j++){
          const v=matrix[i][j],hh=v/total*usable;if(hh===0)continue;
          ctx.globalAlpha=.32;ctx.fillStyle=COLORS[i];ctx.beginPath();ctx.moveTo(x1,so[i]);ctx.bezierCurveTo(width*.44,so[i],width*.56,to[j],x2,to[j]);ctx.lineTo(x2,to[j]+hh);ctx.bezierCurveTo(width*.56,to[j]+hh,width*.44,so[i]+hh,x1,so[i]+hh);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
          if(config.particles){const p=(time/30+i*.14+j*.05)%1;circle(x1+(x2-x1)*p,(1-p)*(so[i]+hh/2)+p*(to[j]+hh/2),2,COLORS[i]);}
          so[i]+=hh;to[j]+=hh;
        }
      }
      function spatial(family){
        const m=margins(),nodes=nodesShown(),moving=family!=='od'&&family!=='hexbin';positions.clear();
        for(let x=0;x<=4;x++)line(m.l+(width-m.l-m.r)*x/4,m.t,m.l+(width-m.l-m.r)*x/4,height-m.b);
        for(let y=0;y<=4;y++)line(m.l,m.t+(height-m.t-m.b)*y/4,width-m.r,m.t+(height-m.t-m.b)*y/4);
        nodes.forEach(n=>positions.set(n.id,coords(n,moving)));
        if(family==='voronoi'){
          const centers=Array.from({length:6},(_,g)=>{const members=nodes.filter(n=>n.group===g);return members.length?[members.reduce((s,n)=>s+positions.get(n.id)[0],0)/members.length,members.reduce((s,n)=>s+positions.get(n.id)[1],0)/members.length]:[width/2+Math.cos(g)*60,height/2+Math.sin(g)*60];});
          for(let g=0;g<6;g++){
            let poly=[[m.l,m.t],[width-m.r,m.t],[width-m.r,height-m.b],[m.l,height-m.b]];
            for(let j=0;j<6;j++){if(g===j)continue;const a=centers[g],b=centers[j],nx=b[0]-a[0],ny=b[1]-a[1],c=(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2;
              const next=[];for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],dp=nx*p[0]+ny*p[1]-c,dq=nx*q[0]+ny*q[1]-c;if(dp<=0)next.push(p);if((dp<=0)!==(dq<=0)){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}poly=next;
            }polygon(poly,COLORS[g],.11);circle(...centers[g],5,COLORS[g]);
          }
        }
        if(family==='hexbin'){
          const radius=config.thumb?12:22,bins=new Map();nodes.filter(n=>time>=n.start&&time<=n.end).forEach(n=>{const p=coords(n),row=Math.round((p[1]-m.t)/(radius*1.5)),col=Math.round((p[0]-m.l)/(radius*Math.sqrt(3))-(row%2)/2),key=`${row},${col}`;
            if(!bins.has(key))bins.set(key,{row,col,count:0});bins.get(key).count++;});
          const max=Math.max(1,...Array.from(bins.values(),b=>b.count));bins.forEach(b=>{const x=m.l+(b.col+(b.row%2)/2)*radius*Math.sqrt(3),y=m.t+b.row*radius*1.5;
            polygon(Array.from({length:6},(_,i)=>[x+Math.cos(i*TAU/6-TAU/4)*(radius-1),y+Math.sin(i*TAU/6-TAU/4)*(radius-1)]),COLORS[0],.12+.85*b.count/max);
            pointHit(x,y,radius,{kind:'bin',label:`Ô ${b.row}, ${b.col}`,value:b.count,unit:'tác tử'});});
          if(!config.thumb)text(`Mật độ: 1 – ${max} tác tử / ô · lưới phẳng`,m.l,height-14,10);return;
        }
        if(family==='geofence'){
          const center=[width*.5,height*.5],r=Math.min(width-m.l-m.r,height-m.t-m.b)*.3;
          circle(...center,r,COLORS[2],.08);ctx.setLineDash([5,4]);ctx.strokeStyle=COLORS[2];ctx.beginPath();ctx.arc(...center,r,0,TAU);ctx.stroke();ctx.setLineDash([]);
          const inside=nodes.filter(n=>{const p=positions.get(n.id);return Math.hypot(p[0]-center[0],p[1]-center[1])<=r;}).length;
          if(!config.thumb)text(`${inside} / ${nodes.length} tác tử trong vùng`,m.l,height-14,10);
        }
        if(family==='od')aggregate().edges.filter(e=>positions.has(e.source)&&positions.has(e.target)).slice(0,config.thumb?80:1000).forEach(e=>curves(positions.get(e.source),positions.get(e.target),COLORS[byId.get(e.source).group],e.value,e,-20));
        nodes.forEach((n,i)=>{const p=positions.get(n.id);
          if(family==='trajectory'&&data.synthetic){const prev=coords(n,false);curves(prev,p,COLORS[n.group],40,{id:n.id,source:n.id,target:n.id,time:0,end:100},-15);circle(...prev,2,COLORS[n.group],.3);}
          node(n,...p,config.thumb?2:4);if(!config.thumb&&config.labels&&(i<10||selected===n.id))text(n.id,p[0]+6,p[1]-6,10,INK);});
      }
      function temporal(family){
        const m=axes('Tiến độ · %',family==='calendar'?'Số sự kiện':data.unit),w=width-m.l-m.r,h=height-m.t-m.b;
        const {bins,edges,countBins}=aggregate();
        if(family==='calendar'){
          const cw=w/10,ch=h/10,max=Math.max(1,...countBins);for(let i=0;i<100;i++){const x=m.l+i%10*cw,y=m.t+Math.floor(i/10)*ch;
            rect(x,y,cw-3,ch-3,COLORS[0],i>time?.03:.08+.92*countBins[i]/max);boxHit(x,y,cw,ch,{kind:'bin',label:`Tiến độ ${i}–${i+1}%`,value:countBins[i],unit:'sự kiện'});if(!config.thumb&&cw>35)text(i,x+5,y+14,9,countBins[i]/max>.65?'white':MUTED);}
          if(!config.thumb)text(`Cường độ 0 – ${max} sự kiện / ô`,m.l,22,10);return;
        }
        if(family==='gantt'){
          const nodes=nodesShown().slice(0,config.thumb?18:30),rh=h/nodes.length;
          nodes.forEach((n,i)=>{const x=m.l+n.start/100*w,y=m.t+i*rh;rect(x,y,w*(n.end-n.start)/100,Math.max(2,rh-5),COLORS[n.group],time>=n.start&&time<=n.end?.85:.2);
            boxHit(x,y,w*(n.end-n.start)/100,rh,{kind:'node',...n,...aggregate().sums.get(n.id)});if(!config.thumb)text(n.id,m.l-6,y+rh*.65,9,MUTED,'right');});
        }else if(family==='event'){
          edges.slice(0,config.thumb?100:350).forEach(e=>{const n=byId.get(e.source),x=m.l+e.time/100*w,y=m.t+(n.group+.5)/6*h;
            circle(x,y,2+Math.sqrt(e.value)/5,COLORS[n.group],.6);pointHit(x,y,6,{kind:'edge',...e});});
          if(!config.thumb)for(let g=0;g<6;g++)text(`G${g+1}`,m.l-8,m.t+(g+.5)/6*h,10,MUTED,'right');
        }else {
          const max=Math.max(1,...Array.from({length:20},(_,i)=>bins.reduce((s,row)=>s+row[i],0))),stack=Array(20).fill(0);
          for(let g=0;g<6;g++){
            const ys=bins[g].map((v,i)=>height-m.b-(v+(family==='stream'?stack[i]:0))/max*h),xs=bins[g].map((_,i)=>m.l+(i+.5)/20*w);
            if(family==='stream'){const pts=xs.map((x,i)=>[x,ys[i]]).concat([...xs].reverse().map((x,j)=>[x,height-m.b-stack[19-j]/max*h]));polygon(pts,COLORS[g],.55);}
            ctx.strokeStyle=COLORS[g];ctx.lineWidth=1.8;ctx.beginPath();xs.forEach((x,i)=>i?ctx.lineTo(x,ys[i]):ctx.moveTo(x,ys[i]));ctx.stroke();
            xs.forEach((x,i)=>{pointHit(x,ys[i],6,{kind:'bin',label:`${config.roles[g]} · ${i*5}–${(i+1)*5}%`,value:bins[g][i],unit:data.unit});stack[i]+=bins[g][i];});
          }if(!config.thumb)text(format(max),m.l-6,m.t+4,10,MUTED,'right');
        }
        const x=m.l+time/100*w;line(x,m.t,x,height-m.b,INK,1.4);circle(x,m.t,3,INK);
      }
      function waterfall(){
        const m=axes('Nhóm · G1–G6',data.unit),{matrix}=aggregate(),net=matrix.map((r,i)=>matrix.reduce((s,row)=>s+row[i],0)-r.reduce((s,v)=>s+v,0));
        let cumulative=0;const levels=[0];net.forEach(v=>levels.push(levels.at(-1)+v));const lo=Math.min(...levels,0),hi=Math.max(...levels,1),span=Math.max(1,hi-lo),y=v=>m.t+(hi-v)/span*(height-m.t-m.b),cw=(width-m.l-m.r)/6;
        net.forEach((v,g)=>{const x=m.l+cw*g+cw*.15;const start=cumulative;cumulative+=v;rect(x,Math.min(y(start),y(cumulative)),cw*.7,Math.max(2,Math.abs(y(start)-y(cumulative))),COLORS[g],.8);line(x+cw*.7,y(cumulative),x+cw,y(cumulative),'#becadb');boxHit(x,Math.min(y(start),y(cumulative)),cw*.7,Math.max(10,Math.abs(y(start)-y(cumulative))),rolePayload(g,v,'Vào trừ ra'));if(!config.thumb)text(`G${g+1}`,x+cw*.35,height-m.b+16,10,MUTED,'center');});
      }
      function compare(family){
        const m=margins(),w=width-m.l-m.r,h=height-m.t-m.b,nodes=nodesShown(),{sums}=aggregate();
        if(family==='radar'){
          const cx=width/2,cy=height/2,r=Math.min(w,h)*.43;
          const metrics=Array.from({length:6},(_,g)=>{const ns=data.nodes.filter(n=>n.group===g);return [ns.length,totals[g],ns.reduce((s,n)=>s+sums.get(n.id).degree,0),ns.reduce((s,n)=>s+n.score,0)/Math.max(1,ns.length),ns.reduce((s,n)=>s+sums.get(n.id).incoming,0),ns.reduce((s,n)=>s+sums.get(n.id).outgoing,0)];});
          const max=metrics[0].map((_,i)=>Math.max(1,...metrics.map(r=>r[i])));
          for(let ring=1;ring<=4;ring++){const pts=Array.from({length:6},(_,i)=>[cx+Math.cos(i/6*TAU-TAU/4)*r*ring/4,cy+Math.sin(i/6*TAU-TAU/4)*r*ring/4]);ctx.strokeStyle=GRID;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke();}
          ['Tác tử','Giá trị','Bậc','Chỉ số','Vào','Ra'].forEach((s,i)=>{const a=i/6*TAU-TAU/4;line(cx,cy,cx+Math.cos(a)*r,cy+Math.sin(a)*r);if(!config.thumb)text(s,cx+Math.cos(a)*(r+15),cy+Math.sin(a)*(r+15),10,MUTED,'center');});
          metrics.forEach((vs,g)=>{if(config.group>=0&&g!==config.group)return;const pts=vs.map((v,i)=>[cx+Math.cos(i/6*TAU-TAU/4)*r*v/max[i],cy+Math.sin(i/6*TAU-TAU/4)*r*v/max[i]]);polygon(pts,COLORS[g],.09);ctx.strokeStyle=COLORS[g];ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke();pts.forEach((p,i)=>pointHit(...p,5,rolePayload(g,vs[i],['Số tác tử','Giá trị','Tổng bậc','Chỉ số trung bình','Tổng vào','Tổng ra'][i])));});return;
        }
        axes(family==='parallel'?'Các thuộc tính chuẩn hóa':family==='rank'?data.unit:'Nhóm · G1–G6',family==='rank'?'Tác tử':data.unit);
        if(family==='rank'){
          const ranked=nodes.map(n=>({...n,total:sums.get(n.id).incoming+sums.get(n.id).outgoing})).sort((a,b)=>b.total-a.total).slice(0,config.thumb?8:14),max=Math.max(1,...ranked.map(n=>n.total)),rh=h/ranked.length;
          ranked.forEach((n,i)=>{const x=m.l,y=m.t+i*rh,bw=n.total/max*w;rect(x,y,bw,rh*.64,COLORS[n.group],.75);boxHit(x,y,Math.max(8,bw),rh,{kind:'node',...n,...sums.get(n.id)});if(!config.thumb){text(n.id,x-8,y+rh*.48,10,MUTED,'right');text(format(n.total),x+bw+4,y+rh*.48,10,INK);}});return;
        }
        if(family==='ridgeline'){
          const hist=Array.from({length:6},()=>Array(20).fill(0));nodes.filter(n=>time>=n.start&&time<=n.end).forEach(n=>hist[n.group][Math.min(19,Math.floor(n.value/maxValue*20))]++);const max=Math.max(1,...hist.flat());
          hist.forEach((vs,g)=>{const y=m.t+(g+1)/6*h,pts=[[m.l,y],...vs.map((v,i)=>[m.l+(i+.5)/20*w,y-v/max*h/6*.9]),[width-m.r,y]];polygon(pts,COLORS[g],.45);for(let i=0;i<20;i++)pointHit(m.l+(i+.5)/20*w,y-vs[i]/max*h/6*.9,6,{kind:'bin',label:`G${g+1} · ${format(i/20*maxValue)}–${format((i+1)/20*maxValue)}`,value:vs[i],unit:'tác tử'});if(!config.thumb)text(`G${g+1}`,m.l-8,y,10,MUTED,'right');});return;
        }
        if(family==='parallel'){
          const labels=['Giá trị','Chỉ số','Tầng','Bậc','Vào','Ra'],maxDegree=Math.max(1,...Array.from(sums.values(),s=>s.degree)),maxIn=Math.max(1,...Array.from(sums.values(),s=>s.incoming)),maxOut=Math.max(1,...Array.from(sums.values(),s=>s.outgoing));
          labels.forEach((l,i)=>{const x=m.l+i/5*w;line(x,m.t,x,height-m.b,'#dbe3ed');if(!config.thumb)text(l,x,height-m.b+20,10,MUTED,'center');});
          nodes.forEach(n=>{const s=sums.get(n.id),vs=[n.value/maxValue,n.score/100,n.stage/5,s.degree/maxDegree,s.incoming/maxIn,s.outgoing/maxOut];ctx.strokeStyle=COLORS[n.group];ctx.globalAlpha=selected&&selected===n.id?1:.13;ctx.beginPath();vs.forEach((v,i)=>{const p=[m.l+i/5*w,height-m.b-v*h];i?ctx.lineTo(...p):ctx.moveTo(...p);if(i===1)pointHit(...p,4,{kind:'node',...n,...s});});ctx.stroke();ctx.globalAlpha=1;});return;
        }
        nodes.forEach(n=>{const x=m.l+(n.group+.5)/6*w+(hash(n.id)%101/100-.5)*w/8,y=height-m.b-n.value/maxValue*h;node(n,x,y,config.thumb?2:4);});
      }
      function hierarchy(family){
        const m=margins(),w=width-m.l-m.r,h=height-m.t-m.b,nodes=nodesShown();
        if(family==='treemap'){
          const total=totals.reduce((s,v)=>s+v,0)||1;let x=m.l;
          for(let g=0;g<6;g++){const gw=totals[g]/total*w,members=nodes.filter(n=>n.group===g);let y=m.t;
            members.forEach(n=>{const nh=n.value/Math.max(1,totals[g])*h;rect(x+2,y+2,Math.max(0,gw-4),Math.max(0,nh-2),COLORS[g],.35+.6*(time>=n.start&&time<=n.end));boxHit(x,y,gw,nh,{kind:'node',...n,...aggregate().sums.get(n.id)});y+=nh;});
            if(!config.thumb&&gw>45)text(`G${g+1}`,x+8,m.t-10,10,INK);x+=gw;
          }return;
        }
        if(family==='sunburst'){
          const cx=width/2,cy=height/2,r=Math.min(w,h)*.48,total=totals.reduce((a,b)=>a+b,0)||1;let angle=-TAU/4;
          const wedge=(a,b,inner,outer,c,alpha)=>{ctx.beginPath();ctx.arc(cx,cy,outer,a,b);ctx.arc(cx,cy,inner,b,a,true);ctx.closePath();ctx.globalAlpha=alpha;ctx.fillStyle=c;ctx.fill();ctx.globalAlpha=1;};
          for(let g=0;g<6;g++){const span=totals[g]/total*TAU;wedge(angle,angle+span,22,r*.56,COLORS[g],.8);let sa=angle;
            for(let stage=0;stage<6;stage++){const members=data.nodes.filter(n=>n.group===g&&n.stage===stage),v=members.reduce((s,n)=>s+n.value,0),part=v/total*TAU;wedge(sa,sa+part,r*.59,r,COLORS[g],.25+.65*stage/5);pointHit(cx+Math.cos(sa+part/2)*r*.8,cy+Math.sin(sa+part/2)*r*.8,r*.12,{kind:'group',group:g,label:`${config.roles[g]} · tầng ${stage+1}`,value:v,unit:data.unit});sa+=part;}
            angle+=span;
          }text(`${nodes.length}`,cx,cy+5,config.thumb?12:20,INK,'center');return;
        }
        if(family==='lanes'){
          for(let g=0;g<6;g++){rect(m.l,m.t+g/6*h,w,h/6-4,COLORS[g],.045);if(!config.thumb)text(`G${g+1}`,m.l-8,m.t+(g+.5)/6*h,10,MUTED,'right');}
          nodes.forEach(n=>{const p=data.synthetic?(time+(hash(n.id)%100))/100%1:n.x/100,x=m.l+p*w,y=m.t+(n.group+.5)/6*h+(hash(n.id)%19-9)*h/160;node(n,x,y,config.thumb?2:4);});
        }else {nodes.forEach(n=>{const p=coords(n,true);node(n,...p,config.thumb?2:3+Math.sqrt(n.value/maxValue)*3);if(!config.thumb&&selected===n.id)text(n.id,p[0]+8,p[1]-8,11,INK);});
          const centers=Array.from({length:6},(_,g)=>nodes.filter(n=>n.group===g).slice(0,1));centers.flat().forEach(n=>{const p=coords(n,true);circle(...p,18+time%12,COLORS[n.group],.035);});}
      }
      function render(nextTime=time){
        if(destroyed)return;time=clamp(Number(nextTime)||0,0,100);hits=[];ctx.save();ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
        ctx.translate(pan.x,pan.y);ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-width/2,-height/2);
        const f=model.family;
        if(['force','radial','hive','chain','arc','bundle','tree'].includes(f))layoutGraph(f);
        else if(f==='chord')chord();else if(f==='matrix')matrix();else if(f==='sankey')sankey();else if(['trajectory','od','geofence','hexbin','voronoi'].includes(f))spatial(f);
        else if(['timeseries','stream','event','gantt','calendar'].includes(f))temporal(f);else if(f==='waterfall')waterfall();
        else if(['radar','swarm','parallel','ridgeline','rank'].includes(f))compare(f);else hierarchy(f);
        ctx.restore();if(config.thumb)text(`${data.synthetic?'DEMO':'DATA'} · ${Math.round(time)}% · ${data.nodes.length>60?'mẫu 60':data.nodes.length}`,12,height-8,8);
      }
      function hitAt(event){const b=canvas.getBoundingClientRect(),x=((event.clientX-b.left-pan.x-width/2)/zoom)+width/2,y=((event.clientY-b.top-pan.y-height/2)/zoom)+height/2;
        for(let i=hits.length-1;i>=0;i--){const p=hits[i];if(p.r?Math.hypot(x-p.x,y-p.y)<=p.r:(x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h))return p.payload;}return null;
      }
      const move=event=>{if(drag){pan.x=drag.px+event.clientX-drag.x;pan.y=drag.py+event.clientY-drag.y;moved=moved||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4;render(time);return;}if(config.onHover)config.onHover(hitAt(event),event);};
      const down=event=>{if(config.thumb)return;drag={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};moved=false;if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);};
      const up=event=>{if(config.thumb)return;drag=null;if(!moved){const hit=hitAt(event);if(hit&&hit.kind==='node')selected=hit.id;if(config.onSelect)config.onSelect(hit);render(time);}};
      const leave=()=>{if(config.onHover)config.onHover(null);};
      on('pointermove',move);on('pointerdown',down);on('pointerup',up);on('pointerleave',leave);
      resize();
      return {render,resize,setOptions(o){config={...config,...o};cacheKey=null;render(time);},select(id){selected=id;render(time);},
        zoomBy(f){zoom=clamp(zoom*f,.5,4);render(time);},resetView(){zoom=1;pan={x:0,y:0};render(time);},
        destroy(){destroyed=true;[['pointermove',move],['pointerdown',down],['pointerup',up],['pointerleave',leave]].forEach(([k,f])=>canvas.removeEventListener(k,f));hits=[];},
        getState(){return {time,zoom,selected,hits:hits.length};}};
    }
    return {create,COLORS,format};
  }
  root.VISUA=Object.assign(root.VISUA||{},{engineFactory,engine:engineFactory()});
  if(typeof module!=='undefined')module.exports=root.VISUA;
})(typeof window!=='undefined'?window:globalThis);
