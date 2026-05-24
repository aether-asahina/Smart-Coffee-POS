// ═══════════════════════════════════════════════════════════
//  script.js  —  Koes Coffee POS (All-in-one)
//  Gabungan: config + app + cart + chart
//  Pakai di index.html sebagai: <script type="module" src="script.js">
// ═══════════════════════════════════════════════════════════

// ═══════════════ FIREBASE IMPORTS ═══════════════
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, serverTimestamp, getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ═══════════════ FIREBASE INIT ═══════════════
const _app = initializeApp({
  apiKey:            "AIzaSyCeSqRWg0MNOq51EyKXerb9Yhc-Knzfo8k",
  authDomain:        "angkringan-12330.firebaseapp.com",
  projectId:         "angkringan-12330",
  storageBucket:     "angkringan-12330.firebasestorage.app",
  messagingSenderId: "630385630007",
  appId:             "1:630385630007:web:e19e29f1512705d704d8b2",
  measurementId:     "G-MHDVHFSF16",
});
const db   = getFirestore(_app);
const auth = getAuth(_app);

// ═══════════════ DATA MENU ═══════════════
// Edit menu dan harga di sini
const MENU_DATA = {
  "☕ Coffee": [
    { name:"Americano",           hot:14000, cold:15000 },
    { name:"Sanger",              hot:15000, cold:16000 },
    { name:"Kopi Susu Gula Aren", hot:16000, cold:17000 },
    { name:"Salted Caramel",      hot:16000, cold:18000 },
    { name:"Butterscotch Latte",  hot:16000, cold:18000 },
    { name:"Hazelnut Latte",      hot:16000, cold:18000 },
    { name:"Pandan Latte",        hot:16000, cold:18000 },
    { name:"Kopi Andalan Koes",   hot:null,  cold:20000 },
    { name:"Sanger Koes",         hot:null,  cold:18000 },
  ],
  "🍵 Non Coffee": [
    { name:"Cokelat Latte",    hot:16000, cold:17000 },
    { name:"Matcha Latte",     hot:16000, cold:17000 },
    { name:"Taro Latte",       hot:16000, cold:17000 },
    { name:"Red Velvet Latte", hot:16000, cold:17000 },
  ],
  "🍹 Mocktail": [
    { name:"Rainbow Blast", hot:null, cold:16000 },
    { name:"Blue Ocean",    hot:null, cold:16000 },
  ],
  "🍋 Tea": [
    { name:"Lemon Tea",  hot:14000, cold:15000 },
    { name:"Peach Tea",  hot:null,  cold:17000 },
    { name:"Lychee Tea", hot:null,  cold:17000 },
  ],
  "🥛 Yakult": [
    { name:"Matcha Yakult", hot:null, cold:20000 },
    { name:"Mango Yakult",  hot:null, cold:20000 },
  ],
};

const EXPENSE_QUICK = {
  "Serbuk":     ["Taro","Matcha","Red Velvet","Cokelat","Krimer"],
  "Syrup":      ["Sprite","Pandan","Karamel","Butterscotch","Hazelnut","Blueberry",
                 "Salted Caramel","Jeruk","Leci","Melon","Fanta","Gula Aren"],
  "Bahan Lain": ["UHT","Es Batu","Air Galon","Cup","SKM","Kopi"],
};

// ═══════════════ STATE ═══════════════
let transactions  = [];
let categories    = [
  { id:'c1', name:'Minuman',     type:'pemasukan'   },
  { id:'c2', name:'Makanan',     type:'pemasukan'   },
  { id:'c3', name:'Lainnya',     type:'keduanya'    },
  { id:'c4', name:'Bahan Baku',  type:'pengeluaran' },
  { id:'c5', name:'Operasional', type:'pengeluaran' },
  { id:'c6', name:'Gaji',        type:'pengeluaran' },
];
let currentType    = 'pemasukan';
let dashPeriod     = 'today';
let lapPeriod      = 'today';
let selectedPayment = 'cash';

// CART state (object: key → {name,temp,price,qty})
let cart          = {};
let activeCat     = Object.keys(MENU_DATA)[0];
let pendingMenu   = null;
let cartPayMethod = 'cash';

window.currentUserRole = 'viewer';

