/* ====== رابط شيت المستخدمين ====== */
const API_URL_LOGIN = "https://script.google.com/macros/s/AKfycbxCndGQAWRcNbhj51KiWkMMhxzREiXcvYd57mXXuSmiAl8VKCy4J9WHLMx5R5etZerXPg/exec";

(function initLogin(){
  const overlay  = document.getElementById('loginOverlay');
  const userInp  = document.getElementById('loginUser');
  const passInp  = document.getElementById('loginPass');
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  async function tryLogin(){
    const u = userInp.value.trim();
    const p = passInp.value.trim();
    if(!u || !p){
      errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
      errEl.style.display = 'block';
      return;
    }

    // تعطيل الزر وإظهار مؤشر التحميل
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> جاري التحقق...';
    errEl.style.display = 'none';

    try {
      const url = `${API_URL_LOGIN}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`;
      const res = await fetch(url);
      const data = await res.json();

      if(data.ok){
        overlay.classList.add('hidden');
      } else {
        errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        errEl.style.display = 'block';
        passInp.value = '';
        passInp.focus();
      }
    } catch(err) {
      console.error('login error', err);
      errEl.textContent = 'تعذر الاتصال بالسيرفر، تحقق من الإنترنت';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'دخول';
    }
  }

  btn.addEventListener('click', tryLogin);
  passInp.addEventListener('keydown', e => { if(e.key === 'Enter') tryLogin(); });
  userInp.addEventListener('keydown', e => { if(e.key === 'Enter') passInp.focus(); });
})();

/* ====== إعدادات ====== */
// ضع هنا رابط الـ Web App الذي يعمل معك (الرابط الذي كتبته واشتغل)
const API_URL_MAIN = "https://script.google.com/macros/s/AKfycbwOICSjn03m1xIxkOvkRCcTdHGGiZnIVAO0_dTDSwIRNjDAPVH2m9W1lQ9NJC1-eqskEw/exec";
// رابط البحث (API_SEARCH)
const API_URL_SEARCH = "https://script.google.com/macros/s/AKfycbzdsQ3AIJQcE14rMFp8h7Lz9tvILx_Jb7LfGmOy1O3yFh-WllvzFPMT-zxA1SfFns46Sg/exec";

/* ====== عناصر DOM ====== */
const themeToggle = document.getElementById('themeToggle');
const msgBox = document.getElementById('msgBox');

const searchRegion = document.getElementById('searchRegion');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const searchResultsEl = document.getElementById('searchResults');

const clientForm = document.getElementById('clientForm');
const saveBtn = document.getElementById('saveBtn');
const saveLoader = document.getElementById('saveLoader');

const regionField = document.getElementById('region');
const nameField = document.getElementById('name');
const phoneField = document.getElementById('phone');
const addressField = document.getElementById('address');
const crnField = document.getElementById('crn');
const caseTypeField = document.getElementById('caseType');

const recorderSelect = document.getElementById('recorderSelect');
const recorderOther = document.getElementById('recorderOther');

const filterRegion = document.getElementById('filterRegion');
const tableSaved = document.querySelector('#tableSaved tbody');
const refreshBtn = document.getElementById('refreshBtn');
const listLoader = document.getElementById('listLoader');

const openSaved = document.getElementById('openSaved');
const openDelivered = document.getElementById('openDelivered');

/* ====== حالة محلية ====== */
let allRows = [];           // البيانات المجلوبة من السيرفر (list)
let lastSearchResults = []; // نتائج البحث
let currentView = 'saved';  // saved / delivered

/* ====== مساعدة عرض رسالة ====== */
function showMessage(txt, timeout=2200){
  msgBox.textContent = txt;
  msgBox.style.opacity = '1';
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(()=> msgBox.style.opacity = '0', timeout);
}

/* ====== الوضع الليلي ====== */
themeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? '🌞' : '🌙';
});

/* ====== تبديل عرض البلاغات ====== */
function setActiveView(v){
  currentView = v;
  if(v==='saved'){ openSaved.classList.add('btn'); openDelivered.classList.remove('btn'); }
  else { openDelivered.classList.add('btn'); openSaved.classList.remove('btn'); }
  renderTables();
}
openSaved.addEventListener('click', ()=> setActiveView('saved'));
openDelivered.addEventListener('click', ()=> setActiveView('delivered'));

/* ====== تنسيق التاريخ ====== */
function formatDate(d){ if(!d) return ''; try{ return new Date(d).toLocaleString('ar-EG'); }catch(e){ return d } }

