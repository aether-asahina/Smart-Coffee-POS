// ═══════════════════════════════════════════
//  js/app.js  —  Logika Utama Aplikasi
//  Dashboard, Riwayat, Laporan, Kategori, Auth
// ═══════════════════════════════════════════

import {
  db, auth,
  collection, addDoc, getDocs, deleteDoc,
  doc, serverTimestamp, getDoc,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from './config.js';

// ── State ──────────────────────────────────
let transactions     = [];
let categories       = [
  { id:'c1', name:'Minuman',    type:'pemasukan'  },
  { id:'c2', name:'Makanan',    type:'pemasukan'  },
  { id:'c3', name:'Lainnya',    type:'keduanya'   },
  { id:'c4', name:'Bahan Baku', type:'pengeluaran'},
  { id:'c5', name:'Operasional',type:'pengeluaran'},
  { id:'c6', name:'Gaji',       type:'pengeluaran'},
];
let currentType    = 'pemasukan';
let dashPeriod     = 'today';
let lapPeriod      = 'today';
let selectedPayment = 'cash';

// Diakses oleh cart.js via window
window.currentUserRole = 'viewer';

// ── Utils ──────────────────────────────────
const fmt     = n  => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtDate = d  => new Date(d).toLocaleDateString('id-ID', {
  day:'2-digit', month:'short', year:'numeric',
  hour:'2-digit', minute:'2-digit',
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

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
  return list.filter(t => t.type===type).reduce((s,t) => s + t.amount, 0);
}

function getCatName(id) {
  return (categories.find(c => c.id===id) || { name:'—' }).name;
}

// ── Init ───────────────────────────────────
function init() {
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('id-ID', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    });

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('txDate').value = now.toISOString().slice(0,16);

  // Tema tersimpan
  if (localStorage.getItem('koes_theme') === 'dark') {
    document.body.classList.add('dark');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = '☀️';
  }

  populateCatSelect();
  renderCatList();
  renderDashboard();
  renderHistory();
  renderLaporan();
}

// ── Navigation ─────────────────────────────
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const idx = { dashboard:0, transaksi:1, riwayat:2, laporan:3 }[p];
  document.querySelectorAll('nav button')[idx]?.classList.add('active');
  if (p === 'riwayat')  renderHistory();
  if (p === 'laporan')  renderLaporan();
  if (p === 'transaksi') { renderCatList(); populateCatSelect(); }
}

// ── Type Toggle (form manual) ──────────────
function setType(t) {
  currentType = t;
  document.getElementById('typeIncome') ?.classList.toggle('active', t==='pemasukan');
  document.getElementById('typeExpense')?.classList.toggle('active', t==='pengeluaran');
  populateCatSelect();
}

