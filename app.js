// ===================================================
// ARCADEFIN — App Logic
// ===================================================

// 1. Konfigurasi Koneksi Supabase
const supabaseUrl = 'https://usycuzgvhlizruxtmmzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzeWN1emd2aGxpenJ1eHRtbXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0Mzc1OTMsImV4cCI6MjEwNzAxMzU5M30.FEgFrllACSiKrVaZx6sFxqEZrdoJmOZ9Vkp-aPPXQx8';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// ===================================================
// 2. UTILITAS
// ===================================================

function formatRibuan(el) {
  const cursorPos = el.selectionStart;
  const oldLength = el.value.length;
  let raw = el.value.replace(/\D/g, '');
  if (raw.length > 0) {
    el.value = Number(raw).toLocaleString('id-ID');
  }
  const newLength = el.value.length;
  const diff = newLength - oldLength;
  el.setSelectionRange(cursorPos + diff, cursorPos + diff);
}

function parseRibuan(str) {
  if (!str) return 0;
  return parseInt(str.replace(/\./g, ''), 10) || 0;
}

function toRibuan(num) {
  return Number(num).toLocaleString('id-ID');
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '****@****.com';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) return localPart.charAt(0) + '****@' + domain;
  const first2 = localPart.slice(0, 2);
  const last2 = localPart.slice(-2);
  return first2 + '****' + last2 + '@' + domain;
}

// ===================================================
// 3. UI HELPERS — Toast & Auth Form Transitions
// ===================================================

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Auth Form Smooth Transition System ---
let currentAuthForm = 'form-login';

function showAuthForm(formId, direction = 'right') {
  const allForms = document.querySelectorAll('#auth-form-container .auth-form');
  allForms.forEach(form => {
    form.classList.remove('auth-form-active', 'slide-in-right', 'slide-in-left');
    form.style.display = 'none';
  });

  const targetForm = document.getElementById(formId);
  if (targetForm) {
    targetForm.style.display = 'block';
    void targetForm.offsetWidth;
    targetForm.classList.add('auth-form-active');
    targetForm.classList.add(direction === 'right' ? 'slide-in-right' : 'slide-in-left');
    currentAuthForm = formId;
  }
}

function switchTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const indicator = document.getElementById('auth-tab-indicator');

  document.getElementById('auth-tabs').style.display = '';
  document.getElementById('auth-tabs').classList.remove('hidden');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    indicator.classList.remove('tab-right');
    showAuthForm('form-login', 'left');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    indicator.classList.add('tab-right');
    showAuthForm('form-register', 'right');
  }
}

// ===================================================
// 4. NAVIGASI SCREEN (Auth vs Dashboard) & SPA
// ===================================================

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('login-code').value = '';
  switchTab('login');
}

function showDashboard() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  const userName = localStorage.getItem('user_name') || '-';
  document.getElementById('user-display-name').textContent = userName;
  fetchTransactions();
}

// --- SPA Page Switching ---
let currentPage = 'page-dashboard';

