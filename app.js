import * as opentype from "https://cdn.jsdelivr.net/npm/opentype.js@2.0.0/+esm";
import { createFont } from "https://esm.sh/fonteditor-core@2.6.3?bundle";

const SETS = {
  upper: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  lower: [..."abcdefghijklmnopqrstuvwxyz"],
  numbers: [..."0123456789"],
  symbols: [...".,!?;:'\"-–_()[]{}@#$%&+/="]
};
const GROUP_NAMES = { upper: "Huruf Kapital", lower: "Huruf Kecil", numbers: "Angka", symbols: "Simbol & Tanda Baca" };
const ALL_CHARS = Object.values(SETS).flat();
const TOTAL = ALL_CHARS.length;
const STORAGE_KEY = "glyphcraft-project-v1";

const $ = (id) => document.getElementById(id);
const canvas = $("drawCanvas");
const ctx = canvas.getContext("2d");
const els = Object.fromEntries([
  "charGrid","charTabs","progressText","progressPercent","progressBar","charTitle","groupEyebrow","saveStatus",
  "brushSize","brushSizeValue","templateOpacity","templateOpacityValue","prevBtn","nextBtn","undoBtn","clearBtn",
  "fontName","fontStyle","letterSpacing","miniPreview","checkGlyphs","remainingText","previewModal","previewInput",
  "previewSize","bigPreview","finishModal","finishClose","finishTitle","finishDescription","finishCount","finishPct",
  "finishBar","missingBox","missingChars","confirmBox","confirmFontBtn","backToEditor","exportModal","exportClose",
  "exportTitle","downloadOtf","downloadTtf","exportPreview","exportStatus","continueEditing","themeToggle","toast",
  "sidebar","sidebarClose","scrim","openCharsBtn","mobileCharLabel","penTool","eraserTool"
].map(id => [id, $(id)]));

let state = loadState();
let activeGroup = state.activeGroup || "upper";
let activeChar = state.activeChar && ALL_CHARS.includes(state.activeChar) ? state.activeChar : "A";
let mode = "pen";
let isDrawing = false;
let currentStroke = null;
let eraseLast = null;
let generated = { font: null, otf: null, ttf: null, url: null };
let previewObjectUrl = null;
let toastTimer;

