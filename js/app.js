/* ==================== 資料載入 ==================== */
const LEVELS = ['n5','n4','n3','n2','n1'];
const LEVEL_LABEL = {n5:'N5 入門', n4:'N4 初級', n3:'N3 中級', n2:'N2 中高級', n1:'N1 高級'};
const REVIEW_INTERVALS = [1,2,4,7,15,30,60,120];

let state = {
  level: 'n5',
  unitId: null,
  cardIndex: 0,
  revealed: false,
  loading: false,
  wbFilter: 'due',
  quiz: null,
  showReading: true,
  showChinese: true
};

/* ==================== localStorage 工具 ==================== */
function loadJSON(key, fallback){
  try{ const v = JSON.parse(localStorage.getItem(key)); return v===null||v===undefined ? fallback : v; }
  catch(e){ return fallback; }
}
function saveJSON(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }

function wkey(level, w){ return level + '::' + w.k + '::' + w.r; }

function getSettings(){ return loadJSON('jp_settings', {dailyGoal:20, showKanji:true, autoSpeak:false}); }
function getWordbook(){ return loadJSON('jp_wordbook', {}); }
function getReviews(){ return loadJSON('jp_reviews', {}); }
function getCache(){ return loadJSON('jp_cache', {}); }
function getUnitProgress(){ return loadJSON('jp_unit_progress', {}); }
function getCheckin(){ return loadJSON('jp_checkin', {dates:[], streak:0, lastDate:null}); }
function getDailyWords(){ return loadJSON('jp_daily_words', {date:null, count:0}); }

/* ==================== 畫面切換 ==================== */
function go(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+screen).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.nav===screen));
  if(screen==='home') renderHome();
  if(screen==='wordbook') renderWordbook();
  if(screen==='dict') { /* keep as is */ }
  if(screen==='settings') renderSettings();
  window.scrollTo(0,0);
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ==================== 首頁 ==================== */
function levelStats(level){
  const units = VOCAB[level];
  const totalWords = units.reduce((a,u)=>a+u.words.length,0);
  const prog = getUnitProgress();
  let learned = 0;
  units.forEach(u=>{ const p = prog[u.id]; if(p) learned += (p.learnedCount||0); });
  return {totalWords, learned, pct: totalWords ? Math.round(learned/totalWords*100) : 0};
}

function renderHome(){
  const ci = getCheckin();
  document.getElementById('streakNum').innerHTML = ci.streak + '<small>天</small>';
  const today = new Date().toDateString();
  const btn = document.getElementById('checkinBtn');
  if(ci.lastDate === today){ btn.disabled = true; btn.textContent = '今天已打卡 ✓'; }
  else { btn.disabled = false; btn.textContent = '今日打卡'; }

  const grid = document.getElementById('levelGrid');
  grid.innerHTML = LEVELS.map(lv=>{
    const s = levelStats(lv);
    return `<div class="level-stamp ${lv===state.level?'selected':''}" onclick="selectLevel('${lv}')">
      <div class="lv">${lv.toUpperCase()}</div>
      <div class="lv-pct">${s.pct}%</div>
    </div>`;
  }).join('');

  document.getElementById('unitListTitle').textContent = LEVEL_LABEL[state.level] + ' · 單元列表';
  renderUnitListInline();
}

function selectLevel(lv){
  state.level = lv;
  renderHome();
}

function renderUnitListInline(){
  const units = VOCAB[state.level];
  const prog = getUnitProgress();
  document.getElementById('unitListCount').textContent = units.length + ' 個單元';
  document.getElementById('unitList').innerHTML = units.map((u,i)=>{
    const p = prog[u.id] || {learnedCount:0};
    const pct = Math.round((p.learnedCount||0)/u.words.length*100);
    return `<div class="unit-card" onclick="openUnit('${u.id}')">
      <div class="unit-num">${i+1}</div>
      <div class="unit-info">
        <div class="theme">${u.theme}</div>
        <div class="meta">${u.words.length} 個單字${p.quizBestScore!==undefined ? ' · 測驗 '+p.quizBestScore+'%' : ''}</div>
        <div class="unit-progress-mini"><div style="width:${pct}%"></div></div>
      </div>
      <div class="chevron">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    </div>`;
  }).join('');
}

