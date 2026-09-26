let opentype=null, createFont=null, JSZip=null;
let fontEnginePromise=null;
const FONT_ENGINE_URLS={
  opentype:"https://cdn.jsdelivr.net/npm/opentype.js@2.0.0/+esm",
  fonteditor:"https://esm.sh/fonteditor-core@2.6.3?bundle",
  jszip:"https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
};
async function loadFontEngine(){
  if(opentype&&createFont&&JSZip)return true;
  if(!fontEnginePromise){
    fontEnginePromise=(async()=>{
      const [ot,fe,zip]=await Promise.all([
        import(FONT_ENGINE_URLS.opentype),
        import(FONT_ENGINE_URLS.fonteditor),
        import(FONT_ENGINE_URLS.jszip)
      ]);
      opentype=ot; createFont=fe.createFont; JSZip=zip.default||zip.JSZip||zip;
      if(!opentype?.Path||!opentype?.Glyph||!opentype?.Font||typeof createFont!=="function"||typeof JSZip!=="function") throw new Error("Font engine tidak kompatibel.");
      return true;
    })().catch(err=>{fontEnginePromise=null;throw err});
  }
  return fontEnginePromise;
}

const SETS = {
  upper:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"], lower:[..."abcdefghijklmnopqrstuvwxyz"], numbers:[..."0123456789"],
  symbols:[...".,!?;:'\"-–_()[]{}@#$%&+/="]
};
const GROUP_NAMES={upper:"Huruf Kapital",lower:"Huruf Kecil",numbers:"Angka",symbols:"Simbol & Tanda Baca"};
const ALL_CHARS=Object.values(SETS).flat(), TOTAL=ALL_CHARS.length;
const STORAGE_KEY="glyphcraft-studio-v2", PROJECTS_KEY="glyphcraft-studio-projects-v1";
function storageGet(key,fallback=null){try{const v=globalThis.localStorage?.getItem(key);return v??fallback}catch{return fallback}}
function storageSet(key,value){try{globalThis.localStorage?.setItem(key,value);return true}catch{return false}}

const BRUSHES={
  monoline:{name:"Monoline",desc:"Bersih & konsisten",min:.98,max:1.02,angle:0,texture:0,opacity:1,cap:"round"},
  marker:{name:"Marker",desc:"Tebal, sedikit flat",min:1.05,max:1.18,angle:-12,texture:.03,opacity:.96,cap:"round"},
  brush:{name:"Brush Pen",desc:"Pressure responsif",min:.35,max:1.55,angle:0,texture:0,opacity:1,cap:"round"},
  fountain:{name:"Fountain",desc:"Nib miring elegan",min:.62,max:1.18,angle:-38,texture:0,opacity:1,cap:"square"},
  pencil:{name:"Pencil",desc:"Tipis & textured",min:.48,max:.95,angle:0,texture:.34,opacity:.68,cap:"round"},
  chalk:{name:"Chalk",desc:"Kering & kasar",min:.82,max:1.35,angle:0,texture:.55,opacity:.65,cap:"round"},
  felt:{name:"Felt Tip",desc:"Smooth marker",min:.82,max:1.18,angle:0,texture:.08,opacity:.9,cap:"round"},
  calligraphy:{name:"Calligraphy",desc:"Nib lebar 45°",min:.72,max:1.35,angle:-45,texture:0,opacity:1,cap:"square"}
};

const TEMPLATES=[
  {id:"clean",name:"Clean Sans",era:"Modern / neutral",cat:"display",font:"Arial, Helvetica, sans-serif",weight:700,scale:1,tracking:0,desc:"Proporsi bersih dan mudah dibaca."},
  {id:"retro70",name:"Retro 70s",era:"Retro / groovy",cat:"retro",font:"Fascinate, system-ui",weight:400,scale:.92,tracking:0,desc:"Display gemuk, playful, cocok poster."},
  {id:"slab",name:"Slab Poster",era:"Retro / bold",cat:"retro",font:"Alfa Slab One, Georgia, serif",weight:400,scale:.92,tracking:0,desc:"Serif blok tebal dengan karakter kuat."},
  {id:"western",name:"Western",era:"Classic / frontier",cat:"classic",font:"Rye, Georgia, serif",weight:400,scale:.9,tracking:0,desc:"Dekoratif ala poster western."},
  {id:"caslon",name:"Editorial Serif",era:"Classic / editorial",cat:"classic",font:"Libre Caslon Text, Georgia, serif",weight:700,scale:.95,tracking:0,desc:"Serif klasik untuk tampilan editorial."},
  {id:"condensed",name:"Condensed Poster",era:"Display / tall",cat:"display",font:"Bebas Neue, Impact, sans-serif",weight:400,scale:.95,tracking:2,desc:"Tinggi, ramping, tegas."},
  {id:"script",name:"Casual Script",era:"Handmade / script",cat:"hand",font:"Pacifico, cursive",weight:400,scale:.82,tracking:0,desc:"Script santai untuk signature style."},
  {id:"pixel",name:"Pixel Arcade",era:"Retro / 8-bit",cat:"retro",font:"Press Start 2P, monospace",weight:400,scale:.65,tracking:0,desc:"Template pixel retro untuk gaya game."},
  {id:"neon",name:"Neon Line",era:"Retro / 80s",cat:"retro",font:"Monoton, sans-serif",weight:400,scale:.78,tracking:0,desc:"Garis display ala signage neon."}
];

const $=id=>document.getElementById(id);
const canvas=$("drawCanvas"),ctx=canvas.getContext("2d");
const sigCanvas=$("signatureCanvas"),sigCtx=sigCanvas.getContext("2d");
const scanCanvas=$("scanPreview"),scanCtx=scanCanvas.getContext("2d");

let state=loadState(), activeGroup=state.activeGroup||"upper", activeChar=ALL_CHARS.includes(state.activeChar)?state.activeChar:"A";
let activeVariant=Math.max(0,state.activeVariant||0), mode="pen", isDrawing=false,currentStroke=null,eraseLast=null;
let generated={font:null,otf:null,ttf:null,woff:null,woff2:null};
let previewObjectUrl=null,customTemplateFace=null,toastTimer,previewTimer,scanImage=null;
let sigDrawing=false,sigStroke=null,sigStrokes=[];

