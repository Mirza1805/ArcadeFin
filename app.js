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

// --- Crypto Helpers ---
function encrypt(text, secretKey) {
  if (!text && text !== 0) return text; // Handle empty/null but allow 0
  return CryptoJS.AES.encrypt(text.toString(), secretKey).toString();
}

function decrypt(cipherText, secretKey) {
  if (!cipherText) return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText.toString(), secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      return cipherText; // Backward compatibility for unencrypted data
    }
    return originalText;
  } catch (error) {
    // If decryption fails (e.g., malformed or unencrypted data), return original
    return cipherText;
  }
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
  fetchWallets().then(() => fetchTransactions());
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
  const walletName = document.getElementById('register-wallet-name').value.trim() || 'Dompet Utama';
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
    showToast('Token Tidak Tersedia', 'Kombinasi token ini tidak valid atau tidak tersedia. Silakan gunakan kombinasi lain.', 'warning');
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

  // Enkripsi saldo awal 0 untuk users (karena dompet yang akan menyimpannya)
  const encryptedZeroBalance = encrypt('0', customToken);

  const { error } = await supabaseClient.from('users').insert([{
    user_code: customToken,
    name: name,
    email: email,
    initial_balance: encryptedZeroBalance
  }]);

  if (error) {
    showToast('Gagal Mendaftar', error.message, 'error');
    return;
  }

  // Tambahkan dompet pertama ke tabel wallets
  const encryptedWalletName = encrypt(walletName, customToken);
  const encryptedWalletBalance = encrypt(initialBalance.toString(), customToken);

  const { error: walletError } = await supabaseClient.from('wallets').insert([{
    user_code: customToken,
    wallet_name: encryptedWalletName,
    initial_balance: encryptedWalletBalance
  }]);

  if (walletError) {
    console.error('Gagal membuat dompet pertama:', walletError);
    // Kita tidak membatalkan registrasi, tapi tampilkan log
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
  document.getElementById('register-wallet-name').value = '';
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

  let decryptedBalance = decrypt(data.initial_balance, data.user_code);
  decryptedBalance = Number(decryptedBalance) || 0;

  localStorage.setItem('user_code', data.user_code);
  localStorage.setItem('user_name', data.name);
  localStorage.setItem('initial_balance', decryptedBalance);
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
// 8.5 MULTI-WALLET LOGIC
// ===================================================
let allWallets = [];

async function fetchWallets() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return;

  const { data, error } = await supabaseClient
    .from('wallets')
    .select('*')
    .eq('user_code', userCode);

  if (error) {
    console.error('Gagal memuat dompet:', error);
    return;
  }

  allWallets = (data || []).map(w => {
    let decName = w.wallet_name;
    let decBal = w.initial_balance;
    try {
      decName = decrypt(w.wallet_name, userCode);
    } catch (e) { }
    try {
      decBal = decrypt(w.initial_balance, userCode);
    } catch (e) { }

    return {
      ...w,
      wallet_name: decName,
      initial_balance: Number(decBal) || 0
    };
  });

  // Dropdown di-populate setelah transaksi di-fetch agar tahu legacyBalance
}

function populateWalletDropdowns(hasLegacy = false) {
  const originSelect = document.getElementById('wallet-id');
  const destSelect = document.getElementById('to-wallet-id');
  if (!originSelect || !destSelect) return;

  const originVal = originSelect.value;
  const destVal = destSelect.value;

  originSelect.innerHTML = '';
  destSelect.innerHTML = '';

  if (hasLegacy) {
    const opt1 = document.createElement('option');
    opt1.value = 'legacy';
    opt1.textContent = '⚠️ Belum Dikategorikan';
    originSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = 'legacy';
    opt2.textContent = '⚠️ Belum Dikategorikan';
    destSelect.appendChild(opt2);
  }

  allWallets.forEach(w => {
    const opt1 = document.createElement('option');
    opt1.value = w.id;
    opt1.textContent = w.wallet_name;
    originSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = w.id;
    opt2.textContent = w.wallet_name;
    destSelect.appendChild(opt2);
  });

  if (originVal) originSelect.value = originVal;
  if (destVal) destSelect.value = destVal;
}