/* ==================== 單元 → 單字列表 ==================== */
function findUnit(unitId){
  for(const lv of LEVELS){ const u = VOCAB[lv].find(x=>x.id===unitId); if(u) return {unit:u, level:lv}; }
  return null;
}

function openUnit(unitId){
  const found = findUnit(unitId);
  if(!found) return;
  state.unitId = unitId;
  state.level = found.level;
  document.getElementById('wordlistLevel').textContent = LEVEL_LABEL[found.level];
  document.getElementById('wordlistTheme').textContent = found.unit.theme;
  renderWordlist();
  go('wordlist');
}

function renderWordlist(){
  const found = findUnit(state.unitId);
  if(!found) return;
  const wb = getWordbook();
  const body = document.getElementById('wordlistBody');
  body.innerHTML = found.unit.words.map(w=>{
    const saved = !!wb[wkey(found.level, w)];
    return `<div class="word-row">
      <div>
        <div class="word-kanji">${w.k}</div>
        ${state.showReading ? `<div class="word-reading">${w.r}</div>` : ''}
      </div>
      ${state.showChinese ? `<div class="word-zh">${w.zh}</div>` : ''}
      ${saved ? '<div class="word-star">★</div>' : ''}
    </div>`;
  }).join('');
}

function toggleWordlistReading(){
  state.showReading = !state.showReading;
  document.getElementById('toggleReading').classList.toggle('on', state.showReading);
  renderWordlist();
}

function toggleWordlistChinese(){
  state.showChinese = !state.showChinese;
  document.getElementById('toggleChinese').classList.toggle('on', state.showChinese);
  renderWordlist();
}

/* ==================== 字卡學習 ==================== */
function startFlashcards(){
  state.cardIndex = 0;
  state.revealed = false;
  go('flashcard');
  renderFlashcard();
}

function currentUnitWords(){
  const found = findUnit(state.unitId);
  return found ? found.unit.words : [];
}

function renderFlashcard(){
  const words = currentUnitWords();
  if(state.cardIndex >= words.length){
    finishUnitLearning();
    return;
  }
  const w = words[state.cardIndex];
  const total = words.length;
  document.getElementById('cardCounter').textContent = (state.cardIndex+1) + '/' + total;
  document.getElementById('cardProgressFill').style.width = Math.round((state.cardIndex)/total*100) + '%';

  const settings = getSettings();
  state.revealed = false;

  const el = document.getElementById('flashcardEl');
  const kanjiText = settings.showKanji ? w.k : w.r;
  const kanjiCls = kanjiText.length > 2 ? 'card-kanji long' : 'card-kanji';
  el.innerHTML = `
    <div class="card-genko">
      <div class="${kanjiCls}">${kanjiText}</div>
    </div>
    <div class="card-reading">${w.r}</div>
    <div class="card-meaning"><span class="card-hint" style="position:static;">點擊卡片查看意思</span></div>
    <div class="card-hint" id="cardHintBottom">輕點卡片翻譯 · 再點播放語音</div>
  `;
  updateStarButton(w);

  if(getSettings().autoSpeak) setTimeout(speak, 350);
}

function renderExampleBlock(info){
  if(!info.example) return '';
  return `<div class="card-example">${info.example}<div class="zh">${info.exampleZh||''}</div></div>`;
}