function defaultState(){
  return {
    projectId:(globalThis.crypto?.randomUUID?.()||String(Date.now())),projectName:"My Handwriting",theme:(globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light"),
    activeGroup:"upper",activeChar:"A",activeVariant:0,fontName:"My Handwriting",fontStyle:"Regular",spacing:70,templateOpacity:22,brushSize:26,
    brush:"monoline",template:"clean",snap:true,drawings:{},kerning:{AV:-40,To:-35,Wa:-25,Yo:-35,Ta:-20,LT:-15,FA:-20,PA:-15},
    ligatures:["th","st","fi"],snapshots:[],customTemplate:null
  };
}
function normalizeState(raw){
  const base=defaultState(), s={...base,...raw};
  s.drawings=s.drawings||{};s.kerning=s.kerning||base.kerning;s.ligatures=s.ligatures||[];s.snapshots=s.snapshots||[];
  // migrate v1 drawings: ch -> stroke[] to ch -> variant[]
  for(const [ch,val] of Object.entries(s.drawings)){
    if(Array.isArray(val)&&val.length&&val[0]?.points) s.drawings[ch]=[val];
    if(!Array.isArray(s.drawings[ch])) s.drawings[ch]=[];
  }
  return s;
}
function loadState(){try{return normalizeState(JSON.parse(storageGet(STORAGE_KEY,"{}"))||{});}catch{return defaultState();}}
function saveState(){
  state.activeGroup=activeGroup;state.activeChar=activeChar;state.activeVariant=activeVariant;
  state.fontName=$("fontName").value.trim()||"My Handwriting";state.projectName=state.fontName;
  state.fontStyle=$("fontStyle").value;state.spacing=Number($("letterSpacing").value)||70;state.templateOpacity=Number($("templateOpacity").value);
  state.brushSize=Number($("brushSize").value);state.snap=$("snapToggle").checked;
  const stored=storageSet(STORAGE_KEY,JSON.stringify(state));$("autosaveLabel").textContent=stored?"Tersimpan lokal":"Mode sementara";$("projectLabel").textContent=state.fontName;
}
function getVariants(ch){
  if(!Array.isArray(state.drawings[ch])||state.drawings[ch].length===0)state.drawings[ch]=[[]];
  return state.drawings[ch];
}
function getCurrentStrokes(){const v=getVariants(activeChar);while(v.length<=activeVariant)v.push([]);return v[activeVariant];}
function hasArt(strokes){return Array.isArray(strokes)&&strokes.some(s=>s.points?.length>1);}
function isDone(ch){return (state.drawings[ch]||[]).some(hasArt);}
function doneCount(){return ALL_CHARS.filter(isDone).length;}
function showToast(msg){clearTimeout(toastTimer);$("toast").textContent=msg;$("toast").classList.add("show");toastTimer=setTimeout(()=>$("toast").classList.remove("show"),1800);}
function slugify(t){return (t||"my-font").normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase()||"my-font";}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200);}

function setTheme(theme,persist=true){
  state.theme=theme;document.documentElement.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==="dark"?"#101217":"#f4f5f7";
  if(persist)saveState();drawCanvas();drawSignature();
}
function currentTemplate(){return TEMPLATES.find(t=>t.id===state.template)||TEMPLATES[0];}
function renderTemplateLibrary(filter="all"){
  const grid=$("templateGrid");grid.innerHTML="";
  TEMPLATES.filter(t=>filter==="all"||t.cat===filter).forEach(t=>{
    const card=document.createElement("button");card.className="template-card"+(t.id===state.template?" active":"");card.type="button";
    card.innerHTML=`<span class="tag">${t.cat}</span><div class="template-glyph" style="font-family:${t.font};font-weight:${t.weight}">Aa</div><strong>${t.name}</strong><small>${t.era}</small>`;
    card.addEventListener("click",()=>{state.template=t.id;applyTemplateUI();renderTemplateLibrary(filter);saveState();drawCanvas();showToast(`${t.name} dipakai sebagai guide`);});
    grid.appendChild(card);
  });
}
function applyTemplateUI(){
  const t=currentTemplate();$("templateName").textContent=t.name;$("templateEra").textContent=t.era;$("templateMiniGlyph").style.fontFamily=t.font;$("templateMiniGlyph").style.fontWeight=t.weight;
  $("templateDescription").textContent=`${t.name}: ${t.desc}`; 
}
function openModal(id){
  const d=$(id);if(!d||d.open)return;
  try{if(typeof d.showModal==="function")d.showModal();else d.setAttribute("open","");}
  catch(e){console.warn("Dialog fallback",id,e);d.setAttribute("open","");}
}
function closeModal(id){
  const d=$(id);if(!d)return;
  try{if(typeof d.close==="function"&&d.open)d.close();else d.removeAttribute("open");}
  catch{d.removeAttribute("open");}
}
function renderGrid(){
  [...$("charTabs").querySelectorAll("button")].forEach(b=>b.classList.toggle("active",b.dataset.group===activeGroup));
  const grid=$("charGrid");grid.innerHTML="";
  SETS[activeGroup].forEach(ch=>{
    const b=document.createElement("button");b.type="button";b.className="char-btn"+(ch===activeChar?" active":"")+(isDone(ch)?" done":"")+((state.drawings[ch]||[]).length>1?" multi":"");b.textContent=ch;b.title=`Gambar ${ch}`;
    b.addEventListener("click",()=>{selectChar(ch);if(innerWidth<=820){$("sidebar").classList.remove("open");$("scrim").hidden=true}});grid.appendChild(b);
  });
}
function renderVariants(){
  const vars=getVariants(activeChar);if(activeVariant>=vars.length)activeVariant=vars.length-1;
  $("variantStrip").innerHTML="";vars.forEach((strokes,i)=>{
    const b=document.createElement("button");b.className=`variant-btn${i===activeVariant?" active":""}${hasArt(strokes)?" has-art":""}`;b.textContent=`V${i+1}`;
    b.addEventListener("click",()=>{activeVariant=i;updateEditor();renderVariants();drawCanvas();saveState();});$("variantStrip").appendChild(b);
  });
  $("variantCount").textContent=`${vars.length} variant${vars.length>1?"s":""}`;$("variantTitle").textContent=`V${activeVariant+1}`;
}
function addVariant(){
  const vars=getVariants(activeChar);if(vars.length>=4)return showToast("Maksimal 4 varian per karakter");
  vars.push([]);activeVariant=vars.length-1;renderVariants();updateEditor();drawCanvas();saveState();showToast("Varian baru dibuat");
}
function selectChar(ch){
  activeChar=ch;activeGroup=Object.keys(SETS).find(k=>SETS[k].includes(ch))||activeGroup;activeVariant=0;renderGrid();renderVariants();updateEditor();drawCanvas();saveState();
}
function updateEditor(){
  $("charTitle").textContent=activeChar;$("groupEyebrow").textContent=GROUP_NAMES[activeGroup];$("mobileCharLabel").textContent=`${GROUP_NAMES[activeGroup]} · ${activeChar}`;
  const done=hasArt(getCurrentStrokes());$("saveStatus").classList.toggle("saved",done);$("saveStatus").innerHTML=`<span></span>${done?"Tersimpan otomatis":"Belum digambar"}`;
  $("strokeCount").textContent=`${getCurrentStrokes().length} strokes`;renderVariants();updateProgress();updateAssistantHint();
}
function updateProgress(){
  const count=doneCount(),pct=Math.round(count/TOTAL*100),remaining=TOTAL-count;$("progressText").textContent=`${count} / ${TOTAL} karakter`;$("progressPercent").textContent=`${pct}%`;$("progressBar").style.width=`${pct}%`;
  updateFinishModal();updateQualityMini();
}
function updateFinishModal(){
  const count=doneCount(),pct=Math.round(count/TOTAL*100),missing=ALL_CHARS.filter(ch=>!isDone(ch));
  $("finishCount").textContent=`${count} / ${TOTAL} selesai`;$("finishPct").textContent=`${pct}%`;$("finishBar").style.width=`${pct}%`;
  $("missingChars").innerHTML="";missing.slice(0,42).forEach(ch=>{const s=document.createElement("span");s.textContent=ch;$("missingChars").appendChild(s)});if(missing.length>42){const s=document.createElement("span");s.textContent=`+${missing.length-42}`;$("missingChars").appendChild(s)}
  const complete=missing.length===0;$("missingBox").hidden=complete;$("confirmBox").hidden=!complete;$("confirmFontBtn").disabled=!complete;
  $("finishTitle").textContent=complete?"Semua karakter utama lengkap":"Font kamu hampir siap";$("finishDescription").textContent=complete?"Final check lolos. Kamu bisa menghasilkan font dan package web.":`Masih ada ${missing.length} karakter utama yang belum digambar.`;
}