/* ====== Utilities ====== */
function dateKey(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${dt.getFullYear()}-${m}-${day}`;
}
function normalizeCRN(s){ return (s||'').toString().replace(/[^\d/]/g,'').trim(); }

/* ====== تقديم جدول ====== */
function makeRowHTML(d){
  const tr = document.createElement('tr');
  tr.dataset.crn = d.crn || '';

  // اذا البلاغ تم تبليغه أو مميز كـ highlight
  if (d.delivered) tr.classList.add('delivered');
  if (d.highlight && !d.delivered) tr.classList.add('highlight');

  tr.innerHTML = `
    <td>${d.region||''}</td>
    <td>${d.name||''}</td>
    <td>${d.phone||''}</td>
    <td>${d.address||''}</td>
    <td>${d.crn||''}</td>
    <td>${d.caseType||''}</td>
    <td>${d.recorder||d.reporter||''}</td>
    <td>${formatDate(d.date)}</td>
    <td>
      <button class="btn ghost" data-action="edit">تعديل</button>
      <button class="btn ghost" data-action="copy">نسخ</button>
      <button class="btn ghost" data-action="deliver">${d.delivered ? 'إلغاء تبليغ' : 'تم التبليغ'}</button>
    </td>
  `;
  return tr;
}

function renderTables(){
  tableSaved.innerHTML = '';
  // نعرض صفوف المحفوظة أو المبلّغة حسب currentView
  const rows = allRows.filter(r => currentView === 'saved' ? !r.delivered : !!r.delivered);
  const filtered = (filterRegion.value && filterRegion.value!=='__ALL__') ? rows.filter(r => r.region === filterRegion.value) : rows;
  filtered.sort((a,b)=>{
    const r = (a.region||'').localeCompare(b.region||'', 'ar');
    if(r!==0) return r;
    return new Date(b.date||0) - new Date(a.date||0);
  });
  const frag = document.createDocumentFragment();
  filtered.forEach(r => frag.appendChild(makeRowHTML(r)));
  tableSaved.appendChild(frag);
}

/* ====== جلب البيانات من السيرفر (list) ====== */
async function fetchData(){
  listLoader.style.display = 'inline-block';
  try{
    const res = await fetch(API_URL_MAIN + '?action=list', { cache: "no-store" });
    if(!res.ok) throw new Error('شبكة');
    const json = await res.json();
    // تقبل إما مصفوفة مباشرة أو كائن { status, data: [...] }
    let data = [];
    if (Array.isArray(json)) data = json;
    else if (json && Array.isArray(json.data)) data = json.data;
    else data = [];

    // ضمان قيم منطقية
    allRows = data.map(r => {
      r.delivered = !!r.delivered;
      r.highlight = !!r.highlight;
      return r;
    });

    renderTables();
  }catch(err){
    console.error('fetchData', err);
    showMessage('تعذّر تحميل البيانات من السيرفر', 3000);
  }finally{
    listLoader.style.display = 'none';
  }
}

/* ====== إرسال حفظ صف جديد (باستخدام GET) ====== */
async function createRow(payload){
  saveLoader.style.display = 'inline-block';
  saveBtn.disabled = true;
  try{
    const params = new URLSearchParams({
      action: 'create',
      region: payload.region || '',
      name: payload.name || '',
      phone: payload.phone || '',
      address: payload.address || '',
      crn: payload.crn || '',
      caseType: payload.caseType || '',
      reporter: payload.recorder || payload.reporter || ''
    });
    const url = API_URL_MAIN + '?' + params.toString();
    const res = await fetch(url, { method: 'GET' });
    const txt = await res.text().catch(()=>null);
    console.log('createRow response:', res.status, txt);
    if(!res.ok) throw new Error('failed to save - status ' + res.status);
    return txt;
  }catch(err){
    console.error('createRow', err);
    showMessage('خطأ أثناء الحفظ على السيرفر', 2500);
    throw err;
  }finally{
    saveLoader.style.display = 'none';
    saveBtn.disabled = false;
  }
}

/* ====== نقل / إلغاء نقل البلاغ (move / unmove) ====== */
async function toggleDeliveredAPI(crn, makeDelivered){
  const action = makeDelivered ? 'move' : 'unmove';
  const url = API_URL_MAIN + '?action=' + action + '&crn=' + encodeURIComponent(crn);
  const res = await fetch(url, { method: 'GET' });
  const txt = await res.text().catch(()=>null);
  console.log(action + ' response:', res.status, txt);
  if(!res.ok) throw new Error(action + ' failed: ' + res.status + ' ' + txt);
  return txt;
}

/* ====== recorder select toggle ====== */
recorderSelect.addEventListener('change', ()=>{
  if(recorderSelect.value === '__other__'){
    recorderOther.style.display = 'block';
    recorderOther.focus();
  } else {
    recorderOther.style.display = 'none';
    recorderOther.value = '';
  }
});

/* ====== معالجة إرسال النموذج ====== */
clientForm.addEventListener('submit', async (e)=>{
  e.preventDefault();

  let recorder = '';
  if(recorderSelect.value === '__other__'){
    recorder = recorderOther.value.trim();
  }else{
    recorder = recorderSelect.value.trim();
  }

  const payload = {
    region: regionField.value,
    name: nameField.value.trim(),
    phone: phoneField.value.trim(),
    address: addressField.value.trim(),
    crn: crnField.value.trim(),
    caseType: caseTypeField.value,
    delivered: false,
    date: new Date().toISOString(),
    recorder: recorder || ''
  };

  if(!payload.region){ alert('اختر المنطقة'); return; }
  if(!payload.name || !payload.crn){ alert('اكمل الحقول المطلوبة'); return; }

  // منع تكرار بلاغ لنفس CRN في نفس اليوم
  const today = dateKey(new Date());
  const currentCRN = normalizeCRN(payload.crn);
  const dup = allRows.find(r => normalizeCRN(r.crn||'') === currentCRN && dateKey(r.date) === today);

  if(dup){
    const when = formatDate(dup.date);
    alert(`تعذر الحفظ: يوجد بلاغ لهذا العميل اليوم.\nتم حفظ بلاغ سابق اليوم في: ${when}`);
    showMessage(`⚠️ يوجد بلاغ محفوظ اليوم لهذا العميل (${when})`, 3200);
    return;
  }

  // تحديث محلي فوري
  allRows.push(payload);
  renderTables();
  showMessage('تم الحفظ محلياً — جاري إرسال البيانات للسيرفر');

  try{
    await createRow(payload);
    showMessage('تم الحفظ على الشيت ✅',1800);
    await fetchData();
  }catch(_){
    // إذا فشل، سيبقى محلياً
  }

  clientForm.reset();
  recorderOther.style.display = 'none';
});

/* ====== وظائف نسخ وتعديل وتبديل تبليغ (delegated events) ====== */
tableSaved.addEventListener('click', async (ev)=>{
  const btn = ev.target.closest('button');
  if(!btn) return;
  const tr = btn.closest('tr');
  const crn = tr?.dataset?.crn?.trim();
  const action = btn.dataset.action;

  if(action === 'edit'){
    const cells = tr.children;
    regionField.value = cells[0].textContent.trim();
    nameField.value = cells[1].textContent.trim();
    phoneField.value = cells[2].textContent.trim();
    addressField.value = cells[3].textContent.trim();
    crnField.value = cells[4].textContent.trim();
    caseTypeField.value = cells[5].textContent.trim();
    tr.remove();
    showMessage('تم تحميل البيانات للتعديل');
  } else if(action === 'copy'){
    const txt = Array.from(tr.children).slice(0,6).map(td=>td.textContent.trim()).join('\n');
    try{ await navigator.clipboard.writeText(txt); showMessage('تم النسخ للحافظة'); }catch(e){ showMessage('فشل النسخ'); }
  } else if(action === 'deliver'){
    const idx = allRows.findIndex(r => (normalizeCRN(r.crn||'')) === normalizeCRN(crn||''));
    if(idx === -1){ showMessage('لم أتمكن من إيجاد البلاغ محلياً'); return; }

    const oldRow = Object.assign({}, allRows[idx]); // حفظ الحالة القديمة للرجوع لو فشل
    const makeDelivered = !allRows[idx].delivered;

    // تحديث محلي فوري وواجهة فورية (optimistic)
    allRows[idx].delivered = makeDelivered;
    // لو رجع من تم تبليغها فنعلمه highlight=true
    if(!makeDelivered) allRows[idx].highlight = true;
    else allRows[idx].highlight = false;

    // تعديل الواجهة مباشرة
    if(makeDelivered){
      // سيُنقل للشيت "بلاغات تم تبليغها" فليختفي من لائحة المحفوظة إن كنا في view المحفوظة
      if (tr) tr.remove();
      showMessage('جارٍ وضع البلاغ كمبلّغ...');
    } else {
      // إلغاء التبليغ — نُظهر التمييز الأصفر
      if (tr) {
        tr.classList.remove('delivered');
        tr.classList.add('highlight');
      }
      showMessage('جارٍ إلغاء حالة التبليغ...');
    }

    // نرسل للـ API (move / unmove)
    try{
      await toggleDeliveredAPI(crn, makeDelivered);
      showMessage(makeDelivered ? 'تم وضعه كمبلّغ' : 'تم إلغاء حالة التبليغ', 2000);
      // خذ البيانات من السيرفر للتأكد
      await fetchData();
    }catch(err){
      console.error('toggleDelivered failed', err);
      // فشل -> ارجع للحالة القديمة وحدث الواجهة
      allRows[idx] = oldRow;
      showMessage('خطأ أثناء تحديث الحالة على السيرفر', 2500);
      renderTables();
    }
  }
});

/* ====== بحث العميل (API_SEARCH) ====== */
async function searchClient(){
  const q = searchInput.value.trim();
  const region = searchRegion.value || '';
  if(!q){ alert('اكتب نص للبحث (CRN أو جزء من الاسم باستخدام % أو الموبايل)'); return; }

  searchResultsEl.style.display = 'block';
  searchResultsEl.innerHTML = '<div style="padding:10px">جاري البحث... <span class="loader"></span></div>';

  try{
    const url = `${API_URL_SEARCH}?action=search&q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('شبكة');
    const data = await res.json();
    lastSearchResults = Array.isArray(data) ? data : [];

    if(lastSearchResults.length === 0){
      searchResultsEl.innerHTML = '<div style="padding:10px;color:#666">لا نتائج.</div>';
      return;
    }

    const max = Math.min(50, lastSearchResults.length);
    const frag = document.createDocumentFragment();
    for(let i=0;i<max;i++){
      const it = lastSearchResults[i];
      const div = document.createElement('div');
      div.className = 'result-item';
      div.dataset.idx = i;
      div.innerHTML = `
        <div style="flex:1">
          <strong>${it.name || '—'}</strong>
          <div class="small">${it.phone || it.mobileNo || '—'} · CRN: ${it.crn || '—'} · منطقة: ${it.region || '—'}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" data-idx="${i}" data-action="select">اختر</button>
        </div>
      `;
      frag.appendChild(div);
    }
    searchResultsEl.innerHTML = '';
    searchResultsEl.appendChild(frag);

    if(lastSearchResults.length === 1){
      fillFormFromResult(0);
      searchResultsEl.style.display = 'none';
      return;
    }

    Array.from(searchResultsEl.querySelectorAll('button[data-action="select"]')).forEach(b=>{
      b.addEventListener('click', ()=>{
        const idx = Number(b.dataset.idx);
        fillFormFromResult(idx);
        searchResultsEl.style.display = 'none';
        showMessage('تم تحميل البيانات في النموذج');
      });
    });

  }catch(err){
    console.error('searchClient', err);
    searchResultsEl.innerHTML = '<div style="padding:10px;color:#c00">حدث خطأ أثناء البحث.</div>';
  }
}