async function flipCard(){
  if(state.loading) return;
  const words = currentUnitWords();
  const w = words[state.cardIndex];
  const key = wkey(state.level, w);
  const cache = getCache();
  const settings = getSettings();

  // 已翻面 → 翻回正面
  if(state.revealed){
    state.revealed = false;
    const el = document.getElementById('flashcardEl');
    const kanjiText = settings.showKanji ? w.k : w.r;
    const kanjiCls = kanjiText.length > 2 ? 'card-kanji long' : 'card-kanji';
    el.innerHTML = `
      <div class="card-genko">
        <div class="${kanjiCls}">${kanjiText}</div>
      </div>
      <div class="card-reading">${w.r}</div>
      <div class="card-meaning"><span class="card-hint" style="position:static;">點擊卡片查看意思</span></div>
      <div class="card-hint">輕點卡片翻譯 · 再點播放語音</div>
    `;
    return;
  }

  // 正面 → 翻面
  const info = cache[key] || await fetchWordInfo(w);
  state.revealed = true;
  const el = document.getElementById('flashcardEl');
  const kanjiText = settings.showKanji ? w.k : w.r;
  const kanjiCls = kanjiText.length > 2 ? 'card-kanji long' : 'card-kanji';
  el.innerHTML = `
    <div class="card-genko">
      <div class="${kanjiCls}">${kanjiText}</div>
    </div>
    <div class="card-reading">${w.r}</div>
    <div class="card-meaning">${info.zh}</div>
    ${renderExampleBlock(info)}
    <div class="card-hint">輕點卡片翻回正面</div>
  `;
  markWordLearned(w);
}

function markWordLearned(w){
  const found = findUnit(state.unitId);
  if(!found) return;
  const prog = getUnitProgress();
  const p = prog[state.unitId] || {learnedCount:0, seen:{}};
  p.seen = p.seen || {};
  const key = wkey(state.level, w);
  if(!p.seen[key]){
    p.seen[key] = true;
    p.learnedCount = Object.keys(p.seen).length;
    prog[state.unitId] = p;
    saveJSON('jp_unit_progress', prog);
    trackDailyWords();
  }
}

function trackDailyWords(){
  const today = new Date().toDateString();
  const dw = getDailyWords();
  if(dw.date !== today){ dw.date = today; dw.count = 0; }
  dw.count++;
  saveJSON('jp_daily_words', dw);
  const goal = getSettings().dailyGoal;
  if(dw.count >= goal){
    const ci = getCheckin();
    if(ci.lastDate !== today){
      const yesterday = new Date(Date.now()-86400000).toDateString();
      ci.streak = (ci.lastDate === yesterday) ? ci.streak + 1 : 1;
      ci.lastDate = today;
      ci.dates.push(today);
      saveJSON('jp_checkin', ci);
      showToast('已自動打卡！連續 ' + ci.streak + ' 天 🎉');
      renderHome();
    }
  }
}

function nextCard(){
  state.cardIndex++;
  state.revealed = false;
  renderFlashcard();
}

function prevCard(){
  if(state.cardIndex > 0){
    state.cardIndex--;
    state.revealed = false;
    renderFlashcard();
  }
}

function finishUnitLearning(){
  const el = document.getElementById('flashcardEl');
  el.innerHTML = `
    <div style="text-align:center; padding:40px 20px;">
      <div style="font-size:48px; margin-bottom:16px;">🎉</div>
      <div style="font-family:var(--font-display); font-size:20px; font-weight:700; margin-bottom:8px;">這個單元看完了！</div>
      <div style="color:#8a7f6c; font-size:13px; margin-bottom:28px;">接下來要怎麼做？</div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn-primary" onclick="startQuiz('${state.unitId}')">做個小測驗</button>
        <button class="btn-secondary" onclick="restartFlashcards()">重新看一次字卡</button>
        <button style="background:none; border:none; color:#9b8f7c; font-size:13px; cursor:pointer; padding:8px;" onclick="go('home')">回到首頁</button>
      </div>
    </div>
  `;
  document.getElementById('cardCounter').textContent = '完成';
  document.getElementById('cardProgressFill').style.width = '100%';
}

function exitFlashcards(){
  go('wordlist');
}

function restartFlashcards(){
  state.cardIndex = 0;
  state.revealed = false;
  renderFlashcard();
}