function renderBrushMenu(){
  const menu=$("brushMenu");menu.innerHTML='<div class="brush-grid"></div>';const grid=menu.firstElementChild;
  Object.entries(BRUSHES).forEach(([id,b])=>{
    const opt=document.createElement("button");opt.className=`brush-option${state.brush===id?" active":""}`;opt.innerHTML=`<canvas width="90" height="48"></canvas><div><strong>${b.name}</strong><small>${b.desc}</small></div>`;
    opt.addEventListener("click",()=>{state.brush=id;applyBrushUI();renderBrushMenu();menu.hidden=true;saveState();});
    grid.appendChild(opt);const c=opt.querySelector("canvas"),x=c.getContext("2d");x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#111";x.lineCap="round";x.lineWidth=id==="marker"?13:id==="pencil"?4:id==="calligraphy"?9:7;x.beginPath();x.moveTo(8,30);x.bezierCurveTo(30,10,57,40,82,17);x.stroke();if(b.texture>.2){x.globalAlpha=.35;for(let i=0;i<10;i++){x.fillRect(10+i*7,18+(i%3)*3,2,2)}}
  });
}
function applyBrushUI(){const b=BRUSHES[state.brush]||BRUSHES.monoline;$("brushName").textContent=b.name;$("brushSwatch").style.height=`${Math.max(3,Math.min(11,state.brushSize/4))}px`;}

function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height,p:e.pressure&&e.pressure>0?e.pressure:.55,t:performance.now()};}
function startDraw(e){
  if(mode==="pan")return;if(e.pointerType==="mouse"&&e.button!==0)return;canvas.setPointerCapture?.(e.pointerId);isDrawing=true;const p=canvasPoint(e);
  if(mode==="pen"){currentStroke={brush:state.brush,size:Number($("brushSize").value),points:[p]};getCurrentStrokes().push(currentStroke)}else{eraseAt(p);eraseLast=p}drawCanvas();
}
function moveDraw(e){
  if(!isDrawing)return;const p=canvasPoint(e);if(mode==="pen"){const prev=currentStroke.points.at(-1);if(!prev||Math.hypot(p.x-prev.x,p.y-prev.y)>1.3)currentStroke.points.push(p)}else{eraseAlong(eraseLast,p);eraseLast=p}drawCanvas();
}
function endDraw(){if(!isDrawing)return;isDrawing=false;currentStroke=null;eraseLast=null;cleanupCurrent();saveState();renderGrid();updateEditor();schedulePreviewFont();}
function cleanupCurrent(){const vars=getVariants(activeChar);vars[activeVariant]=(vars[activeVariant]||[]).filter(s=>s.points?.length>1);}
function pointSegDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;if(!dx&&!dy)return Math.hypot(p.x-a.x,p.y-a.y);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))}
function eraseAt(p){const v=getVariants(activeChar);v[activeVariant]=getCurrentStrokes().filter(s=>!s.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<34))}
function eraseAlong(a,b){if(!a)return eraseAt(b);const v=getVariants(activeChar);v[activeVariant]=getCurrentStrokes().filter(s=>!s.points.some(q=>pointSegDist(q,a,b)<34))}
function undo(){const s=getCurrentStrokes();if(s.length){s.pop();saveState();renderGrid();updateEditor();drawCanvas();schedulePreviewFont();showToast("Undo")}}
function clearCurrent(){getVariants(activeChar)[activeVariant]=[];saveState();renderGrid();updateEditor();drawCanvas();schedulePreviewFont();showToast("Varian dikosongkan")}
function navigate(d){const i=ALL_CHARS.indexOf(activeChar),n=Math.max(0,Math.min(TOTAL-1,i+d));selectChar(ALL_CHARS[n])}
function setMode(m){mode=m;["pen","eraser","pan"].forEach(x=>$(`${x}Tool`).classList.toggle("active",m===x));canvas.style.cursor=m==="eraser"?"cell":m==="pan"?"grab":"crosshair";drawCanvas();}