/* تعبئة النموذج من نتيجة البحث */
function fillFormFromResult(idx){
  const it = lastSearchResults[idx];
  if(!it) return;
  if(it.region) regionField.value = it.region;
  nameField.value = it.name || '';
  phoneField.value = it.phone || it.mobileNo || '';
  crnField.value = it.crn || '';
  if(it.address) addressField.value = it.address;
  if(it.recorder || it.reporter) {
    const rec = it.recorder || it.reporter;
    const opt = Array.from(recorderSelect.options).find(o => o.text === rec);
    if(opt) recorderSelect.value = opt.value;
    else {
      recorderSelect.value = '__other__';
      recorderOther.style.display = 'block';
      recorderOther.value = rec;
    }
  }
}

/* أزرار البحث والمسح */
searchBtn.addEventListener('click', searchClient);
clearBtn.addEventListener('click', ()=>{
  searchInput.value = '';
  searchRegion.value = '';
  searchResultsEl.style.display = 'none';
  lastSearchResults = [];
});

/* دعم Enter في مربع البحث */
searchInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); searchClient(); } });

/* تحديث البيانات وقيم الفلتر */
refreshBtn.addEventListener('click', fetchData);
filterRegion.addEventListener('change', renderTables);

/* تهيئة أولية */
fetchData();