// ═══════════════ UTILS ═══════════════
const $       = id => document.getElementById(id);
const fmt     = n  => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtRp   = n  => 'Rp ' + Number(n).toLocaleString('id-ID');
const fmtDate = d  => new Date(d).toLocaleDateString('id-ID', {
  day:'2-digit', month:'short', year:'numeric',
  hour:'2-digit', minute:'2-digit',
});
const uid     = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const cartKey = (name, temp) => `${name}::${temp}`;

function startOfDay(d)   { const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d)  { const x=startOfDay(d); x.setDate(x.getDate()-x.getDay()); return x; }
function startOfMonth(d) { const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }

function filterByPeriod(list, period) {
  const now = new Date();
  return list.filter(t => {
    const d = new Date(t.date);
    if (period==='today') return d >= startOfDay(now);
    if (period==='week')  return d >= startOfWeek(now);
    if (period==='month') return d >= startOfMonth(now);
    return true;
  });
}
function sumBy(list, type) {
  return list.filter(t=>t.type===type).reduce((s,t)=>s+t.amount, 0);
}
function getCatName(id) {
  return (categories.find(c=>c.id===id) || { name: id||'—' }).name;
}

// ═══════════════ INIT ═══════════════
function initApp() {
  if ($('headerDate'))
    $('headerDate').textContent = new Date().toLocaleDateString('id-ID', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    });

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  if ($('txnDate')) $('txnDate').value = now.toISOString().slice(0,16);

  if (localStorage.getItem('koes_theme') === 'dark') {
    document.body.classList.add('dark');
    if ($('themeBtn')) $('themeBtn').textContent = '☀️';
  }

  populateCatSelect();
  renderCatList();
  renderMenuTabs();
  renderMenuGrid();
  renderExpenseGroups();
  renderCart();
  renderDash();
  renderRiwayat();
  renderLap();
}

// ═══════════════ NAVIGATION ═══════════════
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const el = $('page-' + id);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id==='riwayat')   renderRiwayat();
  if (id==='laporan')   renderLap();
  if (id==='dashboard') renderDash();
}

function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('koes_theme', isDark ? 'dark' : 'light');
  if ($('themeBtn')) $('themeBtn').textContent = isDark ? '☀️' : '🌙';
  renderFinanceChart();
}

// ═══════════════ TYPE & PAYMENT (FORM MANUAL) ═══════════════
function setType(t) {
  currentType = t;
  $('typeIncome') ?.classList.toggle('active', t==='pemasukan');
  $('typeExpense')?.classList.toggle('active', t==='pengeluaran');
  populateCatSelect();
}
function setPayMethod(m) {
  selectedPayment = m;
  $('payBtnCash')?.classList.toggle('active', m==='cash');
  $('payBtnQris')?.classList.toggle('active', m==='qris');
}