function brushWidth(stroke,point,index){
  const b=BRUSHES[stroke.brush]||BRUSHES.monoline,pressure=point.p||.55,base=stroke.size||26;
  if(stroke.brush==="brush")return base*(b.min+(b.max-b.min)*pressure);
  if(stroke.brush==="pencil")return base*(.45+.45*pressure);
  if(stroke.brush==="fountain"||stroke.brush==="calligraphy"){
    const pts=stroke.points,prev=pts[Math.max(0,index-1)],next=pts[Math.min(pts.length-1,index+1)],ang=Math.atan2(next.y-prev.y,next.x-prev.x)*180/Math.PI;
    const factor=.68+.62*Math.abs(Math.sin((ang-b.angle)*Math.PI/180));return base*factor;
  }
  return base*(b.min+(b.max-b.min)*pressure);
}
function drawStrokeVisual(c,stroke,ink){
  const b=BRUSHES[stroke.brush]||BRUSHES.monoline,pts=stroke.points;if(pts.length<2)return;c.save();c.strokeStyle=ink;c.fillStyle=ink;c.lineJoin="round";c.lineCap=b.cap==="square"?"butt":"round";c.globalAlpha=b.opacity;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],p=pts[i],w=brushWidth(stroke,p,i);c.lineWidth=w;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(p.x,p.y);c.stroke();
    if(b.texture>.15){const seed=(i*9301+49297)%233280,noise=seed/233280;if(noise<b.texture){c.globalAlpha=b.opacity*.25;c.beginPath();c.arc(p.x+(noise-.5)*w,p.y+(0.5-noise)*w,Math.max(1,w*.12),0,Math.PI*2);c.fill();c.globalAlpha=b.opacity}}
  }c.restore();
}
function drawCanvas(){
  ctx.clearRect(0,0,720,720);const dark=document.documentElement.dataset.theme==="dark";ctx.save();ctx.setLineDash([8,8]);ctx.lineWidth=1.2;ctx.strokeStyle=dark?"rgba(139,126,241,.34)":"rgba(99,87,232,.24)";
  [144,360,576,648].forEach((y,i)=>{ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(686,y);ctx.stroke();ctx.fillStyle=dark?"rgba(180,174,244,.58)":"rgba(95,83,198,.55)";ctx.font="600 10px DM Sans";ctx.fillText(["CAP","MID","BASE","DESC"][i],39,y-6)});ctx.restore();
  const t=currentTemplate(),opacity=Number($("templateOpacity").value)/100;ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=dark?"#fff":"#15171b";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.font=`${t.weight} ${Math.round(470*t.scale)}px ${state.customTemplate?'"GlyphCraftCustomTemplate", sans-serif':t.font}`;ctx.fillText(activeChar,360,576);ctx.restore();
  const ink=dark?"#f5f6f8":"#17191d";getCurrentStrokes().forEach(s=>drawStrokeVisual(ctx,s,ink));
}
function simplifyRDP(points,eps=2.2){
  if(points.length<3)return points;let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=pointSegDist(points[i],points[0],points.at(-1));if(d>max){max=d;index=i}}
  if(max>eps){const a=simplifyRDP(points.slice(0,index+1),eps),b=simplifyRDP(points.slice(index),eps);return a.slice(0,-1).concat(b)}return[points[0],points.at(-1)];
}
function smoothPoints(points){
  if(points.length<4)return points;const out=[points[0]];for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1];out.push({x:(a.x+2*b.x+c.x)/4,y:(a.y+2*b.y+c.y)/4,p:(a.p+2*b.p+c.p)/4,t:b.t})}out.push(points.at(-1));return out;
}
function smartCleanup(){
  const strokes=getCurrentStrokes();if(!strokes.length)return showToast("Belum ada goresan");strokes.forEach(s=>{s.points=smoothPoints(simplifyRDP(s.points,2.1))});saveState();drawCanvas();schedulePreviewFont();renderAssistant();showToast("Goresan dirapikan");
}
function getBounds(strokes=getCurrentStrokes()){
  const pts=strokes.flatMap(s=>s.points||[]);if(!pts.length)return null;return{minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};
}
function analyzeStrokes(strokes=getCurrentStrokes()){
  const b=getBounds(strokes);if(!b)return null;const h=b.maxY-b.minY,w=b.maxX-b.minX,baselineDelta=Math.abs(b.maxY-576),heightDelta=Math.abs(h-432),centerDelta=Math.abs((b.minX+b.maxX)/2-360);
  const widths=strokes.flatMap(s=>s.points.map((p,i)=>brushWidth(s,p,i))),meanW=widths.reduce((a,b)=>a+b,0)/(widths.length||1),variance=widths.reduce((a,x)=>a+(x-meanW)**2,0)/(widths.length||1);
  const baseline=Math.max(0,100-baselineDelta*.8),proportion=Math.max(0,100-(heightDelta*.16+centerDelta*.08)),stroke=Math.max(0,100-Math.sqrt(variance)*2),score=Math.round(baseline*.36+proportion*.34+stroke*.3);
  return{b,h,w,baseline:Math.round(baseline),proportion:Math.round(proportion),stroke:Math.round(stroke),score,baselineDelta:Math.round(baselineDelta),centerDelta:Math.round(centerDelta),meanW:Math.round(meanW)};
}
function renderAssistant(){
  const a=analyzeStrokes();$("assistantTitle").textContent=`Analisis karakter ${activeChar} · V${activeVariant+1}`;const ring=$("assistantScore"),grid=$("assistantGrid"),list=$("assistantSuggestions");grid.innerHTML="";list.innerHTML="";
  if(!a){ring.style.setProperty("--score","0%");ring.dataset.value="--";$("assistantSummary").textContent="Belum cukup data";$("assistantSummaryText").textContent="Gambar karakter untuk memulai analisis.";return}
  ring.style.setProperty("--score",`${a.score}%`);ring.dataset.value=a.score;$("assistantSummary").textContent=a.score>85?"Sangat konsisten":a.score>70?"Sudah cukup konsisten":"Masih bisa dirapikan";$("assistantSummaryText").textContent=`Lebar ${Math.round(a.w)}px • tinggi ${Math.round(a.h)}px • stroke rata-rata ${a.meanW}px.`;
  [["Baseline",a.baseline,`${a.baselineDelta}px dari guide`],["Proporsi",a.proportion,`center Δ ${a.centerDelta}px`],["Stroke",a.stroke,`${a.meanW}px rata-rata`],["Score",a.score,"gabungan"]].forEach(([n,v,d])=>{const x=document.createElement("div");x.className="assistant-metric";x.innerHTML=`<span>${n}</span><strong>${v}</strong><small>${d}</small>`;grid.appendChild(x)});
  const tips=[];if(a.baseline<80)tips.push("Turunkan atau naikkan karakter agar ujung bawah lebih dekat BASE line.");if(a.proportion<80)tips.push("Periksa tinggi dan posisi horizontal agar proporsi lebih dekat template.");if(a.stroke<80)tips.push("Stroke cukup bervariasi; gunakan Cleanup atau brush yang lebih stabil.");if(a.score>85)tips.push("Karakter ini sudah konsisten. Pertahankan ritme pada karakter berikutnya.");tips.forEach(t=>{const li=document.createElement("li");li.textContent=t;list.appendChild(li)});
}
function normalizePosition(){
  const b=getBounds();if(!b)return;const dx=360-(b.minX+b.maxX)/2,dy=576-b.maxY;getCurrentStrokes().forEach(s=>s.points.forEach(p=>{p.x+=dx;p.y+=dy}));saveState();drawCanvas();renderAssistant();schedulePreviewFont();showToast("Posisi dinormalisasi");
}
function updateAssistantHint(){const a=analyzeStrokes();$("assistantHint").textContent=a?`Consistency ${a.score}/100`:"Mulai menggambar untuk analisis"}