function switchPage(pageId) {
  // Update nav tabs
  const allTabs = document.querySelectorAll('.spa-nav-tab');
  const indicator = document.getElementById('spa-nav-indicator');
  allTabs.forEach(tab => tab.classList.remove('active'));

  const activeTab = document.querySelector(`.spa-nav-tab[data-page="${pageId}"]`);
  if (activeTab) activeTab.classList.add('active');

  // Move indicator
  if (pageId === 'page-rekap') {
    indicator.classList.add('tab-right');
  } else {
    indicator.classList.remove('tab-right');
  }

  // Switch pages
  const allPages = document.querySelectorAll('.spa-page');
  allPages.forEach(page => {
    page.classList.remove('spa-page-active');
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('spa-page-active');
  }

  currentPage = pageId;

  // If switching to rekap, refresh budget data
  if (pageId === 'page-rekap') {
    renderRekapPage();
  }
}

// ===================================================
// 5. REGISTER (Custom Token)
// ===================================================

async function registerUser() {
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const balanceStr = document.getElementById('register-balance').value;
  const customToken = document.getElementById('register-token').value.trim();
  const initialBalance = parseRibuan(balanceStr);

  if (!name) {
    showToast('Validasi Gagal', 'Nama harus diisi!', 'warning');
    return;
  }
  if (!email || !email.includes('@')) {
    showToast('Validasi Gagal', 'Email harus diisi dengan format yang benar!', 'warning');
    return;
  }
  if (initialBalance < 0) {
    showToast('Validasi Gagal', 'Saldo awal tidak boleh negatif!', 'warning');
    return;
  }

  // Validasi token (minimal 1 huruf dan 1 angka)
  const tokenRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;
  if (!customToken || !tokenRegex.test(customToken)) {
    showToast('Validasi Gagal', 'Token harus mengandung minimal 1 huruf dan 1 angka!', 'warning');
    return;
  }

  // Cek apakah token sudah digunakan orang lain
  const { data: existByToken } = await supabaseClient.from('users').select('user_code').eq('user_code', customToken).limit(1);
  if (existByToken && existByToken.length > 0) {
    showToast('Token Tidak Tersedia', 'Token tersebut sudah digunakan, silakan pilih token lain!', 'warning');
    return;
  }

  const { data: existByName } = await supabaseClient.from('users').select('user_code').eq('name', name).limit(1);
  if (existByName && existByName.length > 0) {
    showToast('Akun Ditemukan', `Akun dengan nama tersebut sudah terdaftar!\nKode unik Anda adalah: ${existByName[0].user_code}`, 'warning');
    return;
  }

  const { data: existByEmail } = await supabaseClient.from('users').select('user_code').eq('email', email).limit(1);
  if (existByEmail && existByEmail.length > 0) {
    showToast('Akun Ditemukan', `Akun dengan email tersebut sudah terdaftar!\nKode unik Anda adalah: ${existByEmail[0].user_code}`, 'warning');
    return;
  }

  const { error } = await supabaseClient.from('users').insert([{
    user_code: customToken,
    name: name,
    email: email,
    initial_balance: initialBalance
  }]);

  if (error) {
    showToast('Gagal Mendaftar', error.message, 'error');
    return;
  }

  // Hide tabs and show register result
  document.getElementById('auth-tabs').style.display = 'none';
  showAuthForm('register-result', 'right');
  document.getElementById('generated-code').textContent = customToken;
}

function goToLoginAfterRegister() {
  const generatedCode = document.getElementById('generated-code').textContent;
  document.getElementById('register-name').value = '';
  document.getElementById('register-email').value = '';
  document.getElementById('register-balance').value = '';
  document.getElementById('register-token').value = '';
  switchTab('login');
  document.getElementById('login-code').value = generatedCode;
}

// ===================================================
// 6. LOGIN (Fixed — no toUpperCase, no length limit)
// ===================================================

async function loginUser() {
  // PENTING: Jangan pakai .toUpperCase() agar token kustom mixed-case tetap akurat
  const code = document.getElementById('login-code').value.trim();

  if (!code) {
    showToast('Perhatian', 'Masukkan token Anda!', 'warning');
    return;
  }

  const { data, error } = await supabaseClient.from('users').select('*').eq('user_code', code).single();

  if (error || !data) {
    showToast('Gagal Login', 'Token tidak ditemukan! Pastikan token yang Anda masukkan benar (perhatikan huruf besar/kecil).', 'error');
    return;
  }

  localStorage.setItem('user_code', data.user_code);
  localStorage.setItem('user_name', data.name);
  localStorage.setItem('initial_balance', data.initial_balance);
  showDashboard();
}

function logoutUser() {
  localStorage.removeItem('user_code');
  localStorage.removeItem('user_name');
  localStorage.removeItem('initial_balance');
  showAuth();
}

// ===================================================
// 7. LUPA TOKEN
// ===================================================

let forgotUserData = null;

function showForgotToken() {
  document.getElementById('auth-tabs').style.display = 'none';
  showAuthForm('forgot-step1', 'right');
  document.getElementById('forgot-name').value = '';
  forgotUserData = null;
}

function backToLogin() {
  forgotUserData = null;
  switchTab('login');
}

async function forgotTokenStep1() {
  const name = document.getElementById('forgot-name').value.trim();
  if (!name) {
    showToast('Perhatian', 'Masukkan nama lengkap Anda!', 'warning');
    return;
  }

  const { data, error } = await supabaseClient.from('users').select('*').eq('name', name).single();
  if (error || !data) {
    showToast('Tidak Ditemukan', 'Nama tidak ditemukan! Pastikan nama yang Anda masukkan sesuai saat pendaftaran.', 'error');
    return;
  }

  forgotUserData = data;
  document.getElementById('masked-email').textContent = maskEmail(data.email);
  showAuthForm('forgot-step2', 'right');
  document.getElementById('forgot-email').value = '';
}

function forgotTokenStep2() {
  const inputEmail = document.getElementById('forgot-email').value.trim().toLowerCase();
  if (!inputEmail) {
    showToast('Perhatian', 'Masukkan email lengkap Anda!', 'warning');
    return;
  }

  if (!forgotUserData || !forgotUserData.email) {
    showToast('Error', 'Terjadi kesalahan. Silakan ulangi dari awal.', 'error');
    showForgotToken();
    return;
  }

  if (inputEmail === forgotUserData.email.toLowerCase()) {
    showAuthForm('forgot-step3', 'right');
    document.getElementById('recovered-code').textContent = forgotUserData.user_code;
    showToast('Berhasil', 'Verifikasi berhasil. Kode Anda ditampilkan.', 'success');
  } else {
    showToast('Verifikasi Gagal', 'Email tidak cocok! Pastikan Anda memasukkan email yang terdaftar.', 'error');
  }
}

function backToLoginWithCode() {
  const recoveredCode = document.getElementById('recovered-code').textContent;
  forgotUserData = null;
  switchTab('login');
  document.getElementById('login-code').value = recoveredCode;
}

// ===================================================
// 8. HIDE / SHOW BALANCE
// ===================================================

let isBalanceHidden = false;

function toggleBalanceVisibility() {
  isBalanceHidden = !isBalanceHidden;

  const balanceEl = document.getElementById('current-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expense');
  const eyeOpen = document.getElementById('eye-open-icon');
  const eyeClosed = document.getElementById('eye-closed-icon');

  if (isBalanceHidden) {
    balanceEl.textContent = 'Rp •••••••';
    incomeEl.textContent = 'Rp •••••••';
    expenseEl.textContent = 'Rp •••••••';

    balanceEl.classList.add('blurred');
    incomeEl.classList.add('blurred');
    expenseEl.classList.add('blurred');

    eyeOpen.classList.add('hidden');
    eyeClosed.classList.remove('hidden');
  } else {
    balanceEl.textContent = balanceEl.getAttribute('data-value');
    incomeEl.textContent = incomeEl.getAttribute('data-value');
    expenseEl.textContent = expenseEl.getAttribute('data-value');

    balanceEl.classList.remove('blurred');
    incomeEl.classList.remove('blurred');
    expenseEl.classList.remove('blurred');

    eyeOpen.classList.remove('hidden');
    eyeClosed.classList.add('hidden');
  }
}

// ===================================================
// 9. FETCH, RENDER, PAGINATION, FILTER & UPDATE SALDO
// ===================================================

let allTransactions = [];
let filteredTransactions = [];
let currentPageNum = 1;
const ITEMS_PER_PAGE = 10;

// *** KUNCI PERBAIKAN: Auto-detect nama kolom ID dari data Supabase ***
// Nama kolom ID akan terdeteksi otomatis saat fetchTransactions pertama kali.
// Ini menangani kasus kolom bernama 'id', 'ID', 'Id', atau variasi lainnya.
let ID_COLUMN = 'id'; // Default, akan di-override jika terdeteksi berbeda

/**
 * Mengambil nilai ID dari objek transaksi menggunakan kolom yang sudah terdeteksi.
 */
function getTrxId(trx) {
  return trx[ID_COLUMN];
}

async function fetchTransactions() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return;

  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .eq('user_code', userCode)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Error', 'Gagal memuat data: ' + error.message, 'error');
    return;
  }

  allTransactions = data || [];

  // *** Auto-detect kolom ID dari data pertama ***
  if (allTransactions.length > 0) {
    const keys = Object.keys(allTransactions[0]);
    // Cari kolom yang namanya "id" (case-insensitive)
    const idKey = keys.find(k => k.toLowerCase() === 'id');
    if (idKey) {
      ID_COLUMN = idKey;
    }
    console.log('[ArcadeFin] Kolom tabel:', keys);
    console.log('[ArcadeFin] Kolom ID terdeteksi:', ID_COLUMN);
    console.log('[ArcadeFin] Contoh ID:', allTransactions[0][ID_COLUMN], '(tipe:', typeof allTransactions[0][ID_COLUMN], ')');
  }

  // Apply current filter
  applyTimeFilter();
  updateBalance(allTransactions);
}