// ── Categories ─────────────────────────────
function populateCatSelect() {
  const sel  = document.getElementById('txCat');
  const fSel = document.getElementById('filterCat');
  if (!sel) return;

  const cats = categories.filter(c => c.type===currentType || c.type==='keduanya');
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  if (fSel) {
    fSel.innerHTML = '<option value="">Semua Kategori</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

function renderCatList() {
  document.getElementById('catList').innerHTML = categories.map(c => `
    <span style="display:inline-flex;align-items:center;gap:.4rem;background:var(--cream);
      border:1px solid var(--border);border-radius:20px;padding:.25rem .75rem;font-size:.78rem;">
      ${c.name}
      <span style="font-size:.65rem;color:var(--text-soft);">
        (${c.type==='keduanya' ? 'semua' : c.type})
      </span>
      <button onclick="deleteCat('${c.id}')"
        style="background:none;border:none;cursor:pointer;color:var(--red);font-size:.8rem;padding:0;margin-left:2px;">✕
      </button>
    </span>
  `).join('');
}

function addCategory() {
  const name = document.getElementById('newCatName').value.trim();
  const type = document.getElementById('newCatType').value;
  if (!name) { showToast('⚠ Nama kategori tidak boleh kosong'); return; }
  categories.push({ id: uid(), name, type });
  document.getElementById('newCatName').value = '';
  renderCatList();
  populateCatSelect();
  showToast('✓ Kategori ditambahkan');
}

function deleteCat(id) {
  categories = categories.filter(c => c.id !== id);
  renderCatList();
  populateCatSelect();
  showToast('Kategori dihapus');
}

// ── Simpan Transaksi Manual ────────────────
async function saveTransaction() {
  if (window.currentUserRole === 'viewer') {
    showToast('❌ Viewer tidak punya akses'); return;
  }
  const desc   = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const catId  = document.getElementById('txCat').value;
  const date   = document.getElementById('txDate').value;
  const note   = document.getElementById('txNote').value.trim();

  if (!desc)         { showToast('⚠ Keterangan wajib diisi'); return; }
  if (!amount || amount <= 0) { showToast('⚠ Jumlah harus lebih dari 0'); return; }
  if (!date)         { showToast('⚠ Tanggal wajib diisi'); return; }

  try {
    await addDoc(collection(db, 'transaksi_angkringan'), {
      type: currentType, desc, amount, catId, date, note,
      payment: selectedPayment, createdAt: serverTimestamp(),
    });
    showToast('✓ Transaksi disimpan');
    clearForm();
    await loadTransactions();
    if (typeof window.renderFinanceChart === 'function') window.renderFinanceChart();
  } catch (err) {
    console.error(err);
    showToast('❌ Gagal simpan ke Firebase');
  }
}

function clearForm() {
  document.getElementById('txDesc').value   = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txNote').value   = '';
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('txDate').value = now.toISOString().slice(0,16);
  setType('pemasukan');
}

// ── Hapus Transaksi ────────────────────────
const hapusDariFirebase = async function(docId) {
  if (window.currentUserRole !== 'admin') {
    showToast('❌ Hanya admin yang bisa menghapus'); return;
  }
  if (!confirm('Hapus transaksi ini dari database cloud?')) return;
  try {
    await deleteDoc(doc(db, 'transaksi_angkringan', docId));
    showToast('✓ Berhasil dihapus');
    await loadTransactions();
  } catch (err) {
    console.error(err);
    showToast('❌ Gagal menghapus data');
  }
};

// ── Pengeluaran Cepat ──────────────────────
function quickExpense(name) {
  setType('pengeluaran');
  document.getElementById('txDesc').value = name;
  const catSelect = document.getElementById('txCat');
  if (catSelect) catSelect.value = 'c4';
  document.getElementById('txAmount').focus();
  showToast('Isi nominal untuk ' + name);
  // Scroll ke form manual
  document.querySelector('.manual-form')?.scrollIntoView({ behavior:'smooth' });
}

function customExpense() {
  const val = document.getElementById('customExpenseInput').value.trim();
  if (!val) { alert('Isi dulu pengeluarannya'); return; }
  quickExpense(val);
  document.getElementById('customExpenseInput').value = '';
}

// ── Dashboard ──────────────────────────────
function setDashPeriod(p, btn) {
  dashPeriod = p;
  document.querySelectorAll('#dashPeriod .period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const labels = { today:'Hari Ini', week:'Minggu Ini', month:'Bulan Ini', all:'Semua Waktu' };
  document.getElementById('dashPeriodLabel').textContent = '— ' + labels[p];
  renderDashboard();
}

function renderDashboard() {
  const list  = filterByPeriod(transactions, dashPeriod);
  const inc   = sumBy(list, 'pemasukan');
  const exp   = sumBy(list, 'pengeluaran');
  const net   = inc - exp;
  const modal = inc > 0 ? (net/inc*100).toFixed(1) : '0.0';

  document.getElementById('dashCards').innerHTML = `
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
    </div>
  `;

  const max     = Math.max(inc, exp, 1);
  const incRows = buildCatBar(list, 'pemasukan',   max);
  const expRows = buildCatBar(list, 'pengeluaran', max);
  document.getElementById('dashChart').innerHTML = (incRows + expRows) ||
    '<div style="color:var(--text-soft);font-size:.85rem;padding:1rem 0;">Belum ada data untuk periode ini.</div>';

  // Terbaru 5
  document.getElementById('dashRecent').innerHTML = list.slice(0, 5).map(t => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:.75rem;">${fmtDate(t.date)}</td>
      <td>${t.desc}</td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${getCatName(t.catId)}</span></td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'Masuk':'Keluar'}</span></td>
      <td class="amount-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'+':'-'}${fmt(t.amount)}</td>
    </tr>
  `).join('') || `<tr><td colspan="5"><div class="empty">
    <div class="empty-icon">☕</div>
    <div class="empty-text">Belum ada transaksi</div>
  </div></td></tr>`;
}

function buildCatBar(list, type, max) {
  const cats = {};
  list.filter(t => t.type===type).forEach(t => {
    const n = getCatName(t.catId);
    cats[n] = (cats[n] || 0) + t.amount;
  });
  return Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
    <div class="bar-row">
      <div class="bar-label">${name}</div>
      <div class="bar-track">
        <div class="bar-fill ${type==='pemasukan'?'income':'expense'}"
          style="width:${Math.round(val/max*100)}%"></div>
      </div>
      <div class="bar-val">${fmt(val)}</div>
    </div>
  `).join('');
}

// ── Riwayat ────────────────────────────────
function renderHistory() {
  let list = [...transactions];
  const q    = document.getElementById('searchQ')?.value.toLowerCase()      || '';
  const type = document.getElementById('filterType')?.value                 || '';
  const cat  = document.getElementById('filterCat')?.value                  || '';
  const from = document.getElementById('filterDateFrom')?.value             || '';
  const to   = document.getElementById('filterDateTo')?.value               || '';

  if (q)    list = list.filter(t => t.desc.toLowerCase().includes(q));
  if (type) list = list.filter(t => t.type   === type);
  if (cat)  list = list.filter(t => t.catId  === cat);
  if (from) list = list.filter(t => t.date   >= from);
  if (to)   list = list.filter(t => t.date   <= to + 'T23:59');

  const body  = document.getElementById('historyBody');
  const empty = document.getElementById('historyEmpty');
  if (empty) empty.style.display = list.length ? 'none' : 'block';
  if (!body) return;

  body.innerHTML = list.map(t => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:.75rem;">${fmtDate(t.date)}</td>
      <td><div style="font-weight:600;">${t.desc}</div>
          ${t.note ? `<div style="font-size:.75rem;color:var(--text-soft);">${t.note}</div>` : ''}
      </td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${getCatName(t.catId)}</span></td>
      <td><span class="badge badge-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'Masuk':'Keluar'}</span></td>
      <td class="amount-${t.type==='pemasukan'?'income':'expense'}">${t.type==='pemasukan'?'+':'-'}${fmt(t.amount)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="hapusDariFirebase('${t.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

// ── Laporan ────────────────────────────────
function setLapPeriod(p, btn) {
  lapPeriod = p;
  document.querySelectorAll('#lapPeriod .period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLaporan();
}

function renderLaporan() {
  const list  = filterByPeriod(transactions, lapPeriod);
  const inc   = sumBy(list, 'pemasukan');
  const exp   = sumBy(list, 'pengeluaran');
  const net   = inc - exp;
  const modal = inc > 0 ? (net/inc*100).toFixed(1) : '0.0';

  document.getElementById('lapCards').innerHTML = `
    <div class="card income">  <div class="card-label">Pemasukan</div>  <div class="card-value green">${fmt(inc)}</div></div>
    <div class="card expense"> <div class="card-label">Pengeluaran</div><div class="card-value red">${fmt(exp)}</div></div>
    <div class="card profit">  <div class="card-label">Laba Bersih</div><div class="card-value ${net>=0?'green':'red'}">${net>=0?'':'-'}${fmt(net)}</div></div>
    <div class="card modal-profit"><div class="card-label">Margin</div> <div class="card-value ${net>=0?'amber':'red'}">${modal}%</div></div>
  `;

  const renderCats = (type, elId) => {
    const cats  = {};
    list.filter(t => t.type===type).forEach(t => {
      const n = getCatName(t.catId); cats[n] = (cats[n]||0) + t.amount;
    });
    const total = Object.values(cats).reduce((s,v) => s+v, 0) || 1;
    document.getElementById(elId).innerHTML = Object.entries(cats)
      .sort((a,b) => b[1]-a[1])
      .map(([n,v]) => `
        <div class="cat-row">
          <span class="cat-name">${n}</span>
          <span class="cat-amount ${type==='pemasukan'?'amount-income':'amount-expense'}">
            ${fmt(v)}
            <span style="font-size:.65rem;color:var(--text-soft);">(${(v/total*100).toFixed(0)}%)</span>
          </span>
        </div>
      `).join('') || '<div style="color:var(--text-soft);font-size:.85rem;">Tidak ada data</div>';
  };
  renderCats('pemasukan',   'lapIncCat');
  renderCats('pengeluaran', 'lapExpCat');

  // Tren harian
  const days = {};
  list.forEach(t => {
    const d = new Date(t.date).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    if (!days[d]) days[d] = { inc:0, exp:0 };
    if (t.type==='pemasukan') days[d].inc += t.amount;
    else                      days[d].exp += t.amount;
  });
  const dayEntries = Object.entries(days).slice(-14);
  const maxVal     = Math.max(...dayEntries.flatMap(([,v]) => [v.inc, v.exp]), 1);
  const labels     = { today:'Hari Ini', week:'Minggu Ini', month:'Bulan Ini', all:'Semua' };
  document.getElementById('lapTrenLabel').textContent = '— ' + labels[lapPeriod];

  document.getElementById('lapTren').innerHTML = dayEntries.length
    ? dayEntries.map(([d,v]) => `
        <div style="margin-bottom:.25rem;">
          <div style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--text-soft);margin-bottom:.2rem;">${d}</div>
          <div class="bar-row">
            <div class="bar-label" style="min-width:70px;">Masuk</div>
            <div class="bar-track"><div class="bar-fill income" style="width:${Math.round(v.inc/maxVal*100)}%"></div></div>
            <div class="bar-val">${fmt(v.inc)}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label" style="min-width:70px;">Keluar</div>
            <div class="bar-track"><div class="bar-fill expense" style="width:${Math.round(v.exp/maxVal*100)}%"></div></div>
            <div class="bar-val">${fmt(v.exp)}</div>
          </div>
        </div>
      `).join('')
    : '<div style="color:var(--text-soft);font-size:.85rem;">Belum ada data untuk periode ini.</div>';
}

// ── Export CSV ─────────────────────────────
function exportCSV() {
  const header = ['Tanggal','Keterangan','Kategori','Tipe','Jumlah','Metode','Catatan'];
  const rows   = transactions.map(t => [
    new Date(t.date).toLocaleString('id-ID'),
    `"${t.desc.replace(/"/g,'""')}"`,
    getCatName(t.catId),
    t.type,
    t.amount,
    t.payment || '',
    `"${(t.note||'').replace(/"/g,'""')}"`,
  ]);
  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `koes-coffee-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('✓ CSV berhasil diunduh');
}

// ── Load dari Firebase ─────────────────────
async function loadTransactions() {
  try {
    const snap = await getDocs(collection(db, 'transaksi_angkringan'));
    transactions = [];
    snap.forEach(d => transactions.push({ id: d.id, ...d.data() }));
    transactions.sort((a,b) => new Date(b.date) - new Date(a.date));

    // Bagikan ke chart.js
    window._txArr = transactions;

    // Hitung total Cash & QRIS
    let cash = 0, qris = 0;
    transactions.forEach(t => {
      if (t.type === 'pemasukan') {
        if (t.payment === 'cash') cash += Number(t.amount);
        if (t.payment === 'qris') qris += Number(t.amount);
      }
    });
    document.getElementById('cashTotal').innerText = 'Rp ' + cash.toLocaleString('id-ID');
    document.getElementById('qrisTotal').innerText = 'Rp ' + qris.toLocaleString('id-ID');

    renderDashboard();
    renderHistory();
    renderLaporan();

  } catch (err) {
    console.error(err);
    showToast('❌ Gagal load Firebase');
  }
}

// ── Auth ───────────────────────────────────
async function login() {
  const email = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value.trim();
  if (!email || !pass) { showToast('Isi email dan password'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast('✓ Login berhasil');
  } catch (err) {
    console.error(err);
    showToast('❌ ' + err.message);
  }
}

async function logout() {
  await signOut(auth);  // ← FIX: bukan auth.signOut(auth)
  showToast('✓ Berhasil keluar');
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    return;
  }

  // Ambil role dari Firestore
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    window.currentUserRole = userSnap.exists()
      ? (userSnap.data().role || 'viewer')
      : 'viewer';
  } catch {
    window.currentUserRole = 'viewer';
  }

  applyRoleSystem();
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  init();
  await loadTransactions();
  // Chart.js belum tentu siap di onAuthStateChanged pertama,
  // tunggu microtask lalu panggil kalau tersedia
  setTimeout(() => {
    if (typeof window.renderFinanceChart === 'function') window.renderFinanceChart();
  }, 300);
});

// ── Role System ────────────────────────────
function applyRoleSystem() {
  if (window.currentUserRole === 'viewer') {
    document.querySelectorAll('nav button')[1].style.display = 'none';
    document.querySelectorAll(
      '.btn-danger, .btn-primary, .type-btn, .expense-item, .menu-card'
    ).forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('.quick-btn').forEach(btn => {
      if (btn.textContent.includes('Transaksi') || btn.textContent.includes('Jual')) {
        btn.style.display = 'none';
      }
    });
  }
}

// ── Theme ──────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('koes_theme', isDark ? 'dark' : 'light');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  // Re-render chart dengan warna yang sesuai
  if (typeof window.renderFinanceChart === 'function') window.renderFinanceChart();
}

// ── Payment method (form manual) ──────────
function setPayment(type, el) {
  selectedPayment = type;
  document.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('active'));
  el.classList.add('active');
}

// ── Toast ──────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Expose ke window ───────────────────────
window.login           = login;
window.logout          = logout;
window.showPage        = showPage;
window.setType         = setType;
window.saveTransaction = saveTransaction;
window.clearForm       = clearForm;
window.addCategory     = addCategory;
window.deleteCat       = deleteCat;
window.setDashPeriod   = setDashPeriod;
window.setLapPeriod    = setLapPeriod;
window.quickExpense    = quickExpense;
window.customExpense   = customExpense;
window.exportCSV       = exportCSV;
window.renderHistory   = renderHistory;
window.hapusDariFirebase = hapusDariFirebase;
window.loadTransactions  = loadTransactions;
window.toggleTheme     = toggleTheme;
window.setPayment      = setPayment;
window.showToast       = showToast; // dipakai oleh cart.js