function defaultState(){
  return {
    activeGroup:"upper", activeChar:"A", theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    fontName:"My Handwriting", fontStyle:"Regular", spacing:70, templateOpacity:22, brushSize:28, drawings:{}
  };
}
function loadState(){
  try{
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState(), ...parsed, drawings: parsed?.drawings || {} };
  }catch{ return defaultState(); }
}
function saveState(){
  state.activeGroup = activeGroup; state.activeChar = activeChar;
  state.fontName = els.fontName.value.trim() || "My Handwriting";
  state.fontStyle = els.fontStyle.value; state.spacing = Number(els.letterSpacing.value) || 70;
  state.templateOpacity = Number(els.templateOpacity.value); state.brushSize = Number(els.brushSize.value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function isDone(ch){ return Array.isArray(state.drawings[ch]) && state.drawings[ch].some(s => s.points?.length > 1); }
function doneCount(){ return ALL_CHARS.filter(isDone).length; }
function slugify(text){ return (text || "my-handwriting").normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase() || "my-handwriting"; }
function showToast(message){
  clearTimeout(toastTimer); els.toast.textContent = message; els.toast.classList.add("show");
  toastTimer = setTimeout(()=>els.toast.classList.remove("show"), 1800);
}

function setTheme(theme){
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#111318" : "#f5f6f8";
  saveState(); drawCanvas();
}
function renderGrid(){
  [...els.charTabs.querySelectorAll("button")].forEach(b => b.classList.toggle("active", b.dataset.group === activeGroup));
  els.charGrid.innerHTML = "";
  for(const ch of SETS[activeGroup]){
    const b = document.createElement("button");
    b.type = "button"; b.className = "char-btn";
    if(ch === activeChar) b.classList.add("active");
    if(isDone(ch)) b.classList.add("done");
    b.textContent = ch === " " ? "␠" : ch; b.title = `Gambar ${ch}`;
    b.addEventListener("click",()=>selectChar(ch));
    els.charGrid.appendChild(b);
  }
}
function selectChar(ch){
  if(!ALL_CHARS.includes(ch)) return;
  activeChar = ch;
  activeGroup = Object.keys(SETS).find(k => SETS[k].includes(ch)) || activeGroup;
  renderGrid(); updateEditor(); saveState(); drawCanvas();
}
function updateEditor(){
  els.charTitle.textContent = activeChar;
  els.mobileCharLabel.textContent = `${GROUP_NAMES[activeGroup]} · ${activeChar}`;
  els.groupEyebrow.textContent = GROUP_NAMES[activeGroup];
  const done = isDone(activeChar);
  els.saveStatus.classList.toggle("saved", done);
  els.saveStatus.innerHTML = `<span></span>${done ? "Tersimpan otomatis" : "Belum digambar"}`;
  updateProgress();
}
function updateProgress(){
  const count = doneCount(), pct = Math.round(count / TOTAL * 100), remaining = TOTAL-count;
  els.progressText.textContent = `${count} / ${TOTAL} karakter`;
  els.progressPercent.textContent = `${pct}%`; els.progressBar.style.width = `${pct}%`;
  els.remainingText.textContent = remaining ? `${remaining} karakter tersisa` : "Semua karakter lengkap";
  els.checkGlyphs.classList.toggle("done", remaining === 0);
  els.checkGlyphs.querySelector("span").textContent = remaining === 0 ? "✓" : "○";
  updateFinishModal();
}
function updateFinishModal(){
  const count = doneCount(), pct = Math.round(count/TOTAL*100);
  els.finishCount.textContent = `${count} / ${TOTAL} selesai`; els.finishPct.textContent = `${pct}%`; els.finishBar.style.width = `${pct}%`;
  const missing = ALL_CHARS.filter(ch=>!isDone(ch));
  els.missingChars.innerHTML = "";
  missing.slice(0,36).forEach(ch=>{ const s=document.createElement("span"); s.textContent=ch; els.missingChars.appendChild(s); });
  if(missing.length>36){ const s=document.createElement("span"); s.textContent=`+${missing.length-36}`; els.missingChars.appendChild(s); }
  const complete = missing.length === 0;
  els.missingBox.hidden = complete; els.confirmBox.hidden = !complete; els.confirmFontBtn.disabled = !complete;
  els.finishTitle.textContent = complete ? "Semua karakter sudah lengkap" : "Font kamu hampir siap";
  els.finishDescription.textContent = complete ? "Mantap. Konfirmasi di bawah untuk membuat font dari seluruh goresanmu." : `Masih ada ${missing.length} karakter yang perlu digambar sebelum font dibuat.`;
}

function getCanvasPoint(e){
  const r = canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) };
}
function startDraw(e){
  if(e.pointerType === "mouse" && e.button !== 0) return;
  canvas.setPointerCapture?.(e.pointerId);
  const p=getCanvasPoint(e); isDrawing=true;
  if(mode==="pen"){
    currentStroke={ width:Number(els.brushSize.value), points:[p] };
    state.drawings[activeChar] ||= []; state.drawings[activeChar].push(currentStroke);
  }else{ eraseAt(p); eraseLast=p; }
  drawCanvas();
}
function moveDraw(e){
  if(!isDrawing) return;
  const p=getCanvasPoint(e);
  if(mode==="pen"){
    const prev=currentStroke.points.at(-1);
    if(!prev || Math.hypot(p.x-prev.x,p.y-prev.y)>1.8) currentStroke.points.push(p);
  }else{
    eraseAlong(eraseLast,p); eraseLast=p;
  }
  drawCanvas();
}
function endDraw(e){
  if(!isDrawing) return;
  isDrawing=false; currentStroke=null; eraseLast=null;
  cleanupDrawing(activeChar); saveState(); renderGrid(); updateEditor(); schedulePreviewFont();
}
function cleanupDrawing(ch){
  if(!state.drawings[ch]) return;
  state.drawings[ch] = state.drawings[ch].filter(s=>s.points?.length>1);
  if(state.drawings[ch].length===0) delete state.drawings[ch];
}
function pointSegmentDistance(p,a,b){
  const dx=b.x-a.x, dy=b.y-a.y;
  if(dx===0 && dy===0) return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function eraseAt(p){
  const radius=36, strokes=state.drawings[activeChar]||[];
  state.drawings[activeChar]=strokes.filter(stroke=>!stroke.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<radius));
  cleanupDrawing(activeChar);
}
function eraseAlong(a,b){
  if(!a) return eraseAt(b);
  const radius=36, strokes=state.drawings[activeChar]||[];
  state.drawings[activeChar]=strokes.filter(stroke=>!stroke.points.some(q=>pointSegmentDistance(q,a,b)<radius));
  cleanupDrawing(activeChar);
}
function undo(){
  const strokes=state.drawings[activeChar];
  if(strokes?.length){ strokes.pop(); cleanupDrawing(activeChar); saveState(); renderGrid(); updateEditor(); drawCanvas(); schedulePreviewFont(); showToast("Goresan terakhir di-undo"); }
}
function clearCurrent(){
  if(state.drawings[activeChar]){ delete state.drawings[activeChar]; saveState(); renderGrid(); updateEditor(); drawCanvas(); schedulePreviewFont(); showToast(`Karakter ${activeChar} dihapus`); }
}
function navigate(delta){
  const i=ALL_CHARS.indexOf(activeChar), ni=Math.max(0,Math.min(ALL_CHARS.length-1,i+delta));
  selectChar(ALL_CHARS[ni]);
}
function drawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const dark=document.documentElement.dataset.theme==="dark";
  // Horizontal font guides.
  ctx.save();
  ctx.setLineDash([8,8]); ctx.lineWidth=1.2;
  const guideColor=dark ? "rgba(138,125,241,.34)" : "rgba(99,87,232,.25)";
  ctx.strokeStyle=guideColor;
  [144,360,576,648].forEach((y,i)=>{
    ctx.beginPath(); ctx.moveTo(34,y); ctx.lineTo(686,y); ctx.stroke();
    ctx.fillStyle=dark ? "rgba(180,174,244,.58)" : "rgba(95,83,198,.55)";
    ctx.font="600 10px DM Sans"; ctx.fillText(["CAP","MID","BASE","DESC"][i],39,y-6);
  });
  ctx.restore();

  // Transparent letter template.
  const opacity=Number(els.templateOpacity.value)/100;
  ctx.save(); ctx.globalAlpha=opacity;
  ctx.fillStyle=dark ? "#ffffff" : "#111318";
  const templateSize = activeGroup === "symbols" ? 390 : 480;
  ctx.font=`700 ${templateSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="alphabetic";
  ctx.fillText(activeChar,360,576);
  ctx.restore();

  // User strokes.
  const ink=dark ? "#f6f7f9" : "#17191d";
  ctx.strokeStyle=ink; ctx.fillStyle=ink; ctx.lineCap="round"; ctx.lineJoin="round";
  for(const stroke of state.drawings[activeChar]||[]){
    if(stroke.points.length<2) continue;
    ctx.lineWidth=stroke.width;
    ctx.beginPath(); ctx.moveTo(stroke.points[0].x,stroke.points[0].y);
    if(stroke.points.length===2){ ctx.lineTo(stroke.points[1].x,stroke.points[1].y); }
    else{
      for(let i=1;i<stroke.points.length-1;i++){
        const p=stroke.points[i], n=stroke.points[i+1];
        ctx.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2);
      }
      const last=stroke.points.at(-1); ctx.lineTo(last.x,last.y);
    }
    ctx.stroke();
  }
  if(mode==="eraser" && isDrawing && eraseLast){
    ctx.save(); ctx.strokeStyle=dark?"rgba(255,116,116,.7)":"rgba(216,80,80,.65)";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(eraseLast.x,eraseLast.y,36,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
}

function strokeToContours(stroke){
  const pts=stroke.points, r=stroke.width/2, contours=[];
  if(pts.length<2) return contours;
  // Build one continuous outline around the sampled centerline.
  const left=[], right=[];
  for(let i=0;i<pts.length;i++){
    const p=pts[i], prev=pts[Math.max(0,i-1)], next=pts[Math.min(pts.length-1,i+1)];
    let dx=next.x-prev.x, dy=next.y-prev.y, len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    left.push({x:p.x+nx*r,y:p.y+ny*r});
    right.push({x:p.x-nx*r,y:p.y-ny*r});
  }
  const outline=[...left,...right.reverse()];
  contours.push(outline);
  // Round caps as extra contours.
  for(const endpoint of [pts[0],pts.at(-1)]){
    const circle=[];
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; circle.push({x:endpoint.x+Math.cos(a)*r,y:endpoint.y+Math.sin(a)*r}); }
    contours.push(circle);
  }
  return contours;
}
function canvasToFontPoint(p){
  const xScale=1.38, yScale=1.84;
  return { x:Math.round((p.x-55)*xScale), y:Math.round((576-p.y)*yScale) };
}
function addContourToPath(path, contour){
  if(contour.length<3) return;
  const fp=contour.map(canvasToFontPoint);
  path.moveTo(fp[0].x,fp[0].y);
  for(let i=1;i<fp.length;i++) path.lineTo(fp[i].x,fp[i].y);
  path.close();
}
function makeGlyph(ch){
  const path=new opentype.Path();
  for(const stroke of state.drawings[ch]||[]){
    for(const contour of strokeToContours(stroke)) addContourToPath(path,contour);
  }
  const spacing=Math.max(20,Number(els.letterSpacing.value)||70);
  const bounds = state.drawings[ch]?.flatMap(s=>s.points.map(p=>p.x)) || [];
  const xMax = bounds.length ? Math.max(...bounds) : 540;
  const advanceWidth=Math.max(280,Math.min(1100,Math.round((xMax-45)*1.38+spacing)));
  return new opentype.Glyph({name:`uni${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")}`,unicode:ch.codePointAt(0),advanceWidth,path});
}
function makeNotdef(){
  const p=new opentype.Path(); p.moveTo(70,0);p.lineTo(70,700);p.lineTo(560,700);p.lineTo(560,0);p.close();
  p.moveTo(140,80);p.lineTo(490,80);p.lineTo(490,620);p.lineTo(140,620);p.close();
  return new opentype.Glyph({name:".notdef",advanceWidth:630,path:p});
}
function makeSpace(){ return new opentype.Glyph({name:"space",unicode:32,advanceWidth:330,path:new opentype.Path()}); }