function showWalletModal() {
  document.getElementById('wallet-name').value = '';
  document.getElementById('wallet-balance').value = '';
  document.getElementById('wallet-modal').classList.remove('hidden');
}

function closeWalletModal() {
  document.getElementById('wallet-modal').classList.add('hidden');
}

async function saveWallet() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return;

  const name = document.getElementById('wallet-name').value.trim();
  const bal = parseRibuan(document.getElementById('wallet-balance').value);

  if (!name) { showToast('Perhatian', 'Nama dompet harus diisi!', 'warning'); return; }

  const encName = encrypt(name, userCode);
  const encBal = encrypt(bal.toString(), userCode);

  const { error } = await supabaseClient.from('wallets').insert([{
    user_code: userCode,
    wallet_name: encName,
    initial_balance: encBal
  }]);

  if (error) {
    showToast('Gagal', 'Gagal menyimpan dompet: ' + error.message, 'error');
  } else {
    showToast('Berhasil', 'Dompet baru berhasil ditambahkan!', 'success');
    closeWalletModal();
    await fetchWallets();
    updateBalance(allTransactions); // refresh UI
  }
}

// --- Delete Wallet ---
let deleteWalletId = null;

function hapusDompet(id, name) {
  deleteWalletId = id;
  document.getElementById('delete-wallet-modal').classList.remove('hidden');
}

function closeDeleteWalletModal() {
  deleteWalletId = null;
  document.getElementById('delete-wallet-modal').classList.add('hidden');
}

async function confirmDeleteWallet() {
  if (!deleteWalletId) {
    closeDeleteWalletModal();
    return;
  }

  const userCode = localStorage.getItem('user_code');
  const { error } = await supabaseClient
    .from('wallets')
    .delete()
    .eq('id', deleteWalletId)
    .eq('user_code', userCode);

  closeDeleteWalletModal();

  if (error) {
    showToast('Gagal', 'Gagal menghapus dompet: ' + error.message, 'error');
  } else {
    showToast('Berhasil', 'Dompet beserta transaksinya berhasil dihapus!', 'success');
    await fetchWallets();
    // After wallet is deleted, we must fetch transactions again because some might have been cascaded
    fetchTransactions();
  }

  deleteWalletId = null;
}

