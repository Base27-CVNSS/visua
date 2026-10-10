(function(){
  'use strict';
  const V=window.VISUA,$=id=>document.getElementById(id),f=V.engine.format,escape=V.exporter.escapeHTML;
  const PAGE_SIZE=12,state={model:V.models[0],category:'all',scenario:'all',family:'all',query:'',favoritesOnly:false,page:0,
    count:120,time:50,speed:1,playing:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,labels:true,particles:true,group:-1,custom:null};
  const cachedData=new Map();let focused=null,thumbnails=[],selected=null,exportedHTML='',exportTab='html',toastTimer;
  let favorites=new Set();try{const raw=JSON.parse(localStorage.getItem('visua.favorites')||'[]');if(Array.isArray(raw))favorites=new Set(raw.filter(id=>V.models.some(m=>m.id===id)));}catch(error){console.info('VISUA: favorites unavailable',error.name);}
  function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function getData(model=state.model){if(state.custom)return state.custom;const key=`${model.scenario}:${state.count}`;if(!cachedData.has(key))cachedData.set(key,V.data.generate(state.count,model.seed,model.scenario));return cachedData.get(key);}
  function roles(model=state.model){return state.custom?['Nhóm 1','Nhóm 2','Nhóm 3','Nhóm 4','Nhóm 5','Nhóm 6']:V.scenarios.find(s=>s.id===model.scenario).roles;}
  function saveFavorites(){try{localStorage.setItem('visua.favorites',JSON.stringify([...favorites]));}catch(error){console.info('VISUA: session-only favorites',error.name);}$('favCount').textContent=favorites.size;$('favoriteFocus').textContent=favorites.has(state.model.id)?'★':'☆';$('favoriteFocus').setAttribute('aria-pressed',String(favorites.has(state.model.id)));}
  function favorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();renderCatalogue();}
  function stats(){const data=getData(),s=V.data.stats(data,state.time);$('nodeStat').textContent=f(data.nodes.length);$('edgeStat').textContent=f(s.edgeCount);$('activeStat').textContent=f(s.active);$('totalStat').textContent=f(s.total);$('totalStat').title=data.unit;$('timeOutput').textContent=`${state.time.toFixed(1)}%`;$('timeline').value=state.time;
    $('playBtn').textContent=state.playing?'Ⅱ':'▶';$('playBtn').setAttribute('aria-label',state.playing?'Dừng mô phỏng':'Phát mô phỏng');if(selected)showSelection(selected);}
  function showSelection(p){
    const box=$('selection');if(!p){box.className='selection';box.innerHTML='<div class="selection-icon">⌖</div><b>Khám phá từng tác tử</b><p>Di chuột để xem dữ liệu.<br>Bấm điểm, dải hoặc ô để ghim chi tiết.<br>Kéo khung hình để di chuyển.</p>';return;}
    box.className='selection detail';box.replaceChildren();const h=document.createElement('h3');h.textContent=p.kind==='node'?`${p.id} · ${p.label}`:p.kind==='edge'?`${p.source} → ${p.target}`:p.label;box.append(h);
    const dl=document.createElement('dl'),data=getData();const add=(key,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);};
    if(p.kind==='node'){
      const n=data.nodes.find(n=>n.id===p.id);if(!n)return;const s=V.data.stats(data,state.time).sums.get(n.id);
      add('Vai trò',`G${n.group+1} · ${roles()[n.group]}`);add('Tầng',n.stage+1);add('Giá trị',`${f(n.value)} ${data.unit}`);add('Chỉ số đầu vào',`${n.score}/100`);add('Cửa sổ',`${n.start}–${n.end}%`);add('Tổng vào',f(s.incoming));add('Tổng ra',f(s.outgoing));add('Bậc liên kết',s.degree);
      box.append(dl);const links=document.createElement('div');links.className='evidence-list';const label=document.createElement('span');label.textContent='Liên kết gần đây (tới mốc đang xem)';links.append(label);
      data.edges.filter(e=>e.time<=state.time&&(e.source===n.id||e.target===n.id)).sort((a,b)=>b.time-a.time).slice(0,5).forEach(e=>{const b=document.createElement('button');b.textContent=`${e.source} → ${e.target} · ${f(e.value)}`;b.onclick=()=>{selected={kind:'edge',...e};showSelection(selected);};links.append(b);});box.append(links);
    }else{if(p.kind==='edge'){add('ID',p.id);add('Thời gian',`${p.time}–${p.end}%`);}add(p.metric||'Giá trị',`${f(p.value)} ${p.unit||data.unit}`);box.append(dl);}
    const clear=document.createElement('button');clear.className='button subtle';clear.textContent='Bỏ ghim';clear.style.marginTop='8px';clear.onclick=()=>{selected=null;focused.select(null);showSelection(null);};box.append(clear);
  }
  function tooltip(p,event){const el=$('tooltip');if(!p||!event){el.hidden=true;return;}const b=$('canvasWrap').getBoundingClientRect();el.textContent=p.kind==='node'?`${p.id} · ${p.label} · ${f(p.value)} ${getData().unit}`:p.kind==='edge'?`${p.source} → ${p.target} · ${f(p.value)} ${getData().unit}`:`${p.label} · ${f(p.value)} ${p.unit||getData().unit}`;
    el.hidden=false;el.style.left=`${Math.max(8,Math.min(event.clientX-b.left+12,b.width-240))}px`;el.style.top=`${Math.max(8,Math.min(event.clientY-b.top+12,b.height-65))}px`;}
  function buildLegend(){
    $('legend').replaceChildren();roles().forEach((name,g)=>{const button=document.createElement('button'),dot=document.createElement('i');dot.style.background=V.engine.COLORS[g];button.append(dot,document.createTextNode(`G${g+1} · ${name}`));button.classList.toggle('active',state.group===g);button.setAttribute('aria-pressed',String(state.group===g));button.onclick=()=>{state.group=state.group===g?-1:g;focused.setOptions({group:state.group});buildLegend();};$('legend').append(button);});
    const all=document.createElement('button');all.textContent='Tất cả nhóm';all.onclick=()=>{state.group=-1;focused.setOptions({group:-1});buildLegend();};$('legend').append(all);$('legend').title='Bấm để lọc khung hình theo nhóm. Các tổng ở bảng chi tiết luôn tính toàn bộ dữ liệu.';
  }
  function openModel(model,updateURL=true){
    state.model=model;state.group=-1;selected=null;focused?.destroy();tooltip(null);showSelection(null);$('actorSearch').value='';$('actorResults').replaceChildren();
    $('focusId').textContent=model.id;$('focusTitle').textContent=model.name;$('question').textContent=model.question;$('limitation').textContent=model.limitation;
    $('sourceBadge').textContent=getData().synthetic?'DEMO · Dữ liệu mô phỏng':`DATA · ${getData().source}`;$('coordsBadge').textContent='Tọa độ sơ đồ 2D';
    $('focusCanvas').setAttribute('aria-label',`${model.name}. ${model.question}`);$('focusCanvas').tabIndex=0;
    focused=V.engine.create($('focusCanvas'),model,getData(),{labels:state.labels,particles:state.particles,roles:roles(),onHover:tooltip,onSelect(p){selected=p;showSelection(p);}});
    focused.render(state.time);buildLegend();stats();saveFavorites();
    if(updateURL){try{const url=new URL(location.href);url.searchParams.set('model',model.id);history.replaceState(null,'',url);}catch(error){console.info('VISUA: URL unchanged',error.name);}}
    document.querySelectorAll('.model-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===model.id));
  }
  function filtered(){const q=state.query.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu,'');return V.models.filter(m=>
    (state.category==='all'||m.category===state.category)&&(state.scenario==='all'||m.scenario===state.scenario)&&(state.family==='all'||m.family===state.family)&&(!state.favoritesOnly||favorites.has(m.id))&&
    (!q||`${m.id} ${m.name} ${m.question} ${m.family} ${m.description}`.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu,'').includes(q)));}
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>entries.forEach(e=>{const thumb=thumbnails.find(t=>t.canvas===e.target);if(thumb)thumb.visible=e.isIntersecting;}),{rootMargin:'40px'});
  function renderCatalogue(){
    thumbnails.forEach(t=>{observer?.unobserve(t.canvas);t.engine.destroy();});thumbnails=[];$('modelGrid').replaceChildren();const list=filtered(),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));state.page=Math.min(state.page,pages-1);
    $('resultCount').textContent=list.length;$('categoryTitle').textContent=state.favoritesOnly?'Mô hình đã lưu':state.category==='all'?'Tất cả mô hình':V.groups.find(g=>g.id===state.category).name;
    $('allNav').classList.toggle('active',!state.favoritesOnly&&state.category==='all');$('favNav').classList.toggle('active',state.favoritesOnly);document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('active',!state.favoritesOnly&&b.dataset.category===state.category));
    const chunk=list.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE);
    if(!chunk.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Chưa có mô hình phù hợp. Thử bỏ bớt bộ lọc hoặc lưu mô hình bằng dấu ☆.';$('modelGrid').append(empty);}
    chunk.forEach(model=>{
      const card=document.createElement('article');card.className=`model-card${model.id===state.model.id?' selected':''}`;card.dataset.id=model.id;
      card.innerHTML=`<div class="card-top"><span class="card-id">${model.id}</span><button class="card-favorite${favorites.has(model.id)?' saved':''}" aria-label="Lưu ${escape(model.name)}" aria-pressed="${favorites.has(model.id)}">${favorites.has(model.id)?'★':'☆'}</button></div><canvas class="card-preview" role="button" tabindex="0" aria-label="Mở ${escape(model.name)}"></canvas><div class="card-body"><button class="card-title">${escape(model.name)}</button><div class="card-meta"><span>${escape(V.groups.find(g=>g.id===model.category).name)}</span><button class="card-export">&lt;/&gt; HTML ↗</button></div></div>`;
      $('modelGrid').append(card);const canvas=card.querySelector('canvas'),engine=V.engine.create(canvas,model,getData(model),{thumb:true,roles:roles(model),labels:false});engine.render(state.time);
      thumbnails.push({canvas,engine,visible:!observer});observer?.observe(canvas);
      const choose=()=>openModel(model);canvas.onclick=choose;canvas.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};card.querySelector('.card-title').onclick=choose;
      card.querySelector('.card-favorite').onclick=()=>favorite(model.id);card.querySelector('.card-export').onclick=()=>{openModel(model);showExport();};
    });
    $('pageInfo').textContent=list.length?`${state.page*PAGE_SIZE+1}–${Math.min((state.page+1)*PAGE_SIZE,list.length)} / ${list.length} mô hình`:'0 mô hình';$('pageNumber').textContent=`${state.page+1} / ${pages}`;$('prevPage').disabled=state.page===0;$('nextPage').disabled=state.page>=pages-1;
  }
  function filtersChanged(){state.page=0;renderCatalogue();}
  function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function showExport(){
    exportedHTML=V.exporter.buildHTML(state.model,getData(),{time:state.time,speed:state.speed,playing:state.playing,labels:state.labels,particles:state.particles,group:state.group,roles:roles()});exportTab='html';refreshExport();$('exportDialog').showModal();
  }
  function refreshExport(){const value=exportTab==='html'?exportedHTML:V.exporter.iframeCode(exportedHTML);$('exportCode').value=value;document.querySelectorAll('[data-export-tab]').forEach(b=>b.classList.toggle('active',b.dataset.exportTab===exportTab));$('exportMeta').textContent=`${state.model.id} · ${getData().nodes.length} tác tử · ${getData().edges.length} liên kết · ${(new Blob([value]).size/1024).toFixed(1)} KB · Không cần CDN`;}
  function actorMatches(){const q=$('actorSearch').value.trim().toLocaleLowerCase('vi');$('actorResults').replaceChildren();if(!q)return;getData().nodes.filter(n=>`${n.id} ${n.label}`.toLocaleLowerCase('vi').includes(q)).slice(0,5).forEach(n=>{const b=document.createElement('button');b.textContent=`${n.id} · ${n.label}`;b.onclick=()=>chooseActor(n);$('actorResults').append(b);});}
  function chooseActor(n){selected={kind:'node',...n};focused.select(n.id);showSelection(selected);$('actorSearch').value=n.id;$('actorResults').replaceChildren();}
  V.groups.forEach(group=>{const b=document.createElement('button');b.className='nav';b.dataset.category=group.id;b.innerHTML=`<span>${group.icon}</span>${group.name}<small>50</small>`;b.onclick=()=>{state.category=group.id;state.favoritesOnly=false;filtersChanged();};$('categoryNav').append(b);});
  V.scenarios.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('scenarioFilter').append(o);});
  V.families.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('familyFilter').append(o);});
  $('allNav').onclick=()=>{state.category='all';state.favoritesOnly=false;filtersChanged();};$('favNav').onclick=()=>{state.category='all';state.favoritesOnly=true;filtersChanged();};
  $('search').oninput=e=>{state.query=e.target.value;filtersChanged();};$('scenarioFilter').onchange=e=>{state.scenario=e.target.value;filtersChanged();};$('familyFilter').onchange=e=>{state.family=e.target.value;filtersChanged();};
  $('clearFilters').onclick=()=>{Object.assign(state,{category:'all',scenario:'all',family:'all',query:'',favoritesOnly:false});$('search').value='';$('scenarioFilter').value='all';$('familyFilter').value='all';filtersChanged();};
  $('prevPage').onclick=()=>{state.page--;renderCatalogue();};$('nextPage').onclick=()=>{state.page++;renderCatalogue();};
  $('playBtn').onclick=()=>{state.playing=!state.playing;stats();};$('restartBtn').onclick=()=>{state.time=0;focused.render(0);stats();};$('timeline').oninput=e=>{state.time=Number(e.target.value);state.playing=false;focused.render(state.time);thumbnails.forEach(t=>t.engine.render(state.time));stats();};$('speed').onchange=e=>state.speed=Number(e.target.value);
  $('labelToggle').onchange=e=>{state.labels=e.target.checked;focused.setOptions({labels:state.labels});};$('particleToggle').onchange=e=>{state.particles=e.target.checked;focused.setOptions({particles:state.particles});thumbnails.forEach(t=>t.engine.setOptions({particles:state.particles}));};
  $('zoomIn').onclick=()=>focused.zoomBy(1.25);$('zoomOut').onclick=()=>focused.zoomBy(.8);$('resetView').onclick=()=>focused.resetView();
  $('favoriteFocus').onclick=()=>favorite(state.model.id);$('exportBtn').onclick=showExport;$('helpBtn').onclick=()=>$('helpDialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.querySelectorAll('[data-export-tab]').forEach(b=>b.onclick=()=>{exportTab=b.dataset.exportTab;refreshExport();});
  $('downloadHtmlBtn').onclick=()=>{download(exportedHTML,`VISUA_${state.model.id}_${state.model.family}.html`,'text/html;charset=utf-8');notify('Đã xuất mô hình HTML độc lập.');};
  $('copyCodeBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('exportCode').value);notify('Đã sao chép mã.');}catch(error){$('exportCode').focus();$('exportCode').select();try{if(document.execCommand('copy'))notify('Đã sao chép mã.');else notify('Mã đã được chọn — bấm Ctrl+C để sao chép.');}catch(copyError){notify('Mã đã được chọn — bấm Ctrl+C để sao chép.');}}};
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.studio').requestFullscreen();}catch(error){notify('Trình duyệt chưa hỗ trợ toàn màn hình trong khung này.');}};
  $('actorSearch').oninput=actorMatches;$('actorSearch').onkeydown=e=>{if(e.key==='Enter'){const q=e.target.value.trim().toLocaleLowerCase('vi'),n=getData().nodes.find(n=>n.id.toLocaleLowerCase('vi')===q)||getData().nodes.find(n=>`${n.id} ${n.label}`.toLocaleLowerCase('vi').includes(q));if(n&&q)chooseActor(n);else notify('Không tìm thấy tác tử.');}};
  $('agentCount').onchange=e=>{state.count=Number(e.target.value);if(state.custom){notify('Số tác tử đang theo JSON nhập. Bấm Dữ liệu demo để đổi quy mô mô phỏng.');return;}cachedData.clear();openModel(state.model,false);renderCatalogue();};
  $('demoBtn').onclick=()=>{state.custom=null;cachedData.clear();$('agentCount').disabled=false;$('footerSource').textContent='Dữ liệu demo · Chỉ số là mô phỏng, không phải kết luận điều tra.';openModel(state.model,false);renderCatalogue();notify('Đã phục hồi dữ liệu demo tái lập.');};
  $('dataExportBtn').onclick=()=>download(JSON.stringify(getData(),null,2),'VISUA_dataset.json','application/json;charset=utf-8');$('importBtn').onclick=()=>$('importFile').click();
  $('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('File quá lớn, tối đa 8 MB.');const parsed=V.data.validate(JSON.parse(await file.text()));state.custom=parsed;state.time=50;state.playing=false;$('agentCount').disabled=true;$('footerSource').textContent=`${parsed.source} · ${parsed.synthetic?'Dữ liệu mô phỏng':'Chỉ số theo dữ liệu nhập'} · ${parsed.unit}`;openModel(state.model,false);renderCatalogue();notify(`Đã nhập ${parsed.nodes.length} tác tử và ${parsed.edges.length} liên kết.`);}catch(error){notify(`Không nhập được: ${error.message}`);}finally{e.target.value='';}};
  $('focusCanvas').onkeydown=e=>{if(e.key===' '){e.preventDefault();state.playing=!state.playing;stats();}else if(e.key==='+')focused.zoomBy(1.25);else if(e.key==='-')focused.zoomBy(.8);else if(e.key==='Escape'){selected=null;focused.select(null);showSelection(null);}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();state.time=Math.max(0,Math.min(100,state.time+(e.key==='ArrowRight'?1:-1)));state.playing=false;focused.render(state.time);stats();}};
  window.addEventListener('resize',()=>{focused?.resize();thumbnails.forEach(t=>t.engine.resize());});document.addEventListener('fullscreenchange',()=>setTimeout(()=>focused?.resize(),80));
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>focused?.resize()).observe($('canvasWrap'));
  const id=new URLSearchParams(location.search).get('model'),initial=V.models.find(m=>m.id===id)||V.models[0];openModel(initial,false);renderCatalogue();
  let last=null,lastRender=0,lastStats=0,lastThumb=0;document.addEventListener('visibilitychange',()=>last=null);
  function frame(now){
    if(document.hidden){last=null;requestAnimationFrame(frame);return;}
    if(state.playing){if(last!==null){state.time+=Math.min(80,now-last)/1000*2.5*state.speed;if(state.time>100)state.time=0;}
      if(now-lastRender>40){focused.render(state.time);lastRender=now;}
      if(now-lastStats>250){stats();lastStats=now;}
      if(now-lastThumb>300){thumbnails.filter(t=>t.visible).forEach(t=>t.engine.render(state.time));lastThumb=now;}
    }last=now;requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