async function buildFont(requireComplete=true){
  if(requireComplete && doneCount()!==TOTAL) throw new Error("Karakter belum lengkap.");
  const glyphs=[makeNotdef(),makeSpace(),...ALL_CHARS.map(makeGlyph)];
  const family=els.fontName.value.trim() || "My Handwriting";
  const font=new opentype.Font({
    familyName:family, styleName:els.fontStyle.value || "Regular",
    unitsPerEm:1000, ascender:800, descender:-200, glyphs
  });
  return font;
}
let previewTimer;
function schedulePreviewFont(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(updateFontPreview,220);
}
async function updateFontPreview(){
  try{
    const font=await buildFont(false);
    const buffer=font.toArrayBuffer();
    if(previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl=URL.createObjectURL(new Blob([buffer],{type:"font/otf"}));
    const face=new FontFace("GlyphCraftPreview",`url(${previewObjectUrl})`);
    await face.load(); document.fonts.add(face);
    [els.miniPreview,els.bigPreview,els.exportPreview,...document.querySelectorAll(".sample-font")].forEach(el=>el.style.fontFamily='"GlyphCraftPreview", sans-serif');
  }catch(err){ console.warn("Preview font:",err); }
}
async function prepareExport(){
  els.exportStatus.textContent="Membuat file font…";
  els.confirmFontBtn.disabled=true; els.confirmFontBtn.textContent="Membuat font…";
  try{
    const font=await buildFont(true), otfBuffer=font.toArrayBuffer();
    let ttfBuffer=null;
    try{
      const editor=createFont(otfBuffer,{type:"otf",compound2simple:true});
      ttfBuffer=editor.write({type:"ttf",hinting:false});
    }catch(convertError){
      console.warn("TTF conversion failed",convertError);
    }
    generated={font,otf:otfBuffer,ttf:ttfBuffer};
    els.exportTitle.textContent=`${els.fontName.value.trim() || "My Handwriting"} siap dipakai`;
    els.exportStatus.textContent=ttfBuffer ? "✓ File OTF & TTF siap diunduh" : "✓ OTF siap · TTF gagal dikonversi di browser ini";
    els.downloadTtf.disabled=!ttfBuffer; els.downloadTtf.style.opacity=ttfBuffer?"1":".45";
    els.finishModal.close(); els.exportModal.showModal(); schedulePreviewFont();
  }catch(err){
    console.error(err); showToast(err.message || "Gagal membuat font");
  }finally{
    els.confirmFontBtn.disabled=doneCount()!==TOTAL; els.confirmFontBtn.textContent="Ya, buat font";
  }
}
function downloadBuffer(buffer, ext, mime){
  if(!buffer) return showToast(`File ${ext.toUpperCase()} belum tersedia`);
  const name=slugify(els.fontName.value);
  const url=URL.createObjectURL(new Blob([buffer],{type:mime}));
  const a=document.createElement("a"); a.href=url; a.download=`${name}.${ext}`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500); showToast(`${ext.toUpperCase()} mulai diunduh`);
}