function updateStarButton(w){
  const wb = getWordbook();
  const key = wkey(state.level, w);
  const btn = document.getElementById('starBtn');
  btn.classList.toggle('star-on', !!wb[key]);
}

function toggleSaveWord(){
  const words = currentUnitWords();
  const w = words[state.cardIndex];
  const key = wkey(state.level, w);
  const wb = getWordbook();
  if(wb[key]){
    delete wb[key];
    showToast('已從單字本移除');
  } else {
    wb[key] = {k:w.k, r:w.r, zh:w.zh, level:state.level, added: Date.now()};
    showToast('已加入單字本');
  }
  saveJSON('jp_wordbook', wb);
  updateStarButton(w);
}

function speak(){
  const words = currentUnitWords();
  const w = words[state.cardIndex];
  if(!w) return;
  speakText(w.r);
}

function speakText(text){
  if(!('speechSynthesis' in window)){ showToast('這個瀏覽器不支援語音播放'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v=>v.lang && v.lang.startsWith('ja'));
  if(jaVoice) u.voice = jaVoice;
  window.speechSynthesis.speak(u);
}
if('speechSynthesis' in window){ window.speechSynthesis.onvoiceschanged = ()=>{}; }

/* ==================== Claude API：翻譯與例句 ==================== */
async function callClaude(promptText){
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: promptText }]
    })
  });
  const data = await resp.json();
  const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  return text.replace(/```json|```/g,'').trim();
}

async function fetchWordInfo(w){
  const cache = getCache();
  const key = wkey(state.level, w);
  if(cache[key]) return cache[key];
  try{
    const prompt = `你是日文教學助手，請針對日文單字「${w.k}」（讀音：${w.r}，中文參考意思：${w.zh}）提供繁體中文教學內容。只回傳一個JSON物件，不要有任何前後說明文字或markdown標記，格式為：{"zh":"精簡的繁體中文意思，10個字以內","example":"一句自然、符合該字常見用法的日文例句（含漢字與假名皆可）","exampleZh":"該例句的繁體中文翻譯"}`;
    const raw = await callClaude(prompt);
    const parsed = JSON.parse(raw);
    cache[key] = parsed;
    saveJSON('jp_cache', cache);
    return parsed;
  }catch(e){
    console.error('fetchWordInfo failed', e);
    const fallback = {zh: w.zh, example:'', exampleZh:''};
    return fallback;
  }
}

async function fetchWordInfoBatch(level, words){
  const cache = getCache();
  const need = words.filter(w=>!cache[wkey(level,w)]);
  if(need.length===0) return;
  try{
    const list = need.map((w,i)=>`${i+1}. ${w.k}（${w.r}，參考中文:${w.zh}）`).join('\n');
    const prompt = `你是日文教學助手，請針對以下 ${need.length} 個日文單字，各提供繁體中文教學內容。只回傳一個JSON陣列，不要有任何前後說明文字或markdown標記，陣列中每個物件依照輸入順序對應，格式為：[{"zh":"精簡的繁體中文意思，10個字以內","example":"一句自然的日文例句","exampleZh":"例句的繁體中文翻譯"}, ...]\n單字列表：\n${list}`;
    const raw = await callClaude(prompt);
    const parsed = JSON.parse(raw);
    need.forEach((w,i)=>{ if(parsed[i]) cache[wkey(level,w)] = parsed[i]; });
    saveJSON('jp_cache', cache);
  }catch(e){
    console.error('batch fetch failed', e);
    need.forEach(w=>{ cache[wkey(level,w)] = {zh:w.zh, example:'', exampleZh:''}; });
    saveJSON('jp_cache', cache);
  }
}

/* ==================== 測驗 ==================== */
function pickDistractors(unitWords, correctWord, count){
  const pool = unitWords.filter(w=>w.k!==correctWord.k);
  const shuffled = pool.sort(()=>Math.random()-0.5);
  return shuffled.slice(0, count);
}