function toggleTransferDest() {
  const type = document.getElementById('type').value;
  const destGroup = document.getElementById('dest-wallet-group');
  if (type === 'transfer') {
    destGroup.classList.remove('hidden');
  } else {
    destGroup.classList.add('hidden');
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

  // --- DECRYPT DATA ---
  const decryptedData = (data || []).map(trx => {
    return {
      ...trx,
      amount: Number(decrypt(trx.amount, userCode)) || 0,
      type: decrypt(trx.type, userCode),
      category: decrypt(trx.category, userCode),
      description: decrypt(trx.description, userCode)
    };
  });

  allTransactions = decryptedData;

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
    let typeLabel = '';
    let badgeClass = '';
    let rowClass = '';
    let amountClass = '';
    let amountPrefix = '';

    if (trx.type === 'expense') {
      typeLabel = '🔴 Keluar';
      badgeClass = 'badge-expense';
      rowClass = 'row-expense';
      amountClass = 'amount-expense';
      amountPrefix = '- Rp';
    } else if (trx.type === 'income') {
      typeLabel = '🟢 Masuk';
      badgeClass = 'badge-income';
      rowClass = 'row-income';
      amountClass = 'amount-income';
      amountPrefix = '+ Rp';
    } else {
      typeLabel = '↔️ Transfer';
      badgeClass = 'badge-transfer'; // we can just reuse income or expense or custom
      rowClass = '';
      amountClass = '';
      amountPrefix = 'Rp';
    }

    const safeDesc = (trx.description || '-').replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const trxId = getTrxId(trx);

    let fromWallet = allWallets.find(w => w.id == trx.wallet_id)?.wallet_name || '-';
    let toWallet = allWallets.find(w => w.id == trx.to_wallet_id)?.wallet_name || '-';
    let walletInfo = trx.type === 'transfer' ? `${fromWallet} ➔ ${toWallet}` : fromWallet;

    const row = `
      <tr class="${rowClass}">
        <td>${new Date(trx.date).toLocaleDateString('id-ID')}</td>
        <td><span class="type-badge ${badgeClass}">${typeLabel}</span></td>
        <td>${trx.category} <br><small style="color:var(--text-muted)">${walletInfo}</small></td>
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
  let totalIncome = 0;
  let totalExpense = 0;

  // Initialize wallet balances
  const walletBalances = {};
  let totalWalletsInitial = 0;
  allWallets.forEach(w => {
    walletBalances[w.id] = w.initial_balance;
    totalWalletsInitial += w.initial_balance;
  });

  // Legacy balance tidak lagi menggunakan initial_balance dari users (mulai dari 0)
  let legacyBalance = 0;

  transactions.forEach(trx => {
    const amt = Number(trx.amount);
    const isLegacyOrigin = !trx.wallet_id;
    const isLegacyDest = !trx.to_wallet_id;

    if (trx.type === 'income') {
      totalIncome += amt;
      if (isLegacyOrigin) legacyBalance += amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] += amt;
    } else if (trx.type === 'expense') {
      totalExpense += amt;
      if (isLegacyOrigin) legacyBalance -= amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] -= amt;
    } else if (trx.type === 'transfer') {
      if (isLegacyOrigin) legacyBalance -= amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] -= amt;

      if (isLegacyDest) legacyBalance += amt;
      else if (walletBalances[trx.to_wallet_id] !== undefined) walletBalances[trx.to_wallet_id] += amt;
    }
  });

  // Total Kekayaan = JUMLAH TOTAL dari saldo akhir SEMUA dompet
  let sumWalletBalances = 0;
  for (let key in walletBalances) {
    sumWalletBalances += walletBalances[key];
  }
  const currentBalance = legacyBalance + sumWalletBalances;

  // Store globally for MAX button
  window.currentWalletBalances = walletBalances;
  window.currentLegacyBalance = legacyBalance;

  // Refresh Dropdowns based on legacy balance existence
  populateWalletDropdowns(legacyBalance > 0);

  const balanceText = 'Rp ' + toRibuan(currentBalance);
  const incomeText = 'Rp ' + toRibuan(totalIncome);
  const expenseText = 'Rp ' + toRibuan(totalExpense);

  const balanceEl = document.getElementById('current-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expense');
  const walletsContainer = document.getElementById('wallets-container');

  balanceEl.setAttribute('data-value', balanceText);
  incomeEl.setAttribute('data-value', incomeText);
  expenseEl.setAttribute('data-value', expenseText);

  // Render Wallet UI
  if (walletsContainer) {
    walletsContainer.innerHTML = '';

    // 1. Render Legacy Wallet if balance > 0
    if (legacyBalance > 0) {
      const balStr = 'Rp ' + toRibuan(legacyBalance);
      const div = document.createElement('div');
      div.className = 'wallet-item';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width: 100%;">
          <span class="wallet-name" style="color:var(--expense-text)">⚠️ Belum Dikategorikan</span>
        </div>
        <span class="wallet-bal ${isBalanceHidden ? 'blurred' : ''}" data-value="${balStr}">${isBalanceHidden ? 'Rp •••••••' : balStr}</span>
      `;
      walletsContainer.appendChild(div);
    }

    // 2. Render seluruh dompet yang ada
    allWallets.forEach(w => {
      const wBal = walletBalances[w.id];
      const balStr = 'Rp ' + toRibuan(wBal);
      const div = document.createElement('div');
      div.className = 'wallet-item';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width: 100%;">
          <span class="wallet-name">${w.wallet_name}</span>
          <button class="btn-action btn-action-delete" style="padding: 2px 4px; font-size: 0.8rem; margin-bottom: 6px;" onclick="hapusDompet(${w.id}, '${w.wallet_name}')" title="Hapus Dompet">🗑️</button>
        </div>
        <span class="wallet-bal ${isBalanceHidden ? 'blurred' : ''}" data-value="${balStr}">${isBalanceHidden ? 'Rp •••••••' : balStr}</span>
      `;
      walletsContainer.appendChild(div);
    });

    // Tambah Card "Tambah Dompet"
    const addBtn = document.createElement('div');
    addBtn.className = 'wallet-item wallet-add';
    addBtn.setAttribute('onclick', 'showWalletModal()');
    addBtn.innerHTML = `
      <span style="font-size: 1.5rem; margin-bottom: 4px;">+</span>
      <span style="font-size: 0.85rem; font-weight: 600;">Tambah Dompet</span>
    `;
    walletsContainer.appendChild(addBtn);
  }

  if (isBalanceHidden) {
    balanceEl.textContent = 'Rp •••••••';
    incomeEl.textContent = 'Rp •••••••';
    expenseEl.textContent = 'Rp •••••••';
    balanceEl.classList.add('blurred');
    incomeEl.classList.add('blurred');
    expenseEl.classList.add('blurred');
  } else {
    balanceEl.textContent = balanceText;
    incomeEl.textContent = incomeText;
    expenseEl.textContent = expenseText;
    balanceEl.classList.remove('blurred');
    incomeEl.classList.remove('blurred');
    expenseEl.classList.remove('blurred');
  }

  // === Negative Balance Mascot ===
  const mascot = document.getElementById('negative-mascot');
  const balanceCard = document.querySelector('.balance-card');

  if (currentBalance < 0 && mascot) {
    mascot.classList.remove('hidden');
    balanceCard.classList.add('negative-shake');
    balanceEl.style.color = 'var(--expense-text)';
  } else if (mascot) {
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
  const walletId = document.getElementById('wallet-id').value;
  const toWalletId = document.getElementById('to-wallet-id').value;

  if (!amount || amount <= 0) { showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning'); return; }
  if (!category) { showToast('Perhatian', 'Kategori harus diisi!', 'warning'); return; }
  if (!walletId) { showToast('Perhatian', 'Pilih dompet asal!', 'warning'); return; }
  if (type === 'transfer' && !toWalletId) { showToast('Perhatian', 'Pilih dompet tujuan!', 'warning'); return; }
  if (type === 'transfer' && walletId === toWalletId) { showToast('Perhatian', 'Dompet asal dan tujuan tidak boleh sama!', 'warning'); return; }

  // --- ENCRYPT PAYLOAD ---
  const encryptedAmount = encrypt(amount.toString(), userCode);
  const encryptedType = encrypt(type, userCode);
  const encryptedCategory = encrypt(category, userCode);
  const encryptedDescription = encrypt(description, userCode);

  const payload = {
    amount: encryptedAmount, type: encryptedType, category: encryptedCategory, description: encryptedDescription,
    date: new Date().toISOString().split('T')[0], user_code: userCode,
    wallet_id: walletId === 'legacy' ? null : walletId
  };

  if (type === 'transfer') {
    payload.to_wallet_id = toWalletId === 'legacy' ? null : toWalletId;
  }

  const { error } = await supabaseClient.from('transactions').insert([payload]);

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
  if (trx.wallet_id) {
    document.getElementById('wallet-id').value = trx.wallet_id;
  } else {
    document.getElementById('wallet-id').value = 'legacy';
  }

  if (trx.to_wallet_id) {
    document.getElementById('to-wallet-id').value = trx.to_wallet_id;
  } else if (trx.type === 'transfer' && !trx.to_wallet_id) {
    document.getElementById('to-wallet-id').value = 'legacy';
  }

  const typeSelect = document.getElementById('type');
  typeSelect.value = trx.type;
  toggleTransferDest();

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
  toggleTransferDest();

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
  const walletId = document.getElementById('wallet-id').value;
  const toWalletId = document.getElementById('to-wallet-id').value;

  if (!amount || amount <= 0) {
    showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning');
    return;
  }
  if (!category) {
    showToast('Perhatian', 'Kategori harus diisi!', 'warning');
    return;
  }
  if (!walletId) { showToast('Perhatian', 'Pilih dompet asal!', 'warning'); return; }
  if (type === 'transfer' && !toWalletId) { showToast('Perhatian', 'Pilih dompet tujuan!', 'warning'); return; }
  if (type === 'transfer' && walletId === toWalletId) { showToast('Perhatian', 'Dompet asal dan tujuan tidak boleh sama!', 'warning'); return; }

  // --- ENCRYPT PAYLOAD ---
  const encryptedAmount = encrypt(amount.toString(), userCode);
  const encryptedType = encrypt(type, userCode);
  const encryptedCategory = encrypt(category, userCode);
  const encryptedDescription = encrypt(description, userCode);

  const updatePayload = {
    amount: encryptedAmount,
    type: encryptedType,
    category: encryptedCategory,
    description: encryptedDescription,
    wallet_id: walletId === 'legacy' ? null : walletId,
    to_wallet_id: type === 'transfer' ? (toWalletId === 'legacy' ? null : toWalletId) : null
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
    showToast('Token Tidak Tersedia', 'Kombinasi token ini tidak valid atau tidak tersedia. Silakan gunakan kombinasi lain.', 'warning');
    return;
  }

  console.log('[ArcadeFin] EDIT TOKEN — old:', oldToken, '| new:', newToken);

  try {
    // 1. Ambil semua data dengan oldToken terlebih dahulu
    const { data: oldUser } = await supabaseClient.from('users').select('*').eq('user_code', oldToken).single();
    if (!oldUser) {
      showToast('Gagal', 'Tidak dapat mengambil data akun saat ini.', 'error');
      return;
    }
    const { data: walletsData } = await supabaseClient.from('wallets').select('*').eq('user_code', oldToken);
    const { data: trxData } = await supabaseClient.from('transactions').select('*').eq('user_code', oldToken);
    const { data: budgetsData } = await supabaseClient.from('budgets').select('*').eq('user_code', oldToken);

    // 2. Siapkan data dengan enkripsi baru (newToken)
    let decUserBal;
    try { decUserBal = decrypt(oldUser.initial_balance, oldToken); } catch { decUserBal = oldUser.initial_balance; }
    const encUserBal = encrypt(decUserBal.toString(), newToken);

    const newWallets = (walletsData || []).map(w => {
      let decName, decBal;
      try { decName = decrypt(w.wallet_name, oldToken); } catch { decName = w.wallet_name; }
      try { decBal = decrypt(w.initial_balance, oldToken); } catch { decBal = w.initial_balance; }
      return {
        ...w,
        user_code: newToken,
        wallet_name: encrypt(decName, newToken),
        initial_balance: encrypt(decBal.toString(), newToken)
      };
    });

    const newTrx = (trxData || []).map(trx => {
      let decAmt, decCat, decDesc, decType;
      try { decAmt = decrypt(trx.amount, oldToken); } catch { decAmt = trx.amount; }
      try { decCat = decrypt(trx.category, oldToken); } catch { decCat = trx.category; }
      try { decDesc = decrypt(trx.description, oldToken); } catch { decDesc = trx.description || ''; }
      try { decType = decrypt(trx.type, oldToken); } catch { decType = trx.type; }

      return {
        ...trx,
        user_code: newToken,
        amount: encrypt(decAmt.toString(), newToken),
        category: encrypt(decCat, newToken),
        description: encrypt(decDesc, newToken),
        type: encrypt(decType, newToken)
      };
    });

    const newBudgets = (budgetsData || []).map(b => {
      let decCat, decLimit;
      try { decCat = decrypt(b.category, oldToken); } catch { decCat = b.category; }
      try { decLimit = decrypt(b.amount_limit, oldToken); } catch { decLimit = b.amount_limit; }
      return {
        ...b,
        user_code: newToken,
        category: encrypt(decCat, newToken),
        amount_limit: encrypt(decLimit.toString(), newToken)
      };
    });

    // 3. Masukkan (Insert) user baru agar foreign key tidak error
    const { error: insertErr } = await supabaseClient.from('users').insert([{
      user_code: newToken,
      name: oldUser.name,
      email: oldUser.email,
      initial_balance: encUserBal
    }]);

    let directError = null;
    if (insertErr && insertErr.code !== '23505') {
      console.warn('Insert user gagal:', insertErr);
    }

    // Coba direct update jika insert tidak diperlukan (ON UPDATE CASCADE)
    const { error: dErr } = await supabaseClient
      .from('users')
      .update({ user_code: newToken, initial_balance: encUserBal })
      .eq('user_code', oldToken);
    directError = dErr;

    // 4. Update data baris per baris secara manual
    if (newWallets.length > 0) {
      for (const w of newWallets) {
        const payload = {
          user_code: newToken,
          wallet_name: w.wallet_name,
          initial_balance: w.initial_balance
        };
        const { error } = await supabaseClient.from('wallets').update(payload).eq('id', w.id);
        if (error) console.error('[ArcadeFin] Gagal update wallet:', error);
      }
    }

    if (newTrx.length > 0) {
      for (const trx of newTrx) {
        const payload = {
          user_code: newToken,
          amount: trx.amount,
          category: trx.category,
          description: trx.description,
          type: trx.type
        };
        const { error } = await supabaseClient.from('transactions').update(payload).eq('id', trx.id);
        if (error) console.error('[ArcadeFin] Gagal update trx:', error);
      }
    }

    if (newBudgets.length > 0) {
      for (const b of newBudgets) {
        const payload = {
          user_code: newToken,
          category: b.category,
          amount_limit: b.amount_limit
        };
        const { error } = await supabaseClient.from('budgets').update(payload).eq('id', b.id);
        if (error) console.error('[ArcadeFin] Gagal update budget:', error);
      }
    }

    // 5. Bersihkan sisa-sisa
    if (directError) {
      // Jika direct update gagal tapi insert berhasil, hapus user lama
      await supabaseClient.from('users').delete().eq('user_code', oldToken);
    }

    // 6. Update localStorage
    localStorage.setItem('user_code', newToken);
    const customCycle = localStorage.getItem('budget_cycle_' + oldToken);
    if (customCycle) {
      localStorage.setItem('budget_cycle_' + newToken, customCycle);
      localStorage.removeItem('budget_cycle_' + oldToken);
    }

    closeEditTokenModal();
    showToast('Berhasil', 'Token Anda berhasil diperbarui menjadi: ' + newToken, 'success');

    // Refresh & Force Recalculate
    await fetchWallets();
    await fetchTransactions();

    if (currentPage === 'page-rekap') renderRekapPage();
    if (currentPage === 'page-dashboard') renderDashboard();

  } catch (err) {
    console.error('[ArcadeFin] Error saat migrasi token:', err);
    showToast('Gagal', 'Terjadi kesalahan sistem saat migrasi token. Cek Console.', 'error');
  }
}

// ===================================================
// 14. REKAP & BUDGETING
// ===================================================

let allBudgets = [];
let deleteBudgetId = null;
let editBudgetId = null;

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

  const decryptedData = (data || []).map(b => {
    return {
      ...b,
      category: decrypt(b.category, userCode),
      amount_limit: Number(decrypt(b.amount_limit, userCode)) || 0
    };
  });
  allBudgets = decryptedData;
  return allBudgets;
}

// --- Budget Modal ---
function showBudgetModal() {
  document.getElementById('budget-category').value = '';
  document.getElementById('budget-amount').value = '';
  editBudgetId = null;
  document.getElementById('budget-modal').classList.remove('hidden');
}

function closeBudgetModal() {
  editBudgetId = null;
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

  const encryptedCategory = encrypt(category, userCode);
  const encryptedAmountLimit = encrypt(amountLimit.toString(), userCode);

  if (editBudgetId) {
    // Update existing budget
    const { error } = await supabaseClient
      .from('budgets')
      .update({ amount_limit: encryptedAmountLimit, category: encryptedCategory })
      .eq('id', editBudgetId)
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
      category: encryptedCategory,
      amount_limit: encryptedAmountLimit
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

// --- Edit Budget ---
function editBudget(id) {
  const budget = allBudgets.find(b => b.id === id);
  if (!budget) return;

  editBudgetId = id;
  document.getElementById('budget-category').value = budget.category;
  document.getElementById('budget-amount').value = toRibuan(budget.amount_limit);
  document.getElementById('budget-modal').classList.remove('hidden');
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
    else if (trx.type === 'income') totalIncomeFiltered += Number(trx.amount);
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

  // Cek apakah user punya custom budget cycle (manual reset)
  const userCode = localStorage.getItem('user_code');
  const customStartDateStr = localStorage.getItem('budget_cycle_' + userCode);
  let cycleStartDate = null;
  if (customStartDateStr) {
    cycleStartDate = new Date(customStartDateStr);
  }

  const cycleExpenses = allTransactions.filter(trx => {
    if (trx.type !== 'expense') return false;
    const d = new Date(trx.date);
    if (cycleStartDate) {
      return d >= cycleStartDate;
    } else {
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }
  });

  // Aggregate cycle expenses by category (case-insensitive)
  const expenseByCategory = {};
  cycleExpenses.forEach(trx => {
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
          <button class="btn-action" onclick="editBudget(${budget.id})">✏️</button>
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
        ${isOver ? '⚠️ Overbudget!' : ''} ${percent}% (siklus ini: Rp ${toRibuan(monthlySpent)})
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
    if (btnToggle) btnToggle.textContent = '☀️ Terang';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    if (btnToggle) btnToggle.textContent = '🌙 Gelap';
  }
}

// ===================================================
// 16. INISIALISASI
// ===================================================

window.onload = () => {
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('[PWA] Service Worker registered.', reg))
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  }

  // Theme init
  const savedTheme = localStorage.getItem('theme');
  const btnToggle = document.getElementById('btn-theme-toggle');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (btnToggle) btnToggle.textContent = '🌙 Gelap';
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

// ===================================================
// 17. FITUR TAMBAHAN (MAX & AUTO-GENERATE)
// ===================================================

function fillMaxAmount() {
  const type = document.getElementById('type').value;
  if (type === 'income') return; // MAX tidak relevan untuk pemasukan

  const walletId = document.getElementById('wallet-id').value;
  if (!walletId) {
    showToast('Perhatian', 'Pilih dompet asal terlebih dahulu!', 'warning');
    return;
  }

  let maxAmount = 0;
  if (walletId === 'legacy') {
    maxAmount = window.currentLegacyBalance || 0;
  } else {
    maxAmount = (window.currentWalletBalances && window.currentWalletBalances[walletId]) || 0;
  }

  if (maxAmount < 0) maxAmount = 0;

  const amountInput = document.getElementById('amount');
  amountInput.value = toRibuan(maxAmount);
}

function generateRandomToken(inputId) {
  const prefix = 'Arcade';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '_';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const token = prefix + randomPart;
  document.getElementById(inputId).value = token;
}

// ===================================================
// 18. RESET DATA (HAPUS SEMUA TRANSAKSI & BUDGET)
// ===================================================

function showResetDataModal() {
  document.getElementById('reset-confirm-input').value = '';
  document.getElementById('reset-data-modal').classList.remove('hidden');
}

function closeResetDataModal() {
  document.getElementById('reset-data-modal').classList.add('hidden');
}

async function confirmResetData() {
  const confirmInput = document.getElementById('reset-confirm-input').value.trim().toUpperCase();
  if (confirmInput !== 'RESET') {
    showToast('Perhatian', 'Ketik kata RESET dengan benar untuk melanjutkan!', 'warning');
    return;
  }

  const userCode = localStorage.getItem('user_code');
  if (!userCode) return;

  // Simpan tanggal hari ini dengan format YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  localStorage.setItem('budget_cycle_' + userCode, todayStr);

  closeResetDataModal();
  showToast('Berhasil', 'Siklus Budget berhasil direset mulai hari ini!', 'success');

  // Refresh UI Rekap seketika
  if (currentPage === 'page-rekap') {
    renderRekapPage();
  }
}