function canvasToFontPoint(p){return{x:Math.round((p.x-55)*1.38),y:Math.round((576-p.y)*1.84)}}
function strokeOutline(stroke,weightScale=1){
  const pts=stroke.points;if(pts.length<2)return[];const left=[],right=[];
  for(let i=0;i<pts.length;i++){const p=pts[i],prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,r=brushWidth(stroke,p,i)*weightScale/2;left.push({x:p.x+nx*r,y:p.y+ny*r});right.push({x:p.x-nx*r,y:p.y-ny*r})}
  return [...left,...right.reverse()];
}
function addContour(path,contour){if(contour.length<3)return;const p=contour.map(canvasToFontPoint);path.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)path.lineTo(p[i].x,p[i].y);path.close()}
function glyphVariant(ch,index=0,weightScale=1){
  const strokes=(state.drawings[ch]||[])[index]||[],path=new opentype.Path();strokes.forEach(s=>addContour(path,strokeOutline(s,weightScale)));
  const pts=strokes.flatMap(s=>s.points),maxX=pts.length?Math.max(...pts.map(p=>p.x)):500,advanceWidth=Math.max(280,Math.min(1150,Math.round((maxX-42)*1.38+(Number($("letterSpacing").value)||70))));
  return new opentype.Glyph({name:`uni${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")}`,unicode:ch.codePointAt(0),advanceWidth,path});
}
function notdef(){const p=new opentype.Path();p.moveTo(70,0);p.lineTo(70,700);p.lineTo(560,700);p.lineTo(560,0);p.close();return new opentype.Glyph({name:".notdef",advanceWidth:630,path:p})}
function spaceGlyph(){return new opentype.Glyph({name:"space",unicode:32,advanceWidth:330,path:new opentype.Path()})}
async function buildFont(requireComplete=true,weightScale=1,variantIndex=0){
  await loadFontEngine();
  if(requireComplete&&doneCount()!==TOTAL)throw new Error("Karakter utama belum lengkap.");
  const glyphs=[notdef(),spaceGlyph(),...ALL_CHARS.map(ch=>{const vars=state.drawings[ch]||[];const use=(vars[variantIndex]&&hasArt(vars[variantIndex]))?variantIndex:0;return glyphVariant(ch,use,weightScale)})],family=$("fontName").value.trim()||"My Handwriting";
  const font=new opentype.Font({familyName:family,styleName:$("fontStyle").value||"Regular",unitsPerEm:1000,ascender:800,descender:-200,glyphs});
  try{
    font.kerningPairs={};Object.entries(state.kerning||{}).forEach(([pair,val])=>{const l=font.charToGlyph(pair[0]),r=font.charToGlyph(pair[1]);if(l&&r)font.kerningPairs[`${l.index},${r.index}`]=Number(val)||0});
  }catch{}
  return font;
}
function schedulePreviewFont(){clearTimeout(previewTimer);previewTimer=setTimeout(updateFontPreview,180)}
async function updateFontPreview(){
  try{
    const urls=[];
    for(let vi=0;vi<4;vi++){
      const font=await buildFont(false,1,vi),buf=font.toArrayBuffer(),url=URL.createObjectURL(new Blob([buf],{type:"font/otf"}));urls.push(url);
      const face=new FontFace(`GlyphCraftPreviewV${vi+1}`,`url(${url})`);await face.load();document.fonts.add(face);
    }
    if(previewObjectUrl){(Array.isArray(previewObjectUrl)?previewObjectUrl:[previewObjectUrl]).forEach(u=>URL.revokeObjectURL(u))}
    previewObjectUrl=urls;
    document.querySelectorAll(".sample-font,#miniPreview,#exportPreview").forEach(el=>el.style.fontFamily='"GlyphCraftPreviewV1", sans-serif');
    renderAlternatePreview();
  }catch(e){
    console.warn("Font preview engine unavailable:",e);
    const hint=$("assistantHint");if(hint&&!hasArt(getCurrentStrokes()))hint.textContent="Editor siap · preview font butuh koneksi";
  }
}
function renderAlternatePreview(){
  const box=$("bigPreview"),text=$("previewInput").value||"",random=$("randomAltToggle").checked;box.innerHTML="";
  [...text].forEach((ch,i)=>{const span=document.createElement("span");span.textContent=ch;let variants=(state.drawings[ch]||[]).filter(hasArt).length||1;let vi=random&&variants>1?((ch.codePointAt(0)*31+i*17)%variants):0;span.style.fontFamily=`"GlyphCraftPreviewV${Math.min(4,vi+1)}", sans-serif`;box.appendChild(span)});
}


function updateQualityMini(){
  const analyses=ALL_CHARS.filter(isDone).map(ch=>{const variants=state.drawings[ch]||[];const oldChar=activeChar,oldVar=activeVariant;let pts=variants[0]||[];return analyzeFor(pts)}).filter(Boolean);
  const cov=Math.round(doneCount()/TOTAL*100);if(!analyses.length){$("qualityScore").textContent="--";return}
  const avg=k=>Math.round(analyses.reduce((a,x)=>a+x[k],0)/analyses.length),baseline=avg("baseline"),prop=avg("proportion"),stroke=avg("stroke"),score=Math.round(baseline*.3+prop*.3+stroke*.2+cov*.2);
  $("qualityScore").textContent=score;$("metricList").innerHTML=`<div><span>Baseline</span><b>${baseline}</b></div><div><span>Proporsi</span><b>${prop}</b></div><div><span>Stroke</span><b>${stroke}</b></div><div><span>Coverage</span><b>${cov}%</b></div>`;
  updatePersonality(analyses);
}
function analyzeFor(strokes){
  const pts=strokes.flatMap(s=>s.points||[]);if(!pts.length)return null;const b={minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))},h=b.maxY-b.minY,w=b.maxX-b.minX,baselineDelta=Math.abs(b.maxY-576),heightDelta=Math.abs(h-432),centerDelta=Math.abs((b.minX+b.maxX)/2-360);
  const widths=strokes.flatMap(s=>s.points.map((p,i)=>brushWidth(s,p,i))),meanW=widths.reduce((a,b)=>a+b,0)/(widths.length||1),variance=widths.reduce((a,x)=>a+(x-meanW)**2,0)/(widths.length||1);
  return{baseline:Math.round(Math.max(0,100-baselineDelta*.8)),proportion:Math.round(Math.max(0,100-(heightDelta*.16+centerDelta*.08))),stroke:Math.round(Math.max(0,100-Math.sqrt(variance)*2)),width:w,height:h,meanW};
}
function updatePersonality(a){
  const avg=k=>a.reduce((s,x)=>s+x[k],0)/a.length,ratio=avg("width")/Math.max(1,avg("height")),w=avg("meanW"),tags=[];const t=currentTemplate();
  tags.push(ratio<.58?"Condensed":ratio>.9?"Wide":"Balanced");tags.push(w>34?"Bold":w<18?"Fine":"Medium");if(["retro","display"].includes(t.cat))tags.push("Display");if(t.cat==="hand")tags.push("Casual");if((state.drawings["a"]||[]).length>1)tags.push("Organic");
  $("personalityTags").innerHTML=tags.map(x=>`<span>${x}</span>`).join("");$("personalityText").textContent=tags.join(" · ");
}

function renderKerning(){const pair=$("kernPairSelect").value,val=state.kerning[pair]??0;$("kernLeft").textContent=pair[0];$("kernRight").textContent=pair[1];$("kernRight").style.marginLeft=`${val}px`;$("kernSlider").value=val;$("kernValue").textContent=val}
function renderLigatures(){const box=$("ligaturePresets");box.innerHTML="";["th","st","fi","fl","ll","ing","tt","oo"].forEach(x=>{const b=document.createElement("button");b.textContent=x;b.className=state.ligatures.includes(x)?"active":"";b.addEventListener("click",()=>{$("ligatureInput").value=x;$("ligaturePreview").textContent=x});box.appendChild(b)})}
function saveLigature(){const x=$("ligatureInput").value.trim();if(x.length<2)return showToast("Ligature minimal 2 karakter");if(!state.ligatures.includes(x))state.ligatures.push(x);saveState();renderLigatures();showToast("Kombinasi ligature disimpan")}