async function startQuiz(unitId){
  const found = findUnit(unitId);
  if(!found) return;
  state.unitId = unitId;
  state.level = found.level;
  const allWords = found.unit.words.slice().sort(()=>Math.random()-0.5);

  go('quiz');
  document.getElementById('quizBody').innerHTML = `<div style="text-align:center; padding:60px 20px; color:#a89c85;">準備測驗題目中…</div>`;

  const neededSet = new Map();
  const questionsPlan = allWords.map(qw=>{
    const distractors = pickDistractors(allWords, qw, Math.min(3, allWords.length - 1));
    [qw, ...distractors].forEach(w=>neededSet.set(w.k+'|'+w.r, w));
    return {word: qw, distractors};
  });
  await fetchWordInfoBatch(state.level, Array.from(neededSet.values()));

  const cache = getCache();
  const questions = questionsPlan.map(qp=>{
    const correctInfo = cache[wkey(state.level, qp.word)] || {zh: qp.word.zh};
    const options = [
      {text: correctInfo.zh, correct:true},
      ...qp.distractors.map(d=>({text: (cache[wkey(state.level,d)]||{zh:d.zh}).zh, correct:false}))
    ].sort(()=>Math.random()-0.5);
    return {word: qp.word, options};
  });

  state.quiz = {questions, index:0, score:0, answered:false, wrongWords:[]};
  renderQuizQuestion();
}

function renderQuizQuestion(){
  const q = state.quiz;
  if(q.index >= q.questions.length){ renderQuizResult(); return; }
  const item = q.questions[q.index];
  q.answered = false;
  document.getElementById('quizBody').innerHTML = `
    <div class="quiz-q">
      <div class="label">第 ${q.index+1} / ${q.questions.length} 題</div>
      <div class="kanji">${item.word.k}</div>
      <div class="reading">${item.word.r}</div>
    </div>
    <div class="quiz-options" id="quizOptions">
      ${item.options.map((o,i)=>`<div class="quiz-opt" onclick="selectQuizOption(${i})">${o.text}</div>`).join('')}
    </div>
  `;
}

function selectQuizOption(idx){
  const q = state.quiz;
  if(q.answered) return;
  q.answered = true;
  const item = q.questions[q.index];
  const opts = document.querySelectorAll('#quizOptions .quiz-opt');
  opts.forEach(o=>o.classList.add('disabled'));
  const chosen = item.options[idx];
  if(chosen.correct){
    opts[idx].classList.add('correct');
    q.score++;
    markWordLearned(item.word);
  } else {
    opts[idx].classList.add('wrong');
    const correctIdx = item.options.findIndex(o=>o.correct);
    opts[correctIdx].classList.add('correct');
    q.wrongWords.push(item.word);
  }
  recordReview(item.word, chosen.correct);
  setTimeout(()=>{ q.index++; renderQuizQuestion(); }, 1100);
}

function recordReview(w, correct){
  const reviews = getReviews();
  const key = wkey(state.level, w);
  const r = reviews[key] || {box:0, k:w.k, r:w.r, zh:w.zh, level: state.level};
  if(correct){ r.box = Math.min(r.box+1, REVIEW_INTERVALS.length-1); }
  else { r.box = 0; }
  const days = REVIEW_INTERVALS[r.box];
  r.due = Date.now() + days*86400000;
  r.lastReviewed = Date.now();
  reviews[key] = r;
  saveJSON('jp_reviews', reviews);
}

