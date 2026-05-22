// ═══════════════════════════════════════════
//  js/cart.js  —  Sistem Keranjang (Multi-Order)
//  Semua logika cart, showTempSelector, submitCart
// ═══════════════════════════════════════════

import {
  db, collection, addDoc, serverTimestamp,
} from './config.js';

// ── State ──────────────────────────────────
let cart        = [];   // [{ key, name, temp, price, qty }]
let cartPay     = 'cash';
let pendingMenu = null; // item yang sedang menunggu pilihan hot/cold

// ── Helpers ────────────────────────────────
const fmtRp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const cartKey = (name, temp) => `${name}::${temp}`;

// ── Core Cart Operations ───────────────────
export function addToCart(item, temp) {
  const price = temp === 'hot' ? item.hot : item.cold;
  if (!price || price <= 0) {
    window.showToast('⚠ Menu tidak tersedia dalam pilihan ini');
    return;
  }
  const key = cartKey(item.name, temp);
  const existing = cart.find(c => c.key === key);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ key, name: item.name, temp, price, qty: 1 });
  }
  renderCart();
}

export function removeFromCart(key) {
  const idx = cart.findIndex(c => c.key === key);
  if (idx === -1) return;
  cart[idx].qty--;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}

export function addQtyCart(key) {
  const item = cart.find(c => c.key === key);
  if (item) { item.qty++; renderCart(); }
}

export function clearCart() {
  cart = [];
  renderCart();
}

// ── Render Keranjang ───────────────────────
export function renderCart() {
  const totalItem  = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const badge = document.getElementById('cartBadge');
  const total = document.getElementById('cartTotal');
  const btn   = document.getElementById('btnSubmitCart');

  if (badge) badge.textContent = totalItem;
  if (total) total.textContent = fmtRp(totalPrice);
  if (btn)   btn.disabled = cart.length === 0;

  const emptyEl = document.getElementById('cartEmpty');
  const listEl  = document.getElementById('cartList');
  if (!listEl) return;

  if (cart.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.innerHTML = cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-temp ${c.temp}">
          ${c.temp === 'hot' ? '🔥 Hot' : '❄️ Cold'}
          &nbsp;·&nbsp;${fmtRp(c.price)}
        </div>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="removeFromCart('${c.key}')">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" onclick="addQtyCart('${c.key}')">+</button>
      </div>
      <div class="cart-item-price">${fmtRp(c.price * c.qty)}</div>
    </div>
  `).join('');
}

// ── Submit Semua Order ke Firebase ─────────
export async function submitCart() {
  // Cek role
  if (window.currentUserRole === 'viewer') {
    window.showToast('❌ Viewer tidak punya akses');
    return;
  }
  if (cart.length === 0) {
    window.showToast('⚠ Keranjang masih kosong!');
    return;
  }

  const tableNote = document.getElementById('cartTableNote')?.value.trim() || '';
  const isoDate   = new Date().toISOString().slice(0, 16);
  const batchId   = Date.now().toString(36); // ID unik per order

  try {
    // Simpan setiap item sebagai transaksi terpisah (agar laporan item akurat)
    const promises = cart.map(item => addDoc(
      collection(db, 'transaksi_angkringan'),
      {
        type:      'pemasukan',
        desc:      `${item.name} (${item.temp.toUpperCase()})${item.qty > 1 ? ' ×' + item.qty : ''}`,
        amount:    item.price * item.qty,
        catId:     'c1',  // Minuman
        date:      isoDate,
        note:      tableNote
                     ? `Meja: ${tableNote} | Batch: ${batchId}`
                     : `Batch: ${batchId}`,
        payment:   cartPay,
        createdAt: serverTimestamp(),
      }
    ));

    await Promise.all(promises);

    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    window.showToast(`✓ ${cart.length} item disimpan — ${fmtRp(total)}`);
    clearCart();
    document.getElementById('cartTableNote').value = '';

    // Refresh data
    if (typeof window.loadTransactions === 'function') await window.loadTransactions();
    if (typeof window.renderFinanceChart === 'function') window.renderFinanceChart();

  } catch (err) {
    console.error(err);
    window.showToast('❌ Gagal simpan ke Firebase');
  }
}

// ── Metode Bayar Cart ──────────────────────
export function setCartPay(method) {
  cartPay = method;
  document.getElementById('cartPayCash')
    ?.classList.toggle('active', method === 'cash');
  document.getElementById('cartPayQris')
    ?.classList.toggle('active', method === 'qris');
}

// ── Temp Selector (Hot / Cold Modal) ──────
export function showTempSelector(item) {
  pendingMenu = item;

  // Kalau hanya tersedia satu suhu, langsung tambah ke cart
  const hasHot  = item.hot  && item.hot  > 0;
  const hasCold = item.cold && item.cold > 0;

  if (hasHot && !hasCold) { addToCart(item, 'hot');  return; }
  if (hasCold && !hasHot) { addToCart(item, 'cold'); return; }

  // Kedua suhu tersedia → tampilkan modal
  document.getElementById('tempMenuName').textContent = item.name;
  document.getElementById('tempModal').classList.add('active');
}

export function closeTempModal() {
  document.getElementById('tempModal').classList.remove('active');
  pendingMenu = null;
}

export function chooseTemp(temp) {
  if (!pendingMenu) return;
  addToCart(pendingMenu, temp);
  closeTempModal();
}

// ── Expose ke window (dipanggil oleh onclick di HTML) ──
window.addToCart       = addToCart;
window.removeFromCart  = removeFromCart;
window.addQtyCart      = addQtyCart;
window.clearCart       = clearCart;
window.submitCart      = submitCart;
window.setCartPay      = setCartPay;
window.showTempSelector = showTempSelector;
window.closeTempModal  = closeTempModal;
window.chooseTemp      = chooseTemp;