// --- Time Filter Logic ---
function getFilteredData(filterValue, sourceData) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (filterValue === 'today') {
    return sourceData.filter(trx => trx.date === todayStr);
  } else if (filterValue === 'month') {
    return sourceData.filter(trx => {
      const d = new Date(trx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  } else if (filterValue === 'year') {
    return sourceData.filter(trx => {
      const d = new Date(trx.date);
      return d.getFullYear() === currentYear;
    });
  }
  // 'all'
  return sourceData;
}

function applyTimeFilter() {
  const filterValue = document.getElementById('time-filter').value;
  filteredTransactions = getFilteredData(filterValue, allTransactions);
  currentPageNum = 1;
  renderPaginatedTable();
}

// --- Pagination Logic ---
function renderPaginatedTable() {
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Clamp current page
  if (currentPageNum > totalPages) currentPageNum = totalPages;
  if (currentPageNum < 1) currentPageNum = 1;

  const startIdx = (currentPageNum - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageData = filteredTransactions.slice(startIdx, endIdx);

  renderTable(pageData);
  updatePaginationUI(totalPages);
}

function updatePaginationUI(totalPages) {
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const pageInfo = document.getElementById('page-info');

  pageInfo.textContent = `Halaman ${currentPageNum} / ${totalPages}`;
  btnPrev.disabled = currentPageNum <= 1;
  btnNext.disabled = currentPageNum >= totalPages;
}

function goToPrevPage() {
  if (currentPageNum > 1) {
    currentPageNum--;
    renderPaginatedTable();
  }
}

function goToNextPage() {
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  if (currentPageNum < totalPages) {
    currentPageNum++;
    renderPaginatedTable();
  }
}

// --- Render Table (receives only current page slice) ---
function renderTable(data) {
  const tableBody = document.getElementById('transaction-list');
  tableBody.innerHTML = '';

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>Belum ada transaksi. Mulai catat keuangan Anda!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  data.forEach(trx => {
    const isExpense = trx.type === 'expense';
    const rowClass = isExpense ? 'row-expense' : 'row-income';
    const badgeClass = isExpense ? 'badge-expense' : 'badge-income';
    const badgeLabel = isExpense ? '🔴 Keluar' : '🟢 Masuk';
    const amountClass = isExpense ? 'amount-expense' : 'amount-income';
    const amountPrefix = isExpense ? '- Rp' : '+ Rp';
    
    // Amankan string deskripsi
    const safeDesc = (trx.description || '-').replace(/"/g, '&quot;').replace(/'/g, "\\'");

    // Gunakan kolom ID yang sudah terdeteksi
    const trxId = getTrxId(trx);

    const row = `
      <tr class="${rowClass}">
        <td>${new Date(trx.date).toLocaleDateString('id-ID')}</td>
        <td><span class="type-badge ${badgeClass}">${badgeLabel}</span></td>
        <td>${trx.category}</td>
        <td class="desc-cell" ondblclick="showDescModal('${safeDesc}')" title="Klik ganda untuk detail">${trx.description || '-'}</td>
        <td class="amount-cell ${amountClass}">${amountPrefix} ${toRibuan(trx.amount)}</td>
        <td>
          <div class="action-cell">
            <button class="btn-action" data-id="${trxId}" onclick="editTransaksi(this.dataset.id)">✏️ Edit</button>
            <button class="btn-action btn-action-delete" data-id="${trxId}" onclick="hapusTransaksi(this.dataset.id)">🗑️ Hapus</button>
          </div>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
}

function updateBalance(transactions) {
  const initialBalance = parseInt(localStorage.getItem('initial_balance')) || 0;
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(trx => {
    if (trx.type === 'income') totalIncome += Number(trx.amount);
    else totalExpense += Number(trx.amount);
  });

  const currentBalance = initialBalance + totalIncome - totalExpense;

  const balanceText = 'Rp ' + toRibuan(currentBalance);
  const incomeText = 'Rp ' + toRibuan(totalIncome);
  const expenseText = 'Rp ' + toRibuan(totalExpense);

  const balanceEl = document.getElementById('current-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expense');

  balanceEl.setAttribute('data-value', balanceText);
  incomeEl.setAttribute('data-value', incomeText);
  expenseEl.setAttribute('data-value', expenseText);

  if (isBalanceHidden) {
    balanceEl.textContent = 'Rp •••••••';
    incomeEl.textContent = 'Rp •••••••';
    expenseEl.textContent = 'Rp •••••••';
  } else {
    balanceEl.textContent = balanceText;
    incomeEl.textContent = incomeText;
    expenseEl.textContent = expenseText;
  }

  // === Negative Balance Mascot ===
  const mascot = document.getElementById('negative-mascot');
  const balanceCard = document.querySelector('.balance-card');

  if (currentBalance < 0) {
    mascot.classList.remove('hidden');
    balanceCard.classList.add('negative-shake');
    balanceEl.style.color = 'var(--expense-text)';
  } else {
    mascot.classList.add('hidden');
    balanceCard.classList.remove('negative-shake');
    balanceEl.style.color = '';
  }
}

// Modal Deskripsi
function showDescModal(desc) {
  document.getElementById('modal-desc-text').textContent = desc;
  document.getElementById('desc-modal').classList.remove('hidden');
}

function closeDescModal() {
  document.getElementById('desc-modal').classList.add('hidden');
}

// ===================================================
// 10. TAMBAH TRANSAKSI
// ===================================================

let editTrxId = null;

async function tambahTransaksi() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) {
    showToast('Sesi Habis', 'Sesi tidak ditemukan. Silakan login ulang.', 'warning');
    showAuth();
    return;
  }

  const amount = parseRibuan(document.getElementById('amount').value);
  const type = document.getElementById('type').value;
  const category = document.getElementById('category').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!amount || amount <= 0) { showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning'); return; }
  if (!category) { showToast('Perhatian', 'Kategori harus diisi!', 'warning'); return; }

  const { error } = await supabaseClient.from('transactions').insert([{
    amount: amount, type: type, category: category, description: description,
    date: new Date().toISOString().split('T')[0], user_code: userCode
  }]);

  if (error) {
    showToast('Gagal', 'Gagal menyimpan transaksi: ' + error.message, 'error');
  } else {
    showToast('Berhasil', 'Transaksi berhasil disimpan!', 'success');
    cancelEdit();
    fetchTransactions();
  }
}

// ===================================================
// 11. EDIT TRANSAKSI (FIXED — Dynamic ID Column)
// ===================================================

function editTransaksi(id) {
  // Cari transaksi menggunakan kolom ID yang sudah terdeteksi
  const trx = allTransactions.find(t => String(getTrxId(t)) === String(id));
  if (!trx) {
    showToast('Error', 'Transaksi tidak ditemukan di data lokal.', 'error');
    console.error('[ArcadeFin] editTransaksi gagal. ID dicari:', id, 'ID_COLUMN:', ID_COLUMN);
    return;
  }

  // Simpan ID — pertahankan tipe asli dari Supabase (number atau string)
  editTrxId = getTrxId(trx);
  console.log('[ArcadeFin] Edit mode — editTrxId:', editTrxId, '(tipe:', typeof editTrxId, ') kolom:', ID_COLUMN);

  // Masukkan data ke form
  document.getElementById('amount').value = toRibuan(trx.amount);
  document.getElementById('category').value = trx.category;
  document.getElementById('description').value = trx.description || '';

  const typeSelect = document.getElementById('type');
  typeSelect.value = trx.type;
  if (typeSelect.value !== trx.type) {
    for (let i = 0; i < typeSelect.options.length; i++) {
      if (typeSelect.options[i].value === trx.type) {
        typeSelect.selectedIndex = i;
        break;
      }
    }
  }

  document.getElementById('btn-save-trx').classList.add('hidden');
  document.getElementById('btn-update-trx').classList.remove('hidden');
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  document.getElementById('form-title').innerHTML = '<span class="icon">✏️</span> Edit Transaksi';
  document.getElementById('form-title').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editTrxId = null;
  document.getElementById('amount').value = '';
  document.getElementById('type').value = 'expense';
  document.getElementById('category').value = '';
  document.getElementById('description').value = '';

  document.getElementById('btn-save-trx').classList.remove('hidden');
  document.getElementById('btn-update-trx').classList.add('hidden');
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  document.getElementById('form-title').innerHTML = '<span class="icon">📝</span> Catat Transaksi';
}

async function updateTransaksi() {
  if (editTrxId === null || editTrxId === undefined) {
    showToast('Error', 'Tidak ada transaksi yang dipilih untuk diupdate.', 'error');
    return;
  }

  const userCode = localStorage.getItem('user_code');
  if (!userCode) {
    showToast('Sesi Habis', 'Sesi tidak ditemukan. Silakan login ulang.', 'warning');
    showAuth();
    return;
  }

  const amountRaw = document.getElementById('amount').value;
  const amount = parseRibuan(amountRaw);
  const type = document.getElementById('type').value;
  const category = document.getElementById('category').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!amount || amount <= 0) {
    showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning');
    return;
  }
  if (!category) {
    showToast('Perhatian', 'Kategori harus diisi!', 'warning');
    return;
  }

  const updatePayload = {
    amount: amount,
    type: type,
    category: category,
    description: description
  };

  console.log('[ArcadeFin] UPDATE — kolom:', ID_COLUMN, '| nilai:', editTrxId, '(tipe:', typeof editTrxId, ') | user_code:', userCode);
  console.log('[ArcadeFin] UPDATE payload:', JSON.stringify(updatePayload));

  // Gunakan nama kolom ID yang terdeteksi secara dinamis
  const { data, error } = await supabaseClient
    .from('transactions')
    .update(updatePayload)
    .eq(ID_COLUMN, editTrxId)
    .eq('user_code', userCode)
    .select();

  console.log('[ArcadeFin] UPDATE response — data:', data, '| error:', error);

  if (error) {
    console.error('[ArcadeFin] Update error:', error);
    showToast('Gagal', 'Gagal update transaksi: ' + error.message, 'error');
  } else if (!data || data.length === 0) {
    console.warn('[ArcadeFin] Update returned 0 rows. Kemungkinan kolom ID salah atau RLS blocking.');
    showToast('Gagal', 'Update gagal — data tidak ditemukan. Buka Console (F12) untuk detail debug.', 'error');
  } else {
    console.log('[ArcadeFin] Update success:', data);
    showToast('Berhasil', 'Transaksi berhasil diperbarui!', 'success');
    cancelEdit();
    fetchTransactions();
  }
}

// ===================================================
// 12. HAPUS TRANSAKSI (FIXED — Dynamic ID Column)
// ===================================================

let deleteTrxId = null;

function hapusTransaksi(id) {
  const trx = allTransactions.find(t => String(getTrxId(t)) === String(id));
  if (!trx) {
    showToast('Error', 'Transaksi tidak ditemukan.', 'error');
    return;
  }

  // Pertahankan tipe asli
  deleteTrxId = getTrxId(trx);

  const typeLabel = trx.type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
  const modalText = `Anda akan menghapus transaksi:\n\n📋 ${trx.category} — ${typeLabel}\n💰 Rp ${toRibuan(trx.amount)}\n📅 ${new Date(trx.date).toLocaleDateString('id-ID')}\n\nTindakan ini tidak dapat dibatalkan.`;
  
  document.getElementById('delete-modal-text').textContent = modalText;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTrxId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDeleteTransaksi() {
  if (deleteTrxId === null || deleteTrxId === undefined) {
    closeDeleteModal();
    return;
  }

  const userCode = localStorage.getItem('user_code');
  if (!userCode) {
    showToast('Sesi Habis', 'Sesi tidak ditemukan. Silakan login ulang.', 'warning');
    showAuth();
    return;
  }

  console.log('[ArcadeFin] DELETE — kolom:', ID_COLUMN, '| nilai:', deleteTrxId, '(tipe:', typeof deleteTrxId, ') | user_code:', userCode);

  // Gunakan nama kolom ID yang terdeteksi + tambahkan .select() untuk verifikasi
  const { data, error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq(ID_COLUMN, deleteTrxId)
    .eq('user_code', userCode)
    .select();

  console.log('[ArcadeFin] DELETE response — data:', data, '| error:', error);

  closeDeleteModal();

  if (error) {
    console.error('[ArcadeFin] Delete error:', error);
    showToast('Gagal', 'Gagal menghapus transaksi: ' + error.message, 'error');
  } else if (!data || data.length === 0) {
    console.warn('[ArcadeFin] Delete returned 0 rows. Kemungkinan kolom ID salah atau RLS blocking.');
    showToast('Gagal', 'Hapus gagal — data tidak ditemukan. Buka Console (F12) untuk detail debug.', 'error');
  } else {
    showToast('Berhasil', 'Transaksi berhasil dihapus!', 'success');

    if (editTrxId !== null && String(editTrxId) === String(deleteTrxId)) {
      cancelEdit();
    }
    fetchTransactions();
  }

  deleteTrxId = null;
}

// ===================================================
// 13. EDIT TOKEN (FIXED — Strategi insert-migrasi-hapus)
// ===================================================

function showEditTokenModal() {
  document.getElementById('new-token-input').value = '';
  document.getElementById('edit-token-modal').classList.remove('hidden');
}

function closeEditTokenModal() {
  document.getElementById('edit-token-modal').classList.add('hidden');
}

async function saveNewToken() {
  const newToken = document.getElementById('new-token-input').value.trim();
  const oldToken = localStorage.getItem('user_code');

  const tokenRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;
  if (!newToken || !tokenRegex.test(newToken)) {
    showToast('Validasi Gagal', 'Token baru harus mengandung minimal 1 huruf dan 1 angka!', 'warning');
    return;
  }

  if (newToken === oldToken) {
    showToast('Perhatian', 'Token baru tidak boleh sama dengan token saat ini!', 'warning');
    return;
  }

  // Cek apakah token baru sudah digunakan
  const { data: existByToken } = await supabaseClient.from('users').select('user_code').eq('user_code', newToken).limit(1);
  if (existByToken && existByToken.length > 0) {
    showToast('Token Tidak Tersedia', 'Token tersebut sudah digunakan, silakan pilih token lain!', 'warning');
    return;
  }

  console.log('[ArcadeFin] EDIT TOKEN — old:', oldToken, '| new:', newToken);

  // *** STRATEGI: Coba update langsung dulu. Jika gagal (FK constraint), gunakan strategi insert-migrasi-hapus ***
  
  // Langkah 1: Coba update user_code langsung di tabel users
  const { data: directUpdate, error: directError } = await supabaseClient
    .from('users')
    .update({ user_code: newToken })
    .eq('user_code', oldToken)
    .select();

  console.log('[ArcadeFin] Direct update users response:', directUpdate, directError);

  if (directError) {
    console.warn('[ArcadeFin] Direct update gagal, mencoba strategi insert-migrasi-hapus...');
    
    // Langkah alternatif: Insert user baru → migrasi transaksi → hapus user lama
    
    // A. Ambil data user lama
    const { data: oldUser, error: fetchErr } = await supabaseClient
      .from('users')
      .select('*')
      .eq('user_code', oldToken)
      .single();

    if (fetchErr || !oldUser) {
      showToast('Gagal', 'Tidak dapat mengambil data akun saat ini.', 'error');
      return;
    }

    // B. Insert user baru dengan token baru
    const { error: insertErr } = await supabaseClient.from('users').insert([{
      user_code: newToken,
      name: oldUser.name,
      email: oldUser.email,
      initial_balance: oldUser.initial_balance
    }]);

    if (insertErr) {
      showToast('Gagal', 'Gagal membuat akun dengan token baru: ' + insertErr.message, 'error');
      return;
    }

    // C. Migrasi semua transaksi ke token baru
    const { error: migrateErr } = await supabaseClient
      .from('transactions')
      .update({ user_code: newToken })
      .eq('user_code', oldToken);

    if (migrateErr) {
      console.error('[ArcadeFin] Migrasi transaksi gagal:', migrateErr);
      // Rollback: hapus user baru yang sudah dibuat
      await supabaseClient.from('users').delete().eq('user_code', newToken);
      showToast('Gagal', 'Gagal memindahkan transaksi ke token baru: ' + migrateErr.message, 'error');
      return;
    }

    // C2. Migrasi budgets ke token baru
    await supabaseClient
      .from('budgets')
      .update({ user_code: newToken })
      .eq('user_code', oldToken);

    // D. Hapus user lama
    const { error: deleteErr } = await supabaseClient
      .from('users')
      .delete()
      .eq('user_code', oldToken);

    if (deleteErr) {
      console.error('[ArcadeFin] Hapus user lama gagal:', deleteErr);
      // Tidak fatal — user baru sudah aktif
    }

  } else if (!directUpdate || directUpdate.length === 0) {
    // Direct update tidak error tapi 0 rows — kemungkinan RLS blocking
    console.warn('[ArcadeFin] Direct update returned 0 rows');
    showToast('Gagal', 'Token tidak berhasil diperbarui (kemungkinan blokir keamanan database). Buka Console (F12) untuk detail.', 'error');
    return;
  } else {
    // Direct update berhasil — update juga transaksi
    console.log('[ArcadeFin] Direct update berhasil. Memperbarui transaksi...');
    const { error: trxErr } = await supabaseClient
      .from('transactions')
      .update({ user_code: newToken })
      .eq('user_code', oldToken);

    if (trxErr) {
      console.error('[ArcadeFin] Update transaksi gagal:', trxErr);
    }

    // Update budgets juga
    await supabaseClient
      .from('budgets')
      .update({ user_code: newToken })
      .eq('user_code', oldToken);
  }

  // Update localStorage
  localStorage.setItem('user_code', newToken);
  
  closeEditTokenModal();
  showToast('Berhasil', 'Token Anda berhasil diperbarui menjadi: ' + newToken, 'success');
  
  // Refresh data transaksi dengan token baru
  fetchTransactions();
}

// ===================================================
// 14. REKAP & BUDGETING
// ===================================================

let allBudgets = [];
let deleteBudgetId = null;

// --- Fetch Budgets from Supabase ---
async function fetchBudgets() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return [];

  const { data, error } = await supabaseClient
    .from('budgets')
    .select('*')
    .eq('user_code', userCode);

  if (error) {
    console.error('[ArcadeFin] Fetch budgets error:', error);
    return [];
  }

  allBudgets = data || [];
  return allBudgets;
}

// --- Budget Modal ---
function showBudgetModal() {
  document.getElementById('budget-category').value = '';
  document.getElementById('budget-amount').value = '';
  document.getElementById('budget-modal').classList.remove('hidden');
}

function closeBudgetModal() {
  document.getElementById('budget-modal').classList.add('hidden');
}

async function saveBudget() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) {
    showToast('Sesi Habis', 'Silakan login ulang.', 'warning');
    return;
  }

  const category = document.getElementById('budget-category').value.trim();
  const amountLimit = parseRibuan(document.getElementById('budget-amount').value);

  if (!category) {
    showToast('Perhatian', 'Kategori harus diisi!', 'warning');
    return;
  }
  if (!amountLimit || amountLimit <= 0) {
    showToast('Perhatian', 'Batas budget harus diisi dan lebih dari 0!', 'warning');
    return;
  }

  // Check if budget for this category already exists (case-insensitive)
  const existing = allBudgets.find(b => b.category.toLowerCase() === category.toLowerCase());

  if (existing) {
    // Update existing budget
    const { error } = await supabaseClient
      .from('budgets')
      .update({ amount_limit: amountLimit })
      .eq('id', existing.id)
      .eq('user_code', userCode);

    if (error) {
      showToast('Gagal', 'Gagal memperbarui budget: ' + error.message, 'error');
      return;
    }
    showToast('Berhasil', `Budget kategori "${category}" berhasil diperbarui!`, 'success');
  } else {
    // Insert new budget
    const { error } = await supabaseClient.from('budgets').insert([{
      user_code: userCode,
      category: category,
      amount_limit: amountLimit
    }]);

    if (error) {
      showToast('Gagal', 'Gagal menyimpan budget: ' + error.message, 'error');
      return;
    }
    showToast('Berhasil', `Budget kategori "${category}" berhasil disimpan!`, 'success');
  }

  closeBudgetModal();
  renderRekapPage();
}

// --- Delete Budget ---
function hapusBudget(id) {
  const budget = allBudgets.find(b => b.id === id);
  if (!budget) return;

  deleteBudgetId = id;
  document.getElementById('delete-budget-modal-text').textContent =
    `Anda akan menghapus budget kategori "${budget.category}" (Rp ${toRibuan(budget.amount_limit)}). Lanjutkan?`;
  document.getElementById('delete-budget-modal').classList.remove('hidden');
}

function closeDeleteBudgetModal() {
  deleteBudgetId = null;
  document.getElementById('delete-budget-modal').classList.add('hidden');
}

async function confirmDeleteBudget() {
  if (!deleteBudgetId) {
    closeDeleteBudgetModal();
    return;
  }

  const userCode = localStorage.getItem('user_code');
  const { error } = await supabaseClient
    .from('budgets')
    .delete()
    .eq('id', deleteBudgetId)
    .eq('user_code', userCode);

  closeDeleteBudgetModal();

  if (error) {
    showToast('Gagal', 'Gagal menghapus budget: ' + error.message, 'error');
  } else {
    showToast('Berhasil', 'Budget berhasil dihapus!', 'success');
    renderRekapPage();
  }

  deleteBudgetId = null;
}

// --- Render Rekap Page ---
async function renderRekapPage() {
  await fetchBudgets();

  const rekapFilter = document.getElementById('rekap-time-filter').value;
  const filteredTrx = getFilteredData(rekapFilter, allTransactions);

  // Calculate summary based on filtered transactions
  let totalExpenseFiltered = 0;
  let totalIncomeFiltered = 0;
  filteredTrx.forEach(trx => {
    if (trx.type === 'expense') totalExpenseFiltered += Number(trx.amount);
    else totalIncomeFiltered += Number(trx.amount);
  });

  document.getElementById('rekap-total-expense').textContent = 'Rp ' + toRibuan(totalExpenseFiltered);
  document.getElementById('rekap-total-income').textContent = 'Rp ' + toRibuan(totalIncomeFiltered);

  // Total budget
  let totalBudget = 0;
  allBudgets.forEach(b => totalBudget += Number(b.amount_limit));
  document.getElementById('rekap-total-budget').textContent = 'Rp ' + toRibuan(totalBudget);

  // --- KUNCI: Untuk progress bar, SELALU gunakan akumulasi bulan berjalan ---
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyExpenses = allTransactions.filter(trx => {
    if (trx.type !== 'expense') return false;
    const d = new Date(trx.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Aggregate monthly expenses by category (case-insensitive)
  const expenseByCategory = {};
  monthlyExpenses.forEach(trx => {
    const catKey = trx.category.toLowerCase();
    expenseByCategory[catKey] = (expenseByCategory[catKey] || 0) + Number(trx.amount);
  });

  // Also aggregate filtered expenses by category for display text
  const filteredExpenseByCategory = {};
  filteredTrx.forEach(trx => {
    if (trx.type !== 'expense') return;
    const catKey = trx.category.toLowerCase();
    filteredExpenseByCategory[catKey] = (filteredExpenseByCategory[catKey] || 0) + Number(trx.amount);
  });

  // Render budget cards
  const grid = document.getElementById('budget-cards-grid');

  if (allBudgets.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Belum ada budget yang diatur. Klik "+ Atur Budget" untuk mulai.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';

  allBudgets.forEach(budget => {
    const catKey = budget.category.toLowerCase();
    const monthlySpent = expenseByCategory[catKey] || 0;
    const filteredSpent = filteredExpenseByCategory[catKey] || 0;
    const limit = Number(budget.amount_limit);
    const percent = limit > 0 ? Math.round((monthlySpent / limit) * 100) : 0;
    const isOver = monthlySpent > limit;
    const barWidth = Math.min(percent, 100);

    const card = document.createElement('div');
    card.className = `budget-card${isOver ? ' overbudget' : ''}`;

    card.innerHTML = `
      <div class="budget-card-header">
        <div class="budget-card-category">
          <span class="cat-icon">${isOver ? '🔴' : '🟢'}</span>
          ${budget.category}
        </div>
        <div class="budget-card-actions">
          <button class="btn-action btn-action-delete" onclick="hapusBudget(${budget.id})">🗑️</button>
        </div>
      </div>
      <div class="budget-card-amounts">
        <span class="budget-spent ${isOver ? 'expense-color' : ''}">Rp ${toRibuan(filteredSpent)} <small style="color:var(--text-muted);font-weight:400;">(filter)</small></span>
        <span class="budget-limit">/ Rp ${toRibuan(limit)}</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill ${isOver ? 'bar-red' : 'bar-green'}" style="width: ${barWidth}%"></div>
      </div>
      <div class="budget-card-percent ${isOver ? 'percent-red' : 'percent-green'}">
        ${isOver ? '⚠️ Overbudget!' : ''} ${percent}% (bulan ini: Rp ${toRibuan(monthlySpent)})
      </div>
    `;

    grid.appendChild(card);
  });
}

function applyRekapFilter() {
  renderRekapPage();
}

// ===================================================
// 15. TEMA TERANG / GELAP
// ===================================================

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const btnToggle = document.getElementById('btn-theme-toggle');
  
  if (currentTheme === 'light') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
    if(btnToggle) btnToggle.textContent = '☀️ Terang';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    if(btnToggle) btnToggle.textContent = '🌙 Gelap';
  }
}

// ===================================================
// 16. INISIALISASI
// ===================================================

window.onload = () => {
  // Theme init
  const savedTheme = localStorage.getItem('theme');
  const btnToggle = document.getElementById('btn-theme-toggle');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if(btnToggle) btnToggle.textContent = '🌙 Gelap';
  }

  const allForms = document.querySelectorAll('#auth-form-container .auth-form');
  allForms.forEach(form => {
    form.style.display = 'none';
    form.classList.remove('auth-form-active');
  });

  if (localStorage.getItem('user_code')) {
    showDashboard();
  } else {
    showAuth();
  }
};