// ═══════════════ KATEGORI ═══════════════
function populateCatSelect() {
  const sel  = $('txnCat');
  const fSel = $('filterCat');
  if (!sel) return;
  const cats = categories.filter(c=>c.type===currentType||c.type==='keduanya');
  sel.innerHTML = cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if (fSel)
    fSel.innerHTML = '<option value="">Semua Kategori</option>' +
      categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function renderCatList() {
  const el = $('catList'); if (!el) return;
  el.innerHTML = categories.map(c=>`
    <span style="display:inline-flex;align-items:center;gap:.4rem;background:var(--cream);
      border:1px solid var(--border);border-radius:20px;padding:.25rem .75rem;font-size:.78rem;">
      ${c.name}
      <span style="font-size:.65rem;color:var(--text-soft);">(${c.type==='keduanya'?'semua':c.type})</span>
      <button onclick="deleteCat('${c.id}')"
        style="background:none;border:none;cursor:pointer;color:var(--red);font-size:.8rem;padding:0;margin-left:2px;">✕</button>
    </span>`).join('');
}

function addCategory() {
  const name = $('newCatName')?.value.trim();
  const type = $('newCatType')?.value;
  if (!name) { showToast('⚠ Nama kategori kosong'); return; }
  categories.push({ id:uid(), name, type });
  $('newCatName').value = '';
  renderCatList(); populateCatSelect();
  showToast('✓ Kategori ditambahkan');
}

function deleteCat(id) {
  categories = categories.filter(c=>c.id!==id);
  renderCatList(); populateCatSelect();
  showToast('Kategori dihapus');
}

// ═══════════════ SIMPAN TRANSAKSI → FIREBASE ═══════════════
async function saveTransaction() {
  if (window.currentUserRole==='viewer') { showToast('❌ Viewer tidak punya akses'); return; }
  const desc   = $('txnDesc')?.value.trim();
  const amount = parseFloat($('txnAmount')?.value);
  const catId  = $('txnCat')?.value;
  const date   = $('txnDate')?.value;
  const note   = $('txnNote')?.value.trim();
  if (!desc)         { showToast('⚠ Keterangan wajib diisi'); return; }
  if (!amount||amount<=0) { showToast('⚠ Jumlah harus lebih dari 0'); return; }
  if (!date)         { showToast('⚠ Tanggal wajib diisi'); return; }
  try {
    await addDoc(collection(db,'transaksi_angkringan'), {
      type:currentType, desc, amount, catId, date, note,
      payment:selectedPayment, createdAt:serverTimestamp(),
    });
    showToast('✓ Transaksi disimpan');
    resetForm();
    await loadTransactions();
    renderFinanceChart();
  } catch(e) { console.error(e); showToast('❌ Gagal simpan ke Firebase'); }
}

function resetForm() {
  if ($('txnDesc'))   $('txnDesc').value   = '';
  if ($('txnAmount')) $('txnAmount').value = '';
  if ($('txnNote'))   $('txnNote').value   = '';
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  if ($('txnDate'))   $('txnDate').value   = now.toISOString().slice(0,16);
  setType('pemasukan');
}

// ═══════════════ HAPUS → FIREBASE ═══════════════
async function hapusDariFirebase(docId) {
  if (window.currentUserRole!=='admin') { showToast('❌ Hanya admin yang bisa menghapus'); return; }
  if (!confirm('Hapus transaksi ini dari database?')) return;
  try {
    await deleteDoc(doc(db,'transaksi_angkringan',docId));
    showToast('✓ Berhasil dihapus');
    await loadTransactions();
  } catch(e) { console.error(e); showToast('❌ Gagal menghapus'); }
}

// ═══════════════ PENGELUARAN CEPAT ═══════════════
async function quickExpense(name) {
  if (window.currentUserRole==='viewer') { showToast('❌ Viewer tidak punya akses'); return; }
  const amt = prompt(`Jumlah pengeluaran untuk "${name}" (Rp)?`);
  if (!amt||isNaN(amt)) return;
  try {
    await addDoc(collection(db,'transaksi_angkringan'), {
      type:'pengeluaran', desc:`Beli ${name}`, amount:parseFloat(amt),
      catId:'c4', date:new Date().toISOString().slice(0,16),
      note:'', payment:'cash', createdAt:serverTimestamp(),
    });
    showToast(`✓ Pengeluaran ${name} disimpan`);
    await loadTransactions();
  } catch(e) { console.error(e); showToast('❌ Gagal simpan'); }
}

async function saveOtherExpense() {
  if (window.currentUserRole==='viewer') { showToast('❌ Viewer tidak punya akses'); return; }
  const name = $('otherExpName')?.value.trim();
  const amt  = parseFloat($('otherExpAmt')?.value);
  if (!name||!amt) { showToast('⚠ Isi nama dan jumlah'); return; }
  try {
    await addDoc(collection(db,'transaksi_angkringan'), {
      type:'pengeluaran', desc:name, amount:amt,
      catId:'c5', date:new Date().toISOString().slice(0,16),
      note:'', payment:'cash', createdAt:serverTimestamp(),
    });
    if ($('otherExpName')) $('otherExpName').value = '';
    if ($('otherExpAmt'))  $('otherExpAmt').value  = '';
    showToast('✓ Pengeluaran tersimpan');
    await loadTransactions();
  } catch(e) { console.error(e); showToast('❌ Gagal simpan'); }
}

// ═══════════════ LOAD DATA DARI FIREBASE ═══════════════
async function loadTransactions() {
  try {
    const snap = await getDocs(collection(db,'transaksi_angkringan'));
    transactions = [];
    snap.forEach(d => transactions.push({ id:d.id, ...d.data() }));
    transactions.sort((a,b) => new Date(b.date) - new Date(a.date));
    window._txArr = transactions;

    let cash=0, qris=0;
    transactions.forEach(t => {
      if (t.type==='pemasukan') {
        if (t.payment==='cash') cash += Number(t.amount);
        if (t.payment==='qris') qris += Number(t.amount);
      }
    });
    if ($('cashTotal')) $('cashTotal').textContent = 'Rp ' + cash.toLocaleString('id-ID');
    if ($('qrisTotal')) $('qrisTotal').textContent = 'Rp ' + qris.toLocaleString('id-ID');

    renderDash(); renderRiwayat(); renderLap();
  } catch(e) { console.error(e); showToast('❌ Gagal load data Firebase'); }
}

// ═══════════════ DASHBOARD ═══════════════
function setDashPeriod(p, btn) {
  dashPeriod = p;
  document.querySelectorAll('#dashPeriod .period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const labels = { today:'Hari Ini', week:'Minggu Ini', month:'Bulan Ini', all:'Semua Waktu' };
  if ($('dashPeriodLabel')) $('dashPeriodLabel').textContent = '— ' + labels[p];
  renderDash();
}

function renderDash() {
  const list  = filterByPeriod(transactions, dashPeriod);
  const inc   = sumBy(list,'pemasukan');
  const exp   = sumBy(list,'pengeluaran');
  const net   = inc - exp;
  const modal = inc>0 ? (net/inc*100).toFixed(1) : '0.0';

  if ($('dashCards')) $('dashCards').innerHTML = `
    <div class="card income">
      <div class="card-label">Total Pemasukan</div>
      <div class="card-value green">${fmt(inc)}</div>
      <div class="card-sub">${list.filter(t=>t.type==='pemasukan').length} transaksi</div>
    </div>
    <div class="card expense">
      <div class="card-label">Total Pengeluaran</div>
      <div class="card-value red">${fmt(exp)}</div>
      <div class="card-sub">${list.filter(t=>t.type==='pengeluaran').length} transaksi</div>
    </div>
    <div class="card profit">
      <div class="card-label">Laba Bersih</div>
      <div class="card-value ${net>=0?'green':'red'}">${net>=0?'':'-'}${fmt(net)}</div>
      <div class="card-sub">${list.length} total transaksi</div>
    </div>
    <div class="card modal-profit">
      <div class="card-label">Margin Laba</div>
      <div class="card-value ${net>=0?'amber':'red'}">${modal}%</div>
      <div class="card-sub">net / pemasukan</div>
    </div>`;

  const max = Math.max(inc, exp, 1);
  if ($('dashChart'))
    $('dashChart').innerHTML = (buildCatBar(list,'pemasukan',max) + buildCatBar(list,'pengeluaran',max))
      || '<div style="color:var(--text-soft);font-size:.85rem;padding:1rem 0;">Belum ada data.</div>';

  if ($('dashTbody'))
    $('dashTbody').innerHTML = list.slice(0,10).map(t=>`
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:.75rem;">${fmtDate(t.date)}</td>
        <td>${t.desc}</td>
        <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${getCatName(t.catId)}</span></td>
        <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'Masuk':'Keluar'}</span></td>
        <td class="amount-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'+':'-'}${fmt(t.amount)}</td>
      </tr>`).join('')
      || `<tr><td colspan="5"><div class="empty"><div class="empty-icon">☕</div><div class="empty-text">Belum ada transaksi</div></div></td></tr>`;
}

function buildCatBar(list, type, max) {
  const cats = {};
  list.filter(t=>t.type===type).forEach(t=>{ const n=getCatName(t.catId); cats[n]=(cats[n]||0)+t.amount; });
  return Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([name,val])=>`
    <div class="bar-row">
      <div class="bar-label">${name}</div>
      <div class="bar-track"><div class="bar-fill ${type==='pemasukan'?'income':'expense'}" style="width:${Math.round(val/max*100)}%"></div></div>
      <div class="bar-val">${fmt(val)}</div>
    </div>`).join('');
}

// ═══════════════ RIWAYAT ═══════════════
function renderRiwayat() {
  let list = [...transactions];
  const q    = $('searchRiwayat')?.value.toLowerCase() || '';
  const type = $('filterType')?.value                  || '';
  const cat  = $('filterCat')?.value                   || '';
  const from = $('filterDateFrom')?.value              || '';
  const to   = $('filterDateTo')?.value                || '';

  if (q)    list = list.filter(t=>t.desc.toLowerCase().includes(q));
  if (type) list = list.filter(t=>t.type===type);
  if (cat)  list = list.filter(t=>t.catId===cat);
  if (from) list = list.filter(t=>t.date>=from);
  if (to)   list = list.filter(t=>t.date<=to+'T23:59');

  const body  = $('riwayatTbody');
  const empty = $('historyEmpty');
  if (empty) empty.style.display = list.length ? 'none' : 'block';
  if (!body) return;

  body.innerHTML = list.map(t=>`
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:.75rem;">${fmtDate(t.date)}</td>
      <td>
        <div style="font-weight:600;">${t.desc}</div>
        ${t.note?`<div style="font-size:.75rem;color:var(--text-soft);">${t.note}</div>`:''}
      </td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${getCatName(t.catId)}</span></td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'Masuk':'Keluar'}</span></td>
      <td><span class="badge">${(t.payment||'').toUpperCase()||'-'}</span></td>
      <td class="amount-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'+':'-'}${fmt(t.amount)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="hapusDariFirebase('${t.id}')">✕</button></td>
    </tr>`).join('');
}

// ═══════════════ LAPORAN ═══════════════
function setLapPeriod(p, btn) {
  lapPeriod = p;
  document.querySelectorAll('#lapPeriod .period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderLap();
}

function renderLap() {
  const list  = filterByPeriod(transactions, lapPeriod);
  const inc   = sumBy(list,'pemasukan');
  const exp   = sumBy(list,'pengeluaran');
  const net   = inc - exp;
  const modal = inc>0 ? (net/inc*100).toFixed(1) : '0.0';

  if ($('lapCards')) $('lapCards').innerHTML = `
    <div class="card income">   <div class="card-label">Pemasukan</div>   <div class="card-value green">${fmt(inc)}</div></div>
    <div class="card expense">  <div class="card-label">Pengeluaran</div> <div class="card-value red">${fmt(exp)}</div></div>
    <div class="card profit">   <div class="card-label">Laba Bersih</div> <div class="card-value ${net>=0?'green':'red'}">${net>=0?'':'-'}${fmt(net)}</div></div>
    <div class="card modal-profit"><div class="card-label">Margin</div>   <div class="card-value ${net>=0?'amber':'red'}">${modal}%</div></div>`;

  const renderCats = (type, elId) => {
    const cats = {};
    list.filter(t=>t.type===type).forEach(t=>{ const n=getCatName(t.catId); cats[n]=(cats[n]||0)+t.amount; });
    const total = Object.values(cats).reduce((s,v)=>s+v,0)||1;
    const el = $(elId); if (!el) return;
    el.innerHTML = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`
      <div class="cat-row">
        <span class="cat-name">${n}</span>
        <span class="cat-amount ${type==='pemasukan'?'amount-income':'amount-expense'}">
          ${fmt(v)} <span style="font-size:.65rem;color:var(--text-soft);">(${(v/total*100).toFixed(0)}%)</span>
        </span>
      </div>`).join('') || '<div style="color:var(--text-soft);font-size:.85rem;">Tidak ada data</div>';
  };
  renderCats('pemasukan',   'lapIncCat');
  renderCats('pengeluaran', 'lapExpCat');

  const days = {};
  list.forEach(t=>{
    const d = new Date(t.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
    if (!days[d]) days[d]={inc:0,exp:0};
    if (t.type==='pemasukan') days[d].inc+=t.amount; else days[d].exp+=t.amount;
  });
  const dayEntries = Object.entries(days).slice(-14);
  const maxVal = Math.max(...dayEntries.flatMap(([,v])=>[v.inc,v.exp]),1);
  const labels = { today:'Hari Ini', week:'Minggu Ini', month:'Bulan Ini', all:'Semua' };
  if ($('lapTrenLabel')) $('lapTrenLabel').textContent = '— ' + labels[lapPeriod];
  if ($('lapTren'))
    $('lapTren').innerHTML = dayEntries.map(([d,v])=>`
      <div style="margin-bottom:.25rem;">
        <div style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--text-soft);margin-bottom:.2rem;">${d}</div>
        <div class="bar-row"><div class="bar-label" style="min-width:70px;">Masuk</div><div class="bar-track"><div class="bar-fill income" style="width:${Math.round(v.inc/maxVal*100)}%"></div></div><div class="bar-val">${fmt(v.inc)}</div></div>
        <div class="bar-row"><div class="bar-label" style="min-width:70px;">Keluar</div><div class="bar-track"><div class="bar-fill expense" style="width:${Math.round(v.exp/maxVal*100)}%"></div></div><div class="bar-val">${fmt(v.exp)}</div></div>
      </div>`).join('')
      || '<div style="color:var(--text-soft);font-size:.85rem;">Belum ada data.</div>';
}

// ═══════════════ EXPORT CSV ═══════════════
function exportCSV() {
  const rows = [['Tanggal','Keterangan','Kategori','Tipe','Metode','Jumlah','Catatan'],
    ...transactions.map(t=>[
      new Date(t.date).toLocaleString('id-ID'),
      `"${t.desc.replace(/"/g,'""')}"`,
      getCatName(t.catId), t.type, t.payment||'', t.amount,
      `"${(t.note||'').replace(/"/g,'""')}"`])];
  const blob = new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `koes-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('✓ CSV berhasil diunduh');
}

// ═══════════════ MENU TABS & GRID (CART) ═══════════════
function renderMenuTabs() {
  const el = $('catTabs'); if (!el) return;
  el.innerHTML = Object.keys(MENU_DATA).map(cat=>`
    <button class="cat-tab ${cat===activeCat?'active':''}"
      onclick="switchCat('${cat.replace(/'/g,"\\'")}',this)">${cat}</button>`).join('');
}

function switchCat(cat, btn) {
  activeCat = cat;
  document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderMenuGrid();
}

function renderMenuGrid() {
  const el = $('menuGrid'); if (!el) return;
  el.innerHTML = (MENU_DATA[activeCat]||[]).map(item=>{
    const hq  = cart[cartKey(item.name,'hot')]?.qty  || 0;
    const cq  = cart[cartKey(item.name,'cold')]?.qty || 0;
    const tq  = hq + cq;
    const pl  = item.hot && item.cold
      ? `${fmtRp(item.hot)} / ${fmtRp(item.cold)}`
      : fmtRp(item.hot || item.cold);
    return `<div class="menu-card" onclick="menuClick('${item.name.replace(/'/g,"\\'")}')">
      ${tq>0?`<span class="in-cart-badge">${tq}×</span>`:''}
      <h3>${item.name}</h3><p>${pl}</p></div>`;
  }).join('');
}

function renderExpenseGroups() {
  const el = $('expenseGroups'); if (!el) return;
  el.innerHTML = Object.entries(EXPENSE_QUICK).map(([group,items])=>`
    <div class="expense-group"><h3>${group}</h3>
    <div class="expense-items">${items.map(i=>`<div class="expense-item" onclick="quickExpense('${i}')">${i}</div>`).join('')}</div>
    </div>`).join('')
  + `<div class="expense-group"><h3>Pengeluaran Lain</h3>
      <div class="form-row">
        <div class="form-group"><label>Nama</label><input type="text" id="otherExpName" placeholder="Nama bahan..."/></div>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="otherExpAmt" placeholder="0" min="0"/></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary btn-sm" onclick="saveOtherExpense()">+ Tambah</button></div>
    </div>`;
}

// ═══════════════ CART OPERATIONS ═══════════════
function addToCart(item, temp) {
  const price = temp==='hot' ? item.hot : item.cold;
  if (!price||price<=0) { showToast('⚠ Menu tidak tersedia'); return; }
  const key = cartKey(item.name, temp);
  if (cart[key]) cart[key].qty++; else cart[key]={name:item.name,temp,price,qty:1};
  renderCart(); renderMenuGrid();
}

function removeFromCart(key) {
  if (!cart[key]) return;
  cart[key].qty--;
  if (cart[key].qty<=0) delete cart[key];
  renderCart(); renderMenuGrid();
}

function addQtyCart(key) {
  if (cart[key]) { cart[key].qty++; renderCart(); renderMenuGrid(); }
}

function clearCart() { cart={}; renderCart(); renderMenuGrid(); }

function renderCart() {
  const entries    = Object.entries(cart);
  const totalItems = entries.reduce((s,[,v])=>s+v.qty, 0);
  const totalPrice = entries.reduce((s,[,v])=>s+v.price*v.qty, 0);

  if ($('cartBadge'))   $('cartBadge').textContent  = totalItems;
  if ($('orderTotal'))  $('orderTotal').textContent  = fmtRp(totalPrice);
  if ($('btnSubmitOrder')) $('btnSubmitOrder').disabled = entries.length===0;

  const emptyEl = $('cartEmpty'), listEl = $('cartItems');
  if (!listEl) return;
  if (entries.length===0) {
    if (emptyEl) emptyEl.style.display='block';
    listEl.innerHTML=''; return;
  }
  if (emptyEl) emptyEl.style.display='none';
  listEl.innerHTML = entries.map(([key,v])=>`
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${v.name}</div>
        <div class="cart-item-temp ${v.temp}">${v.temp==='hot'?'🔥 Hot':'❄️ Cold'} · ${fmtRp(v.price)}</div>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="removeFromCart('${key}')">−</button>
        <span class="qty-num">${v.qty}</span>
        <button class="qty-btn" onclick="addQtyCart('${key}')">+</button>
      </div>
      <div class="cart-item-price">${fmtRp(v.price*v.qty)}</div>
    </div>`).join('');
}

function setOrderPay(m) {
  cartPayMethod = m;
  $('orderPayCash')?.classList.toggle('active-cash', m==='cash');
  $('orderPayQris')?.classList.toggle('active-qris', m==='qris');
}

// ═══════════════ SUBMIT ORDER → FIREBASE ═══════════════
async function submitOrder() {
  if (window.currentUserRole==='viewer') { showToast('❌ Viewer tidak punya akses'); return; }
  const entries = Object.entries(cart);
  if (!entries.length) { showToast('⚠ Keranjang masih kosong!'); return; }

  const tableNote = $('orderTable')?.value.trim() || '';
  const extraNote = $('orderNote')?.value.trim()  || '';
  const now       = new Date().toISOString().slice(0,16);
  const batchId   = Date.now().toString(36);
  const note      = [tableNote?`Meja: ${tableNote}`:'', extraNote, `Batch: ${batchId}`]
                    .filter(Boolean).join(' | ');
  try {
    await Promise.all(entries.map(([,v])=>addDoc(collection(db,'transaksi_angkringan'),{
      type:'pemasukan',
      desc:`${v.name} (${v.temp.toUpperCase()})${v.qty>1?' ×'+v.qty:''}`,
      amount:v.price*v.qty, catId:'c1', date:now, note,
      payment:cartPayMethod, createdAt:serverTimestamp(),
    })));
    const total = entries.reduce((s,[,v])=>s+v.price*v.qty,0);
    showToast(`✓ ${entries.length} item → ${fmtRp(total)}`);
    clearCart();
    if ($('orderTable')) $('orderTable').value='';
    if ($('orderNote'))  $('orderNote').value='';
    await loadTransactions();
    renderFinanceChart();
  } catch(e) { console.error(e); showToast('❌ Gagal simpan ke Firebase'); }
}

// ═══════════════ HOT/COLD MODAL ═══════════════
function menuClick(name) {
  const item = Object.values(MENU_DATA).flat().find(i=>i.name===name);
  if (!item) return;
  const hasHot  = item.hot  && item.hot  > 0;
  const hasCold = item.cold && item.cold > 0;
  if (hasHot && !hasCold) { addToCart(item,'hot');  return; }
  if (hasCold && !hasHot) { addToCart(item,'cold'); return; }
  pendingMenu = item;
  if ($('tempMenuTitle')) $('tempMenuTitle').textContent = item.name;
  $('tempModal')?.classList.add('active');
}
function chooseTemp(temp) { if (pendingMenu) addToCart(pendingMenu,temp); closeTempModal(); }
function closeTempModal() { $('tempModal')?.classList.remove('active'); pendingMenu=null; }

// ═══════════════ TOAST ═══════════════
let toastTimer;
function showToast(msg) {
  const el=$('toast'); if (!el) return;
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

// ═══════════════ AUTH ═══════════════
async function login() {
  const email=$('loginUser')?.value.trim(), pass=$('loginPass')?.value.trim();
  if (!email||!pass) { showToast('Isi email dan password'); return; }
  try { await signInWithEmailAndPassword(auth,email,pass); showToast('✓ Login berhasil'); }
  catch(e) { console.error(e); showToast('❌ '+e.message); }
}

async function logout() {
  await signOut(auth); showToast('✓ Berhasil keluar');
}

onAuthStateChanged(auth, async(user)=>{
  const loginEl=$('loginPage'), appEl=$('appShell');
  if (!user) {
    if (loginEl) loginEl.style.display='flex';
    if (appEl)   appEl.style.display='none';
    return;
  }
  try {
    const snap = await getDoc(doc(db,'users',user.uid));
    window.currentUserRole = snap.exists() ? (snap.data().role||'viewer') : 'viewer';
  } catch { window.currentUserRole='viewer'; }

  applyRoleSystem();
  if (loginEl) loginEl.style.display='none';
  if (appEl)   appEl.style.display='block';
  initApp();
  await loadTransactions();
  setTimeout(()=>renderFinanceChart(), 300);
});

function applyRoleSystem() {
  if (window.currentUserRole==='viewer') {
    document.querySelectorAll('nav button').forEach(btn=>{
      if (btn.textContent.includes('Jual')) btn.style.display='none';
    });
    document.querySelectorAll('.btn-danger,.btn-primary,.type-btn,.expense-item,.menu-card')
      .forEach(el=>el.style.display='none');
  }
}

// ═══════════════ CHART.JS ═══════════════
function renderFinanceChart() {
  const ctx = $('financeChart'); if (!ctx) return;
  const txArr=window._txArr||[], labels=[], incomeData=[], expenseData=[];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    labels.push(d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit'}));
    const key=d.toISOString().split('T')[0];
    let inc=0,exp=0;
    txArr.forEach(t=>{
      if (t.date&&t.date.startsWith(key)) {
        if (t.type==='pemasukan') inc+=Number(t.amount); else exp+=Number(t.amount);
      }
    });
    incomeData.push(inc); expenseData.push(exp);
  }
  if (window.financeChartInstance) { window.financeChartInstance.destroy(); window.financeChartInstance=null; }
  const isDark=document.body.classList.contains('dark');
  window.financeChartInstance = new Chart(ctx,{
    type:'line',
    data:{ labels, datasets:[
      {label:'Pemasukan', data:incomeData, borderColor:'#48ff00', backgroundColor:'rgba(72,255,0,0.15)', tension:0.4, fill:true, pointRadius:4},
      {label:'Pengeluaran',data:expenseData,borderColor:'#ff3b3b',backgroundColor:'rgba(255,59,59,0.12)',tension:0.4, fill:true, pointRadius:4},
    ]},
    options:{
      responsive:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:isDark?'#fff':'#222',font:{family:'DM Mono'}}},
        tooltip:{callbacks:{label:ctx=>' Rp '+ctx.parsed.y.toLocaleString('id-ID')}},
      },
      scales:{
        x:{ticks:{color:isDark?'#ccc':'#444',font:{family:'DM Mono',size:11}},grid:{color:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'}},
        y:{ticks:{color:isDark?'#ccc':'#444',font:{family:'DM Mono',size:11},callback:v=>'Rp '+Number(v).toLocaleString('id-ID')},grid:{color:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'}},
      },
    },
  });
}

// ═══════════════ EXPOSE KE WINDOW ═══════════════
Object.assign(window, {
  login, logout, showPage, toggleDark,
  setType, setPayMethod, saveTransaction, resetForm,
  addCategory, deleteCat, populateCatSelect, renderCatList,
  setDashPeriod, setLapPeriod, renderRiwayat, exportCSV,
  hapusDariFirebase, loadTransactions, showToast, renderFinanceChart,
  switchCat, menuClick, addToCart, removeFromCart, addQtyCart,
  clearCart, renderCart, submitOrder, setOrderPay,
  chooseTemp, closeTempModal, quickExpense, saveOtherExpense,
});