function renderQuizResult(){
  const q = state.quiz;
  const pct = Math.round(q.score/q.questions.length*100);
  const prog = getUnitProgress();
  const p = prog[state.unitId] || {learnedCount:0, seen:{}};
  p.quizBestScore = Math.max(p.quizBestScore||0, pct);
  prog[state.unitId] = p;
  saveJSON('jp_unit_progress', prog);

  const wb = getWordbook();
  let wrongHtml = '';
  if(q.wrongWords.length > 0){
    wrongHtml = `
      <div style="margin-top:24px; text-align:left;">
        <p style="color:#8a7f6c; font-size:13px; margin-bottom:12px;">答錯的單字（點擊加入單字本）：</p>
        ${q.wrongWords.map(w=>{
          const key = wkey(state.level, w);
          const saved = !!wb[key];
          return `<div class="quiz-wrong-item" onclick="saveWrongWord('${w.k}','${w.r}',this)" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--washi);border:1px solid var(--line-soft);border-radius:var(--radius-m);margin-bottom:6px;cursor:pointer;">
            <div style="flex:1;min-width:0;">
              <span style="font-family:var(--font-jp);font-weight:700;font-size:16px;">${w.k}</span>
              <span style="font-family:var(--font-jp);font-size:11px;color:#9b8f7c;margin-left:6px;">${w.r}</span>
              <div style="font-size:12px;color:#8a7f6c;margin-top:2px;">${w.zh}</div>
            </div>
            <span class="save-status" style="font-size:12px;color:${saved?'var(--wakakusa)':'#c9bda3'};white-space:nowrap;">${saved?'已收藏':'收藏'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  document.getElementById('quizBody').innerHTML = `
    <div class="quiz-result">
      <div class="big-score">${pct}%</div>
      <p>答對 ${q.score} / ${q.questions.length} 題</p>
      ${wrongHtml}
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:24px;">
        <button class="btn-primary" onclick="startQuiz('${state.unitId}')">再測一次</button>
        <button class="btn-secondary" onclick="go('home')">回到首頁</button>
      </div>
    </div>
  `;
}

function saveWrongWord(k, r, el){
  const wb = getWordbook();
  const key = `${state.level}::${k}::${r}`;
  if(wb[key]){
    delete wb[key];
    el.querySelector('.save-status').textContent = '收藏';
    el.querySelector('.save-status').style.color = '#c9bda3';
    showToast('已移除');
  } else {
    const found = findUnit(state.unitId);
    const w = found.unit.words.find(x=>x.k===k && x.r===r);
    wb[key] = {k, r, zh: w.zh, level:state.level, added: Date.now()};
    el.querySelector('.save-status').textContent = '已收藏';
    el.querySelector('.save-status').style.color = 'var(--wakakusa)';
    showToast('已加入單字本');
  }
  saveJSON('jp_wordbook', wb);
}

/* ==================== 我的單字本 ==================== */
function setWbFilter(f){
  state.wbFilter = f;
  document.querySelectorAll('.wordbook-filter .chip').forEach(c=>c.classList.toggle('active', c.dataset.filter===f));
  renderWordbook();
}

function renderWordbook(){
  const wb = getWordbook();
  const reviews = getReviews();
  const body = document.getElementById('wordbookBody');
  const now = Date.now();

  let items = [];
  if(state.wbFilter === 'all'){
    items = Object.entries(wb).map(([key,v])=>({key, ...v, review: reviews[key]}));
  } else if(state.wbFilter === 'due'){
    items = Object.entries(reviews).filter(([key,v])=>v.due<=now).map(([key,v])=>({key, ...v}));
  } else if(state.wbFilter === 'mastered'){
    items = Object.entries(reviews).filter(([key,v])=>v.box>=5).map(([key,v])=>({key, ...v}));
  }

  if(items.length===0){
    body.innerHTML = `<div class="empty-state">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z"/></svg>
      <p>${state.wbFilter==='due' ? '目前沒有需要複習的單字，\n去學習單元或做測驗來累積吧！' : state.wbFilter==='mastered' ? '還沒有已經熟記的單字。\n持續複習就會出現在這裡。' : '單字本是空的。\n在字卡學習時點擊星星圖示即可收藏。'}</p>
    </div>`;
    return;
  }

  body.innerHTML = items.map(it=>{
    const dueSoon = it.due && it.due <= now;
    const dueLabel = it.due ? (dueSoon ? '現在複習' : new Date(it.due).toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'})+' 複習') : '尚未排程';
    return `<div class="wb-item">
      <div class="wb-info">
        <span class="k">${it.k}</span><span class="r">${it.r}</span>
        <div class="meaning">${it.zh}</div>
      </div>
      <div class="wb-due ${dueSoon?'due-now':'due-later'}">${dueLabel}</div>
    </div>`;
  }).join('');
}

function clearWordbook(){
  if(confirm('確定要清空單字本嗎？此動作無法復原。')){
    saveJSON('jp_wordbook', {});
    showToast('單字本已清空');
    renderWordbook();
  }
}

function clearAllData(){
  if(confirm('確定要重設所有學習紀錄嗎？包含單字本、複習排程、打卡與進度，此動作無法復原。')){
    ['jp_wordbook','jp_reviews','jp_unit_progress','jp_checkin','jp_cache'].forEach(k=>localStorage.removeItem(k));
    showToast('已重設所有資料');
    go('home');
  }
}

/* ==================== 字典搜尋 ==================== */
let FLAT_INDEX = null;
function buildFlatIndex(){
  if(FLAT_INDEX) return FLAT_INDEX;
  FLAT_INDEX = [];
  LEVELS.forEach(lv=>{
    VOCAB[lv].forEach(u=>{
      u.words.forEach(w=>{ FLAT_INDEX.push({level:lv, k:w.k, r:w.r, zh:w.zh}); });
    });
  });
  return FLAT_INDEX;
}

let dictSearchTimer = null;
function dictSearch(){
  clearTimeout(dictSearchTimer);
  dictSearchTimer = setTimeout(doDictSearch, 150);
}

function doDictSearch(){
  const q = document.getElementById('dictInput').value.trim().toLowerCase();
  const results = document.getElementById('dictResults');
  const hint = document.getElementById('dictHint');
  if(!q){ results.innerHTML=''; hint.style.display='block'; return; }
  hint.style.display='none';
  const idx = buildFlatIndex();
  const matches = idx.filter(w=> w.k.includes(q) || w.r.includes(q) || w.zh.toLowerCase().includes(q)).slice(0,60);
  if(matches.length===0){
    results.innerHTML = `<div class="empty-state"><p>找不到符合「${escapeHtml(q)}」的單字</p></div>`;
    return;
  }
  results.innerHTML = matches.map(w=>`
    <div class="word-row">
      <div>
        <div class="word-kanji">${w.k}</div>
        <div class="word-reading">${w.r}</div>
      </div>
      <div class="word-zh">${w.zh}</div>
      <div class="word-star" style="color:var(--ai); font-size:11px; font-weight:700;">${w.level.toUpperCase()}</div>
    </div>
  `).join('');
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ==================== 設定 ==================== */
function renderSettings(){
  const s = getSettings();
  document.getElementById('dailyGoalSel').value = s.dailyGoal;
  document.getElementById('toggleKanji').classList.toggle('on', s.showKanji);
  document.getElementById('toggleAutoSpeak').classList.toggle('on', s.autoSpeak);
}
function saveSettings(){
  const s = getSettings();
  s.dailyGoal = parseInt(document.getElementById('dailyGoalSel').value, 10);
  saveJSON('jp_settings', s);
}
function toggleSetting(name, el){
  const s = getSettings();
  s[name] = !s[name];
  saveJSON('jp_settings', s);
  el.classList.toggle('on', s[name]);
}

/* ==================== 每日打卡 ==================== */
function doCheckin(){
  const ci = getCheckin();
  const today = new Date().toDateString();
  if(ci.lastDate === today) return;
  const yesterday = new Date(Date.now()-86400000).toDateString();
  ci.streak = (ci.lastDate === yesterday) ? ci.streak + 1 : 1;
  ci.lastDate = today;
  ci.dates.push(today);
  saveJSON('jp_checkin', ci);
  showToast('打卡成功！連續 ' + ci.streak + ' 天 🎉');
  renderHome();
}

/* ==================== 啟動 ==================== */
renderHome();