function openPreview(){
  els.bigPreview.textContent=els.previewInput.value; els.bigPreview.style.fontSize=`${els.previewSize.value}px`;
  els.previewModal.showModal(); schedulePreviewFont();
}
function openFinish(){ updateFinishModal(); els.finishModal.showModal(); }
function openSidebar(){ els.sidebar.classList.add("open"); els.scrim.hidden=false; }
function closeSidebar(){ els.sidebar.classList.remove("open"); els.scrim.hidden=true; }
function setMode(next){
  mode=next; els.penTool.classList.toggle("active",mode==="pen"); els.eraserTool.classList.toggle("active",mode==="eraser");
  canvas.style.cursor=mode==="eraser"?"cell":"crosshair"; drawCanvas();
}

function bindEvents(){
  canvas.addEventListener("pointerdown",startDraw); canvas.addEventListener("pointermove",moveDraw);
  canvas.addEventListener("pointerup",endDraw); canvas.addEventListener("pointercancel",endDraw);
  els.charTabs.addEventListener("click",e=>{ const b=e.target.closest("button[data-group]"); if(!b)return; activeGroup=b.dataset.group; const first=SETS[activeGroup][0]; if(!SETS[activeGroup].includes(activeChar)) activeChar=first; renderGrid();updateEditor();drawCanvas();saveState(); });
  els.brushSize.addEventListener("input",()=>{els.brushSizeValue.textContent=els.brushSize.value;saveState();});
  els.templateOpacity.addEventListener("input",()=>{els.templateOpacityValue.textContent=`${els.templateOpacity.value}%`;saveState();drawCanvas();});
  els.undoBtn.addEventListener("click",undo); els.clearBtn.addEventListener("click",clearCurrent);
  els.prevBtn.addEventListener("click",()=>navigate(-1)); els.nextBtn.addEventListener("click",()=>{saveState();navigate(1);});
  els.penTool.addEventListener("click",()=>setMode("pen")); els.eraserTool.addEventListener("click",()=>setMode("eraser"));
  [els.fontName,els.fontStyle,els.letterSpacing].forEach(el=>el.addEventListener("input",()=>{saveState();schedulePreviewFont();}));
  els.themeToggle.addEventListener("click",()=>setTheme(state.theme==="dark"?"light":"dark"));
  ["previewTopBtn","openPreviewBtn","mobilePreviewBtn","bottomPreview"].forEach(id=>$(id)?.addEventListener("click",openPreview));
  ["finishTopBtn","bottomFinish"].forEach(id=>$(id)?.addEventListener("click",openFinish));
  els.previewInput.addEventListener("input",()=>els.bigPreview.textContent=els.previewInput.value);
  els.previewSize.addEventListener("input",()=>els.bigPreview.style.fontSize=`${els.previewSize.value}px`);
  els.finishClose.addEventListener("click",()=>els.finishModal.close()); els.backToEditor.addEventListener("click",()=>els.finishModal.close());
  els.confirmFontBtn.addEventListener("click",prepareExport);
  els.exportClose.addEventListener("click",()=>els.exportModal.close()); els.continueEditing.addEventListener("click",()=>els.exportModal.close());
  els.downloadOtf.addEventListener("click",()=>downloadBuffer(generated.otf,"otf","font/otf"));
  els.downloadTtf.addEventListener("click",()=>downloadBuffer(generated.ttf,"ttf","font/ttf"));
  ["openCharsBtn","bottomChars"].forEach(id=>$(id)?.addEventListener("click",openSidebar));
  els.sidebarClose.addEventListener("click",closeSidebar); els.scrim.addEventListener("click",closeSidebar);
  els.charGrid.addEventListener("click",()=>{if(innerWidth<=820) closeSidebar();});
  window.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo();}
    else if(e.key==="ArrowRight") navigate(1); else if(e.key==="ArrowLeft") navigate(-1);
  });
}

function init(){
  setTheme(state.theme);
  els.fontName.value=state.fontName; els.fontStyle.value=state.fontStyle; els.letterSpacing.value=state.spacing;
  els.templateOpacity.value=state.templateOpacity; els.templateOpacityValue.textContent=`${state.templateOpacity}%`;
  els.brushSize.value=state.brushSize; els.brushSizeValue.textContent=state.brushSize;
  bindEvents(); renderGrid(); updateEditor(); drawCanvas(); schedulePreviewFont();
}
init();
