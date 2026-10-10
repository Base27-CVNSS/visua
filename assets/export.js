(function(root){
  'use strict';
  const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Prevent imported labels/IDs from terminating the inline script in standalone HTML.
  const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  function widgetBootstrap(payload,engineFactory,dataFactory){
    'use strict';
    const E=engineFactory(),D=dataFactory(),data=D.validate(payload.data),config=payload.config,model=payload.model;
    const $=id=>document.getElementById(id),f=E.format;
    let time=config.time??50,playing=config.playing!==false,speed=config.speed||1,last=null,pinned=null;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)playing=false;
    $('title').textContent=model.name;$('method').textContent=model.limitation;
    $('source').textContent=`${data.synthetic?'DEMO · ':''}${data.source} · ${data.nodes.length} tác tử · ${data.edges.length} liên kết · ${data.unit} · Tọa độ sơ đồ 2D`;
    function detail(p){
      if(!p){$('detail').textContent='Bấm điểm, ô hoặc dải để ghim dữ liệu. Kéo hình để di chuyển.';return;}
      if(p.kind==='node'){
        const s=D.stats(data,time).sums.get(p.id);$('detail').textContent=`${p.id} · ${p.label}\n${config.roles[p.group]} · Tầng ${p.stage+1}\nGiá trị: ${f(p.value)} ${data.unit} · Chỉ số: ${p.score}/100\nVào: ${f(s.incoming)} · Ra: ${f(s.outgoing)} · Bậc: ${s.degree}\nCửa sổ hoạt động: ${p.start}–${p.end}%`;
      }else if(p.kind==='edge')$('detail').textContent=`${p.id} · ${p.source} → ${p.target}\nGiá trị: ${f(p.value)} ${data.unit}\nThời gian: ${p.time}–${p.end}%`;
      else $('detail').textContent=`${p.label}\n${p.metric||'Giá trị'}: ${f(p.value)} ${p.unit||data.unit}`;
    }
    const engine=E.create($('viz'),model,data,{...config,thumb:false,onHover(p){if(!pinned)detail(p);},onSelect(p){pinned=p;detail(p);}});
    function update(){engine.render(time);$('timeline').value=time;$('time').textContent=`${time.toFixed(1)}%`;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Dừng mô phỏng':'Phát mô phỏng');if(pinned)detail(pinned);}
    $('play').onclick=()=>{playing=!playing;last=null;update();};$('restart').onclick=()=>{time=0;last=null;update();};
    $('timeline').oninput=e=>{time=Number(e.target.value);playing=false;update();};$('speed').value=String(speed);$('speed').onchange=e=>speed=Number(e.target.value);
    $('zoomIn').onclick=()=>engine.zoomBy(1.25);$('zoomOut').onclick=()=>engine.zoomBy(.8);$('reset').onclick=()=>engine.resetView();
    $('unpin').onclick=()=>{pinned=null;engine.select(null);detail(null);};
    $('search').onchange=()=>{const q=$('search').value.toLocaleLowerCase('vi'),n=data.nodes.find(n=>n.id.toLocaleLowerCase('vi')===q)||data.nodes.find(n=>n.label.toLocaleLowerCase('vi').includes(q));if(n&&q){pinned={kind:'node',...n};engine.select(n.id);detail(pinned);}else $('detail').textContent='Không tìm thấy tác tử.';};
    config.roles.forEach((name,g)=>{const button=document.createElement('button'),dot=document.createElement('i');dot.style.background=E.COLORS[g];button.append(dot,document.createTextNode(`G${g+1} · ${name}`));button.onclick=()=>{config.group=config.group===g?-1:g;engine.setOptions({group:config.group});Array.from($('legend').children).forEach((b,i)=>b.classList.toggle('active',i===config.group));update();};$('legend').append(button);});
    window.addEventListener('resize',()=>engine.resize());if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>engine.resize()).observe($('viz'));
    document.addEventListener('visibilitychange',()=>last=null);
    function frame(now){if(!document.hidden&&playing){if(last!==null){time+=Math.min(80,now-last)/1000*2.5*speed;if(time>100)time=0;}update();}last=now;requestAnimationFrame(frame);}
    update();requestAnimationFrame(frame);
  }
  function buildHTML(model,data,config){
    const payload={model,data,config};
    return `<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(model.name)} — VISUA</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#19283f;font:12px/1.5 system-ui,sans-serif}header{padding:16px 20px;border-bottom:1px solid #e5eaf1;display:flex;align-items:center;justify-content:space-between;gap:15px}h1{font-size:16px;margin:0;font-weight:600}header span{color:#8594a9;font-size:9px;white-space:nowrap}#viz{width:100%;height:clamp(280px,58vh,720px);display:block;touch-action:none;cursor:crosshair}button,select,input{font:inherit}button,select{cursor:pointer;border:1px solid #dce4ee;border-radius:5px;background:white;padding:6px 9px;color:#566980}button:hover{background:#f3f7ff}.controls{display:flex;align-items:center;gap:9px;border-block:1px solid #e5eaf1;padding:12px 16px;background:#fafcff}#play{background:#19283f;color:white;width:30px}#timeline{flex:1;accent-color:#2563eb;min-width:45px}#time{font:10px ui-monospace,monospace;min-width:42px}#legend{display:flex;flex-wrap:wrap;gap:12px;padding:11px 20px}#legend button{padding:0;border:0;font-size:10px;color:#77889e;display:flex;align-items:center;gap:4px}#legend button.active{color:#19283f;font-weight:700}i{width:7px;height:7px;border-radius:50%;display:inline-block}.info{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:15px 20px;background:#fcfdff;border-top:1px solid #edf1f6}#detail{white-space:pre-line;color:#52647c;font-size:11px}#method{font-size:10px;color:#8190a5}.lookup{display:flex;gap:7px;margin-bottom:10px}#search{border:1px solid #dce4ee;border-radius:5px;padding:6px 8px;width:100%;font-size:11px}footer{border-top:1px solid #edf1f6;padding:12px 20px;color:#8b9bb0;font-size:9px}#source{margin-bottom:5px}@media(max-width:550px){header{padding:12px}h1{font-size:12px}.controls{gap:5px;padding:9px}.controls button{padding:5px}.controls select{max-width:50px}.info{grid-template-columns:1fr}#legend{gap:9px}#viz{height:340px}}
</style></head><body><header><h1 id="title"></h1><span>VISUA / ${escapeHTML(model.id)} · DYNAMIC HTML</span></header><canvas id="viz" role="img" aria-label="Mô hình trực quan động"></canvas><div id="legend"></div><div class="controls"><button id="play" aria-label="Dừng mô phỏng">Ⅱ</button><button id="restart" aria-label="Chạy lại">↺</button><output id="time"></output><input id="timeline" type="range" min="0" max="100" step="0.1" aria-label="Tiến độ thời gian"><select id="speed" aria-label="Tốc độ"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select><button id="zoomOut" aria-label="Thu nhỏ">−</button><button id="reset" aria-label="Khôi phục góc nhìn">⌖</button><button id="zoomIn" aria-label="Phóng to">+</button></div><div class="info"><div><div class="lookup"><input id="search" placeholder="ID / tên tác tử, Enter để chọn" aria-label="Tìm tác tử"><button id="unpin">Bỏ ghim</button></div><div id="detail">Bấm để xem chi tiết tác tử.</div></div><div><b>Cách đọc mô hình</b><p id="method"></p></div></div><footer><div id="source"></div>Xuất bằng VISUA · Màu nhóm G1–G6 · Tất cả dữ liệu và bộ chạy nằm trong file này.</footer><script>\n(${widgetBootstrap.toString()})(${safeJSON(payload)},${root.VISUA.engineFactory.toString()},${root.VISUA.dataFactory.toString()});\n</script></body></html>`;
  }
  function iframeCode(html){return `<iframe title="VISUA — mô hình trực quan động" sandbox="allow-scripts" style="width:100%;height:780px;border:0;border-radius:12px" loading="lazy" srcdoc="${escapeHTML(html)}"></iframe>`;}
  root.VISUA=Object.assign(root.VISUA||{},{exporter:{buildHTML,iframeCode,safeJSON,escapeHTML}});
  if(typeof module!=='undefined')module.exports=root.VISUA;
})(typeof window!=='undefined'?window:globalThis);