function drawSignature(){
  sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);const ink=document.documentElement.dataset.theme==="dark"?"#f5f6f8":"#17191d";sigCtx.strokeStyle=ink;sigCtx.lineCap="round";sigCtx.lineJoin="round";sigStrokes.forEach(s=>{if(s.length<2)return;sigCtx.lineWidth=s[0].w;sigCtx.beginPath();sigCtx.moveTo(s[0].x,s[0].y);for(const p of s.slice(1))sigCtx.lineTo(p.x,p.y);sigCtx.stroke()});
}
function sigPoint(e){const r=sigCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*sigCanvas.width/r.width,y:(e.clientY-r.top)*sigCanvas.height/r.height,w:Number($("signatureSize").value)}}
function signatureSvg(){
  const paths=sigStrokes.filter(s=>s.length>1).map(s=>`<path d="M ${s.map((p,i)=>`${i?"L":""} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="#111" stroke-width="${s[0].w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 330">${paths}</svg>`;
}

function snapshot(){
  const snap={id:Date.now(),name:`Snapshot ${new Date().toLocaleString()}`,state:JSON.parse(JSON.stringify(state))};state.snapshots=(state.snapshots||[]).slice(-4);state.snapshots.push(snap);saveState();showToast("Snapshot dibuat");renderProjects();
}
function exportProject(){saveState();downloadBlob(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),`${slugify(state.fontName)}-project.json`)}
function importProjectFile(file){const r=new FileReader();r.onload=()=>{try{state=normalizeState(JSON.parse(r.result));activeGroup=state.activeGroup;activeChar=state.activeChar;activeVariant=state.activeVariant||0;hydrateUI();showToast("Project berhasil diimport")}catch{showToast("File project tidak valid")}};r.readAsText(file)}
function saveProjectIndex(){
  const list=JSON.parse(storageGet(PROJECTS_KEY,"[]")||"[]"),payload={id:state.projectId,name:state.fontName,updated:Date.now(),state:JSON.parse(JSON.stringify(state))};const i=list.findIndex(x=>x.id===payload.id);if(i>=0)list[i]=payload;else list.unshift(payload);storageSet(PROJECTS_KEY,JSON.stringify(list.slice(0,8)));
}
function renderProjects(){
  saveProjectIndex();const list=JSON.parse(storageGet(PROJECTS_KEY,"[]")||"[]"),box=$("projectList");box.innerHTML="";
  list.forEach(p=>{const row=document.createElement("div");row.className="project-row";row.innerHTML=`<div><strong>${p.name}</strong><small>${new Date(p.updated).toLocaleString()} · ${p.id===state.projectId?"aktif":"lokal"}</small></div><span class="project-row-actions"><button data-load>Load</button><button data-delete>Delete</button></span>`;row.querySelector("[data-load]").onclick=()=>{state=normalizeState(p.state);activeGroup=state.activeGroup;activeChar=state.activeChar;activeVariant=state.activeVariant||0;hydrateUI();closeModal("projectsModal");showToast("Project dimuat")};row.querySelector("[data-delete]").onclick=()=>{const next=list.filter(x=>x.id!==p.id);storageSet(PROJECTS_KEY,JSON.stringify(next));renderProjects()};box.appendChild(row)});
  (state.snapshots||[]).slice().reverse().forEach(s=>{const row=document.createElement("div");row.className="project-row";row.innerHTML=`<div><strong>${s.name}</strong><small>Snapshot project aktif</small></div><span class="project-row-actions"><button data-restore>Restore</button></span>`;row.querySelector("[data-restore]").onclick=()=>{state=normalizeState(s.state);activeGroup=state.activeGroup;activeChar=state.activeChar;activeVariant=state.activeVariant||0;hydrateUI();closeModal("projectsModal");showToast("Snapshot dipulihkan")};box.appendChild(row)})
}
function newProject(){if(!confirm("Buat project baru? Project saat ini akan tetap tersimpan lokal."))return;saveProjectIndex();state=defaultState();activeGroup="upper";activeChar="A";activeVariant=0;hydrateUI();showToast("Project baru dibuat")}

function printTemplate(){
  const cells=ALL_CHARS.map((ch,i)=>`<div class="cell"><span>${ch}</span><small>${i+1}</small></div>`).join("");const w=open("","_blank");w.document.write(`<html><head><title>GlyphCraft Print Template</title><style>@page{size:A4;margin:10mm}body{font-family:Arial;margin:0}.head{display:flex;justify-content:space-between;margin-bottom:8mm}.grid{display:grid;grid-template-columns:repeat(9,1fr);border-left:1px solid #aaa;border-top:1px solid #aaa}.cell{height:25mm;border-right:1px solid #aaa;border-bottom:1px solid #aaa;position:relative}.cell span{position:absolute;left:3mm;top:2mm;color:#bbb;font-size:10pt}.cell small{position:absolute;right:2mm;bottom:2mm;color:#bbb}p{font-size:9pt;color:#555}</style></head><body><div class="head"><div><h2>GlyphCraft Studio — Scan Sheet</h2><p>Tulis setiap karakter di dalam kotak. Jaga foto tetap lurus saat di-scan.</p></div><b>${state.fontName}</b></div><div class="grid">${cells}</div><script>setTimeout(()=>print(),400)<\/script></body></html>`);w.document.close();
}
function loadScanImage(file){const img=new Image();img.onload=()=>{scanImage=img;$("scanPreviewWrap").hidden=false;drawScanPreview()};img.src=URL.createObjectURL(file)}
function drawScanPreview(){if(!scanImage)return;scanCtx.fillStyle="#fff";scanCtx.fillRect(0,0,900,620);const scale=Math.min(900/scanImage.width,620/scanImage.height),w=scanImage.width*scale,h=scanImage.height*scale;scanCtx.drawImage(scanImage,(900-w)/2,(620-h)/2,w,h)}
function importScanDraft(){
  if(!scanImage)return;const off=document.createElement("canvas"),cols=9,rows=Math.ceil(TOTAL/cols);off.width=cols*72;off.height=rows*72;const o=off.getContext("2d");o.drawImage(scanImage,0,0,off.width,off.height);const th=Number($("scanThreshold").value),data=o.getImageData(0,0,off.width,off.height);
  for(let idx=0;idx<TOTAL;idx++){const ch=ALL_CHARS[idx],cx=(idx%cols)*72,cy=Math.floor(idx/cols)*72,strokes=[];for(let y=4;y<68;y+=4){let run=null;for(let x=4;x<68;x+=4){const px=(cy+y)*off.width+(cx+x),i=px*4,gray=(data.data[i]+data.data[i+1]+data.data[i+2])/3;if(gray<th&&run===null)run=x;if((gray>=th||x>=64)&&run!==null){const end=x;strokes.push({brush:"marker",size:5,points:[{x:90+run*7.4,y:90+y*7.2,p:.5},{x:90+end*7.4,y:90+y*7.2,p:.5}]});run=null}}}if(strokes.length)state.drawings[ch]=[strokes]}
  saveState();renderGrid();updateEditor();drawCanvas();schedulePreviewFont();closeModal("scanModal");showToast("Draft scan diimport");
}

async function prepareExport(weightScale=1){
  $("confirmFontBtn").disabled=true;$("confirmFontBtn").textContent="Membuat…";
  try{
    const font=await buildFont(true,weightScale),otf=font.toArrayBuffer();let ttf=null,woff=null,woff2=null;
    try{const f=createFont(otf,{type:"otf",compound2simple:true});ttf=f.write({type:"ttf",hinting:false});try{woff=f.write({type:"woff",hinting:false})}catch{}try{woff2=f.write({type:"woff2",hinting:false})}catch{}}catch(e){console.warn("conversion",e)}
    generated={font,otf,ttf,woff,woff2};$("exportTitle").textContent=`${state.fontName} siap dipakai`;$("exportStatus").textContent=`✓ ${["OTF",ttf&&"TTF",woff&&"WOFF",woff2&&"WOFF2"].filter(Boolean).join(" · ")} siap`;
    $("downloadTtf").disabled=!ttf;$("downloadWoff").disabled=!woff;closeModal("finishModal");openModal("exportModal");schedulePreviewFont();
  }catch(e){console.error(e);showToast(e?.message?.includes("fetch")||e?.message?.includes("module")?"Font engine gagal dimuat. Cek koneksi internet lalu coba lagi.":(e.message||"Gagal membuat font"))}finally{$("confirmFontBtn").disabled=doneCount()!==TOTAL;$("confirmFontBtn").textContent="Buat font"}
}
function downloadBuffer(buf,ext,mime){if(!buf)return showToast(`${ext.toUpperCase()} belum tersedia`);downloadBlob(new Blob([buf],{type:mime}),`${slugify(state.fontName)}.${ext}`)}
function toBase64(buffer){let binary="",bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
async function downloadWebBundle(){
  await loadFontEngine();
  if(!generated.otf)await prepareExport();
  if(!generated.otf)return;
  const zip=new JSZip(),slug=slugify(state.fontName),family=state.fontName.replace(/"/g,"");
  zip.file(`${slug}.otf`,generated.otf);if(generated.ttf)zip.file(`${slug}.ttf`,generated.ttf);if(generated.woff)zip.file(`${slug}.woff`,generated.woff);if(generated.woff2)zip.file(`${slug}.woff2`,generated.woff2);
  const src=generated.woff2?`url("./${slug}.woff2") format("woff2")`:generated.woff?`url("./${slug}.woff") format("woff")`:`url("./${slug}.otf") format("opentype")`;
  zip.file("font.css",`@font-face{font-family:"${family}";src:${src};font-weight:400;font-style:normal;font-display:swap;}\n.font-${slug}{font-family:"${family}",sans-serif;}`);
  zip.file("README.txt",`GlyphCraft Studio webfont bundle\nFont: ${family}\nGenerated locally in the browser.\n`);
  zip.file("demo.html",`<!doctype html><link rel="stylesheet" href="font.css"><style>body{font-family:system-ui;padding:40px}.demo{font-family:"${family}";font-size:64px}</style><h1>${family}</h1><p class="demo">The quick brown fox 123!</p>`);
  downloadBlob(await zip.generateAsync({type:"blob"}),`${slug}-webfont.zip`);
}
function downloadShowcase(){
  if(!generated.otf)return showToast("Buat font dulu");const b64=toBase64(generated.otf),family=state.fontName.replace(/"/g,""),html=`<!doctype html><html><meta charset="utf-8"><title>${family} Showcase</title><style>@font-face{font-family:"Demo";src:url(data:font/otf;base64,${b64})}body{margin:0;padding:7vw;background:#f5f1ea;color:#191919;font-family:system-ui}.hero{font-family:Demo;font-size:clamp(64px,12vw,180px);line-height:.9}.meta{margin-top:40px;opacity:.6}.sample{font-family:Demo;font-size:48px;margin-top:80px}</style><div class="hero">${family}</div><div class="meta">Made with GlyphCraft Studio</div><div class="sample">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789</div></html>`;downloadBlob(new Blob([html],{type:"text/html"}),`${slugify(state.fontName)}-showcase.html`);
}

function hydrateUI(){
  setTheme(state.theme,false);$("fontName").value=state.fontName;$("fontStyle").value=state.fontStyle;$("letterSpacing").value=state.spacing;$("templateOpacity").value=state.templateOpacity;$("templateOpacityValue").textContent=`${state.templateOpacity}%`;$("brushSize").value=state.brushSize;$("brushSizeValue").textContent=state.brushSize;$("snapToggle").checked=state.snap;
  applyBrushUI();applyTemplateUI();renderBrushMenu();renderGrid();renderVariants();updateEditor();drawCanvas();renderKerning();renderLigatures();updateQualityMini();schedulePreviewFont();saveState();
}
function closeMobilePanels(){
  if(innerWidth<=820){
    $("sidebar")?.classList.remove("open");
    $("properties")?.classList.remove("open");
    if($("scrim")) $("scrim").hidden=true;
  }
}

function bind(){
  canvas.addEventListener("pointerdown",startDraw);canvas.addEventListener("pointermove",moveDraw);canvas.addEventListener("pointerup",endDraw);canvas.addEventListener("pointercancel",endDraw);
  $("charTabs").addEventListener("click",e=>{const b=e.target.closest("button[data-group]");if(!b)return;activeGroup=b.dataset.group;if(!SETS[activeGroup].includes(activeChar)){activeChar=SETS[activeGroup][0];activeVariant=0}renderGrid();updateEditor();drawCanvas();saveState()});
  $("addVariantBtn").onclick=addVariant;$("brushMenuBtn").onclick=()=>{$("brushMenu").hidden=!$("brushMenu").hidden};document.addEventListener("click",e=>{if(!$("brushMenu").contains(e.target)&&!$("brushMenuBtn").contains(e.target))$("brushMenu").hidden=true});
  $("brushSize").oninput=()=>{$("brushSizeValue").textContent=$("brushSize").value;state.brushSize=Number($("brushSize").value);applyBrushUI();saveState()};$("templateOpacity").oninput=()=>{$("templateOpacityValue").textContent=`${$("templateOpacity").value}%`;saveState();drawCanvas()};
  $("undoBtn").onclick=undo;$("clearBtn").onclick=clearCurrent;$("cleanupBtn").onclick=smartCleanup;$("prevBtn").onclick=()=>navigate(-1);$("nextBtn").onclick=()=>navigate(1);$("penTool").onclick=()=>setMode("pen");$("eraserTool").onclick=()=>setMode("eraser");$("panTool").onclick=()=>setMode("pan");
  [$("fontName"),$("fontStyle"),$("letterSpacing")].forEach(el=>el.addEventListener("input",()=>{saveState();schedulePreviewFont()}));$("snapToggle").onchange=saveState;$("themeToggle").onclick=()=>setTheme(state.theme==="dark"?"light":"dark");
  [$("templateBtn"),$("templateSideBtn")].forEach(b=>b.onclick=()=>{renderTemplateLibrary();closeMobilePanels();openModal("templateModal")});document.querySelectorAll("[data-template-filter]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-template-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderTemplateLibrary(b.dataset.templateFilter)});
  $("customTemplateFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;const buf=await f.arrayBuffer(),face=new FontFace("GlyphCraftCustomTemplate",buf);await face.load();document.fonts.add(face);customTemplateFace=face;state.customTemplate=f.name;saveState();drawCanvas();showToast("Custom template aktif")};
  [$("assistantBtn"),$("analyzeBtn")].forEach(b=>b.onclick=()=>{renderAssistant();closeMobilePanels();openModal("assistantModal")});$("smartCleanupBtn").onclick=smartCleanup;$("normalizeBtn").onclick=normalizePosition;
  [$("previewTopBtn"),$("openPreviewBtn"),$("bottomPreview")].forEach(b=>b&&(b.onclick=()=>{closeMobilePanels();openModal("previewModal")}));$("previewInput").oninput=renderAlternatePreview;$("randomAltToggle").onchange=renderAlternatePreview;$("previewSize").oninput=()=>{$("bigPreview").style.fontSize=`${$("previewSize").value}px`};
  $("contextTabs").onclick=e=>{const b=e.target.closest("button[data-context]");if(!b)return;[...$("contextTabs").children].forEach(x=>x.classList.remove("active"));b.classList.add("active");$("contextPreview").className=`context-preview ${b.dataset.context}`;const data={poster:["NEW COLLECTION","Make it yours.","Handmade type • 2026"],chat:["ONLINE","Hey, ini font buatan aku 👋","baru aja selesai!"],brand:["STUDIO","Own your letters.","Identity system"],note:["TODAY","Remember this.","small things matter"],story:["YOUR STORY","Write it loud.","@glyphcraft"]}[b.dataset.context];$("contextPreview").innerHTML=`<span class="context-kicker">${data[0]}</span><strong class="sample-font">${data[1]}</strong><small>${data[2]}</small>`};
  $("kerningBtn").onclick=()=>{renderKerning();closeMobilePanels();openModal("kerningModal")};$("kernPairSelect").onchange=renderKerning;$("kernSlider").oninput=()=>{const p=$("kernPairSelect").value,v=Number($("kernSlider").value);state.kerning[p]=v;$("kernValue").textContent=v;$("kernRight").style.marginLeft=`${v}px`;saveState()};
  $("ligatureBtn").onclick=()=>{renderLigatures();closeMobilePanels();openModal("ligatureModal")};$("ligatureInput").oninput=()=>{$("ligaturePreview").textContent=$("ligatureInput").value||"th"};$("saveLigatureBtn").onclick=saveLigature;
  $("signatureBtn").onclick=()=>{drawSignature();closeMobilePanels();openModal("signatureModal")};sigCanvas.addEventListener("pointerdown",e=>{sigDrawing=true;sigCanvas.setPointerCapture?.(e.pointerId);sigStroke=[sigPoint(e)];sigStrokes.push(sigStroke)});sigCanvas.addEventListener("pointermove",e=>{if(!sigDrawing)return;sigStroke.push(sigPoint(e));drawSignature()});sigCanvas.addEventListener("pointerup",()=>sigDrawing=false);$("signatureClear").onclick=()=>{sigStrokes=[];drawSignature()};$("downloadSignaturePng").onclick=()=>sigCanvas.toBlob(b=>downloadBlob(b,`${slugify(state.fontName)}-signature.png`));$("downloadSignatureSvg").onclick=()=>downloadBlob(new Blob([signatureSvg()],{type:"image/svg+xml"}),`${slugify(state.fontName)}-signature.svg`);
  $("snapshotBtn").onclick=snapshot;$("exportProjectBtn").onclick=exportProject;$("importProjectBtn").onclick=()=>$("projectFileInput").click();$("projectFileInput").onchange=e=>e.target.files[0]&&importProjectFile(e.target.files[0]);[$("projectsBtn")].forEach(b=>b&&(b.onclick=()=>{renderProjects();closeMobilePanels();openModal("projectsModal")}));$("newProjectBtn").onclick=newProject;
  $("scanBtn").onclick=()=>{closeMobilePanels();openModal("scanModal")};$("printTemplateBtn").onclick=printTemplate;$("scanFile").onchange=e=>e.target.files[0]&&loadScanImage(e.target.files[0]);$("scanThreshold").oninput=drawScanPreview;$("scanImportBtn").onclick=importScanDraft;
  [$("finishTopBtn"),$("bottomFinish")].forEach(b=>b&&(b.onclick=()=>{closeMobilePanels();openModal("finishModal")}));$("confirmFontBtn").onclick=()=>prepareExport(1);$("downloadOtf").onclick=()=>downloadBuffer(generated.otf,"otf","font/otf");$("downloadTtf").onclick=()=>downloadBuffer(generated.ttf,"ttf","font/ttf");$("downloadWoff").onclick=()=>downloadBuffer(generated.woff,"woff","font/woff");$("downloadBundle").onclick=downloadWebBundle;$("downloadShowcase").onclick=downloadShowcase;$("weightSlider").oninput=()=>{$("weightValue").textContent=`${$("weightSlider").value}%`};$("downloadWeight").onclick=async()=>{const scale=Number($("weightSlider").value)/100,font=await buildFont(true,scale),buf=font.toArrayBuffer();downloadBuffer(buf,`weight-${$("weightSlider").value}.otf`,"font/otf")};
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  const closeMobileDrawers=()=>{$("sidebar").classList.remove("open");$("properties").classList.remove("open");$("scrim").hidden=true};
  const openChars=()=>{$("properties").classList.remove("open");$("sidebar").classList.add("open");$("scrim").hidden=false};
  const openProperties=()=>{$("sidebar").classList.remove("open");$("properties").classList.add("open");$("scrim").hidden=false};
  $("openCharsBtn").onclick=openChars;$("bottomChars").onclick=openChars;$("sidebarClose").onclick=closeMobileDrawers;
  $("mobileToolsBtn").onclick=openProperties;$("bottomPanel").onclick=openProperties;$("propertiesClose").onclick=closeMobileDrawers;
  $("scrim").onclick=closeMobileDrawers;
  window.addEventListener("keydown",e=>{if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}else if(e.key==="ArrowRight")navigate(1);else if(e.key==="ArrowLeft")navigate(-1)});
}
bind();hydrateUI();
