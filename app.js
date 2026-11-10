// ===================================================
// ARCADEFIN — App Logic
// Refactored Mobile-First Architecture with Bottom Navbar,
// Wallets Preset System, and Interactive Review Calendar & Leaderboard
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
  return parseInt(str.toString().replace(/\./g, ''), 10) || 0;
}

function toRibuan(num) {
  return Number(num || 0).toLocaleString('id-ID');
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
  if (!text && text !== 0) return text;
  return CryptoJS.AES.encrypt(text.toString(), secretKey).toString();
}

function decrypt(cipherText, secretKey) {
  if (!cipherText) return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText.toString(), secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      return cipherText;
    }
    return originalText;
  } catch (error) {
    return cipherText;
  }
}

// --- Parse Transaction Timestamp Safely (UTC normalized) ---
function parseTrxTime(trx) {
  if (trx && trx.created_at) {
    let s = trx.created_at.toString().trim();
    if (!s.endsWith('Z') && !s.slice(10).includes('+') && !s.slice(10).includes('-')) {
      s += 'Z';
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  if (trx && trx.date) {
    const parts = trx.date.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
    }
    return new Date(trx.date);
  }
  return new Date();
}

// ===================================================
// 3. UI HELPERS — Toast & Auth Transitions
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

// --- Auth Form Transitions ---
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

  const authTabs = document.getElementById('auth-tabs');
  if (authTabs) {
    authTabs.style.display = '';
    authTabs.classList.remove('hidden');
  }

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    if (indicator) indicator.classList.remove('tab-right');
    showAuthForm('form-login', 'left');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    if (indicator) indicator.classList.add('tab-right');
    showAuthForm('form-register', 'right');
  }
}

// ===================================================
// 4. NAVIGASI SCREEN & 1. BOTTOM NAVBAR SPA ROUTING
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

  fetchWallets()
    .then(() => fetchTransactions())
    .then(() => fetchBudgets())
    .then(() => {
      switchPage(currentPage || 'page-transaksi');
    });
}

// --- 1. BOTTOM NAVBAR SPA ROUTING (3 Main Menus) ---
// Menu 1: 'page-transaksi' (Default)
// Menu 2: 'page-budget'
// Menu 3: 'page-review'
let currentPage = 'page-transaksi';

function switchPage(pageId) {
  // Alias backward compatibility
  if (pageId === 'page-dashboard') pageId = 'page-transaksi';
  if (pageId === 'page-rekap') pageId = 'page-budget';

  currentPage = pageId;

  // Update bottom navigation bar items
  const allNavItems = document.querySelectorAll('.bottom-navbar .bottom-nav-item');
  allNavItems.forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch pages visibility
  const allPages = document.querySelectorAll('.spa-page');
  allPages.forEach(p => p.classList.remove('spa-page-active'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('spa-page-active');
  }

  // Handle specific page activations
  if (pageId === 'page-transaksi') {
    updateBalance(allTransactions);
  } else if (pageId === 'page-budget') {
    renderRekapPage();
  } else if (pageId === 'page-review') {
    renderReviewPage();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const tokenRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;
  if (!customToken || !tokenRegex.test(customToken)) {
    showToast('Validasi Gagal', 'Token harus mengandung minimal 1 huruf dan 1 angka!', 'warning');
    return;
  }

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

  // Tambahkan dompet pertama ke tabel wallets dengan icon identifier
  const initialWalletIcon = detectWalletIcon(walletName);
  const encryptedWalletName = encrypt(walletName, customToken);
  const encryptedWalletBalance = encrypt(initialBalance.toString(), customToken);

  const walletPayload = {
    user_code: customToken,
    wallet_name: encryptedWalletName,
    initial_balance: encryptedWalletBalance,
    icon: initialWalletIcon
  };

  let { error: walletError } = await supabaseClient.from('wallets').insert([walletPayload]);
  if (walletError && walletError.message && (walletError.message.includes('icon') || walletError.code === 'PGRST204')) {
    delete walletPayload.icon;
    const retry = await supabaseClient.from('wallets').insert([walletPayload]);
    walletError = retry.error;
  }

  if (walletError) {
    console.error('Gagal membuat dompet pertama:', walletError);
  }

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
// 6. LOGIN
// ===================================================

async function loginUser() {
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
// 8. HIDE / SHOW BALANCE & WALLETS
// ===================================================

let isBalanceHidden = false;
let isWalletsHidden = false;

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
    balanceEl.textContent = balanceEl.getAttribute('data-value') || 'Rp 0';
    incomeEl.textContent = incomeEl.getAttribute('data-value') || 'Rp 0';
    expenseEl.textContent = expenseEl.getAttribute('data-value') || 'Rp 0';

    balanceEl.classList.remove('blurred');
    incomeEl.classList.remove('blurred');
    expenseEl.classList.remove('blurred');

    eyeOpen.classList.remove('hidden');
    eyeClosed.classList.add('hidden');
  }
}

function toggleWalletsVisibility() {
  isWalletsHidden = !isWalletsHidden;
  updateBalance(allTransactions);
}

// ===================================================
// 8.5 & 3. FITUR LOGO DOMPET & MULTI-WALLET SYSTEM
// ===================================================

let allWallets = [];
let selectedWalletPreset = 'cash';

// Master registry of official wallet logos (26 Financial Institutions & Cash)
const WALLET_LOGOS = {
  // Major Conventional Banks
  bca: { src: 'aset/logos/bca.png', name: 'BCA' },
  mandiri: { src: 'aset/logos/mandiri.png', name: 'Bank Mandiri' },
  bri: { src: 'aset/logos/bri.png', name: 'BRI' },
  bni: { src: 'aset/logos/bni.png', name: 'BNI' },
  cimb: { src: 'aset/logos/cimb.png', name: 'CIMB Niaga' },
  permata: { src: 'aset/logos/permata.png', name: 'Permata Bank' },
  danamon: { src: 'aset/logos/danamon.png', name: 'Bank Danamon' },
  btn: { src: 'aset/logos/btn.png', name: 'Bank BTN' },

  // Regional Banks (BPD)
  bankjateng: { src: 'aset/logos/bankjateng.png', name: 'Bank Jateng' },
  bankjatim: { src: 'aset/logos/bankjatim.png', name: 'Bank Jatim' },
  bjb: { src: 'aset/logos/bjb.png', name: 'Bank BJB' },
  bankdki: { src: 'aset/logos/bankdki.png', name: 'Bank DKI' },
  banksumut: { src: 'aset/logos/banksumut.png', name: 'Bank Sumut' },

  // Digital Banks
  jago: { src: 'aset/logos/jago.png', name: 'Bank Jago' },
  seabank: { src: 'aset/logos/seabank.png', name: 'SeaBank' },
  blu: { src: 'aset/logos/blu.png', name: 'Blu by BCA' },
  neobank: { src: 'aset/logos/neobank.png', name: 'Neobank / BNC' },
  allobank: { src: 'aset/logos/allobank.png', name: 'Allo Bank' },
  superbank: { src: 'aset/logos/superbank.png', name: 'Superbank' },
  jenius: { src: 'aset/logos/jenius.png', name: 'Jenius' },

  // E-Wallets & Others
  gopay: { src: 'aset/logos/gopay.png', name: 'GoPay' },
  ovo: { src: 'aset/logos/ovo.png', name: 'OVO' },
  dana: { src: 'aset/logos/dana.png', name: 'DANA' },
  shopeepay: { src: 'aset/logos/shopeepay.png', name: 'ShopeePay' },
  linkaja: { src: 'aset/logos/linkaja.png', name: 'LinkAja' },
  cash: { src: 'aset/logos/cash.png', name: 'Tunai / Cash' }
};

// Auto-detect wallet icon identifier from name
function detectWalletIcon(name) {
  if (!name) return 'cash';
  const n = name.toLowerCase();

  // Conventional
  if (n.includes('bca') || n.includes('central asia')) return 'bca';
  if (n.includes('mandiri') || n.includes('livin')) return 'mandiri';
  if (n.includes('bri') || n.includes('brimo')) return 'bri';
  if (n.includes('bni')) return 'bni';
  if (n.includes('cimb') || n.includes('niaga') || n.includes('octo')) return 'cimb';
  if (n.includes('permata')) return 'permata';
  if (n.includes('danamon')) return 'danamon';
  if (n.includes('btn')) return 'btn';

  // Regional (BPD)
  if (n.includes('jateng')) return 'bankjateng';
  if (n.includes('jatim')) return 'bankjatim';
  if (n.includes('bjb') || n.includes('jabar')) return 'bjb';
  if (n.includes('dki') || n.includes('jakone')) return 'bankdki';
  if (n.includes('sumut')) return 'banksumut';

  // Digital
  if (n.includes('jago')) return 'jago';
  if (n.includes('seabank') || n.includes('sea bank')) return 'seabank';
  if (n.includes('blu')) return 'blu';
  if (n.includes('neo') || n.includes('bnc')) return 'neobank';
  if (n.includes('allo')) return 'allobank';
  if (n.includes('superbank') || n.includes('fama')) return 'superbank';
  if (n.includes('jenius') || n.includes('btpn')) return 'jenius';

  // E-Wallet & Cash
  if (n.includes('gopay') || n.includes('go-pay') || n.includes('gojek')) return 'gopay';
  if (n.includes('ovo')) return 'ovo';
  if (n.includes('dana')) return 'dana';
  if (n.includes('shopee') || n.includes('spay')) return 'shopeepay';
  if (n.includes('linkaja') || n.includes('link aja') || n.includes('tcash')) return 'linkaja';
  if (n.includes('cash') || n.includes('tunai') || n.includes('dompet') || n.includes('uang') || n.includes('fisik')) return 'cash';

  return 'default';
}

// Generate brand badge HTML with official logo image inside standardized 36x36px container for card display
function getWalletBadgeHTML(iconKey, name) {
  const icon = (iconKey || detectWalletIcon(name) || 'cash').toLowerCase();
  const info = WALLET_LOGOS[icon];
  if (info) {
    return `<div class="wallet-brand-badge" title="${info.name}" style="width: 36px; height: 36px; min-width: 36px; min-height: 36px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden;">
      <img src="${info.src}" alt="${info.name}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 6px; display: block;">
    </div>`;
  }
  return `<div class="wallet-brand-badge badge-default" title="Dompet" style="width: 36px; height: 36px; min-width: 36px; min-height: 36px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">💳</div>`;
}

// Preset selection inside Tambah Dompet modal
function selectWalletPreset(presetKey, presetName) {
  selectedWalletPreset = presetKey;
  const inputName = document.getElementById('wallet-name');
  const inputIcon = document.getElementById('wallet-icon-val');
  if (inputName) inputName.value = presetName;
  if (inputIcon) inputIcon.value = presetKey;

  const allPresets = document.querySelectorAll('.wallet-presets-grid .preset-btn');
  allPresets.forEach(btn => {
    if (btn.getAttribute('data-preset') === presetKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

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
    try { decName = decrypt(w.wallet_name, userCode); } catch (e) { }
    try { decBal = decrypt(w.initial_balance, userCode); } catch (e) { }

    return {
      ...w,
      wallet_name: decName,
      initial_balance: Number(decBal) || 0,
      icon: w.icon || detectWalletIcon(decName)
    };
  });
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
  document.getElementById('wallet-icon-val').value = 'cash';
  selectedWalletPreset = 'cash';

  const allPresets = document.querySelectorAll('.wallet-presets-grid .preset-btn');
  allPresets.forEach(btn => {
    if (btn.getAttribute('data-preset') === 'cash') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

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
  const icon = document.getElementById('wallet-icon-val').value || selectedWalletPreset || detectWalletIcon(name);

  if (!name) {
    showToast('Perhatian', 'Nama dompet harus diisi!', 'warning');
    return;
  }

  const encName = encrypt(name, userCode);
  const encBal = encrypt(bal.toString(), userCode);

  const payload = {
    user_code: userCode,
    wallet_name: encName,
    initial_balance: encBal,
    icon: icon
  };

  let { error } = await supabaseClient.from('wallets').insert([payload]);

  // Fallback jika tabel wallets Supabase belum memiliki kolom 'icon'
  if (error && error.message && (error.message.includes('icon') || error.code === 'PGRST204')) {
    delete payload.icon;
    const retry = await supabaseClient.from('wallets').insert([payload]);
    error = retry.error;
  }

  if (error) {
    showToast('Gagal', 'Gagal menyimpan dompet: ' + error.message, 'error');
  } else {
    showToast('Berhasil', 'Dompet baru berhasil ditambahkan!', 'success');
    closeWalletModal();
    await fetchWallets();
    updateBalance(allTransactions);
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
// 9. FETCH, RENDER, FILTER & UPDATE SALDO
// ===================================================

let allTransactions = [];
let filteredTransactions = [];
let currentPageNum = 1;
const ITEMS_PER_PAGE = 10;
let ID_COLUMN = 'id';

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

  if (allTransactions.length > 0) {
    const keys = Object.keys(allTransactions[0]);
    const idKey = keys.find(k => k.toLowerCase() === 'id');
    if (idKey) {
      ID_COLUMN = idKey;
    }
  }

  applyTimeFilter();
  updateBalance(allTransactions);

  if (currentPage === 'page-review') {
    renderReviewPage();
  } else if (currentPage === 'page-budget') {
    renderRekapPage();
  }
}

function getFilteredData(filterValue, sourceData) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  if (filterValue === 'today') {
    return sourceData.filter(trx => {
      if (!trx.date) return false;
      const parts = trx.date.split('-').map(Number);
      return parts[0] === currentYear && (parts[1] - 1) === currentMonth && parts[2] === currentDay;
    });
  } else if (filterValue === 'month') {
    return sourceData.filter(trx => {
      if (!trx.date) return false;
      const parts = trx.date.split('-').map(Number);
      return parts[0] === currentYear && (parts[1] - 1) === currentMonth;
    });
  } else if (filterValue === 'year') {
    return sourceData.filter(trx => {
      if (!trx.date) return false;
      const parts = trx.date.split('-').map(Number);
      return parts[0] === currentYear;
    });
  }
  return sourceData;
}

function applyTimeFilter() {
  const filterValue = document.getElementById('time-filter').value;
  filteredTransactions = getFilteredData(filterValue, allTransactions);
  currentPageNum = 1;
  renderPaginatedTable();
}

function renderPaginatedTable() {
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

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

  if (pageInfo) pageInfo.textContent = `Halaman ${currentPageNum} / ${totalPages}`;
  if (btnPrev) btnPrev.disabled = currentPageNum <= 1;
  if (btnNext) btnNext.disabled = currentPageNum >= totalPages;
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

function renderTable(data) {
  const tableBody = document.getElementById('transaction-list');
  if (!tableBody) return;
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
    let amountClass = '';
    let amountPrefix = '';

    if (trx.type === 'expense') {
      typeLabel = '🔴 Keluar';
      badgeClass = 'badge-expense';
      amountClass = 'amount-expense';
      amountPrefix = '- Rp';
    } else if (trx.type === 'income') {
      typeLabel = '🟢 Masuk';
      badgeClass = 'badge-income';
      amountClass = 'amount-income';
      amountPrefix = '+ Rp';
    } else {
      typeLabel = '↔️ Transfer';
      badgeClass = 'badge-transfer';
      amountClass = '';
      amountPrefix = 'Rp';
    }

    const safeDesc = (trx.description || '-').replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const trxId = getTrxId(trx);

    let fromWallet = allWallets.find(w => w.id == trx.wallet_id)?.wallet_name || '-';
    let toWallet = allWallets.find(w => w.id == trx.to_wallet_id)?.wallet_name || '-';
    let walletInfo = trx.type === 'transfer' ? `${fromWallet} ➔ ${toWallet}` : fromWallet;

    const row = `
      <tr>
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

  const userCode = localStorage.getItem('user_code');
  const customStartDateStr = userCode ? localStorage.getItem('budget_cycle_' + userCode) : null;
  let cycleStartDate = null;
  if (customStartDateStr) {
    cycleStartDate = new Date(customStartDateStr);
  }

  const walletBalances = {};
  allWallets.forEach(w => {
    walletBalances[w.id] = w.initial_balance;
  });

  let legacyBalance = 0;

  transactions.forEach(trx => {
    const amt = Number(trx.amount);
    const isLegacyOrigin = !trx.wallet_id;
    const isLegacyDest = !trx.to_wallet_id;
    const trxTime = parseTrxTime(trx);

    const isCurrentCycle = cycleStartDate ? (trxTime >= cycleStartDate) : true;

    if (trx.type === 'income') {
      if (isCurrentCycle) totalIncome += amt;
      if (isLegacyOrigin) legacyBalance += amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] += amt;
    } else if (trx.type === 'expense') {
      if (isCurrentCycle) totalExpense += amt;
      if (isLegacyOrigin) legacyBalance -= amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] -= amt;
    } else if (trx.type === 'transfer') {
      if (isLegacyOrigin) legacyBalance -= amt;
      else if (walletBalances[trx.wallet_id] !== undefined) walletBalances[trx.wallet_id] -= amt;

      if (isLegacyDest) legacyBalance += amt;
      else if (walletBalances[trx.to_wallet_id] !== undefined) walletBalances[trx.to_wallet_id] += amt;
    }
  });

  let sumWalletBalances = 0;
  for (let key in walletBalances) {
    sumWalletBalances += walletBalances[key];
  }
  const currentBalance = legacyBalance + sumWalletBalances;

  window.currentWalletBalances = walletBalances;
  window.currentLegacyBalance = legacyBalance;

  populateWalletDropdowns(legacyBalance > 0);

  const balanceText = 'Rp ' + toRibuan(currentBalance);
  const incomeText = 'Rp ' + toRibuan(totalIncome);
  const expenseText = 'Rp ' + toRibuan(totalExpense);

  const balanceEl = document.getElementById('current-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expense');
  const walletsContainer = document.getElementById('wallets-container');

  if (balanceEl) balanceEl.setAttribute('data-value', balanceText);
  if (incomeEl) incomeEl.setAttribute('data-value', incomeText);
  if (expenseEl) expenseEl.setAttribute('data-value', expenseText);

  // Render 3. DAFTAR DOMPET dengan LOGO/BADGE PRESET
  if (walletsContainer) {
    walletsContainer.innerHTML = '';

    if (legacyBalance > 0) {
      const balStr = 'Rp ' + toRibuan(legacyBalance);
      const div = document.createElement('div');
      div.className = 'wallet-item';
      div.innerHTML = `
        <div class="wallet-item-top">
          <div class="wallet-brand-info">
            <div class="wallet-brand-badge" style="background:#f59e0b;">⚠️</div>
            <span class="wallet-name" style="color:var(--warning-text)">Belum Kategori</span>
          </div>
        </div>
        <span class="wallet-bal ${isWalletsHidden ? 'blurred' : ''}" data-value="${balStr}">${isWalletsHidden ? 'Rp •••••••' : balStr}</span>
      `;
      walletsContainer.appendChild(div);
    }

    allWallets.forEach(w => {
      const wBal = walletBalances[w.id] !== undefined ? walletBalances[w.id] : w.initial_balance;
      const balStr = 'Rp ' + toRibuan(wBal);
      const div = document.createElement('div');
      div.className = 'wallet-item';
      div.innerHTML = `
        <div class="wallet-item-top">
          <div class="wallet-brand-info">
            ${getWalletBadgeHTML(w.icon, w.wallet_name)}
            <span class="wallet-name" title="${w.wallet_name}">${w.wallet_name}</span>
          </div>
          <button class="btn-action btn-action-delete" style="padding: 2px 6px; font-size: 0.75rem;" onclick="hapusDompet(${w.id}, '${w.wallet_name}')" title="Hapus Dompet">🗑️</button>
        </div>
        <span class="wallet-bal ${isWalletsHidden ? 'blurred' : ''}" data-value="${balStr}">${isWalletsHidden ? 'Rp •••••••' : balStr}</span>
      `;
      walletsContainer.appendChild(div);
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'wallet-item wallet-add';
    addBtn.setAttribute('onclick', 'showWalletModal()');
    addBtn.innerHTML = `
      <span style="font-size: 1.4rem; margin-bottom: 2px;">+</span>
      <span style="font-size: 0.82rem; font-weight: 600;">Tambah Dompet</span>
    `;
    walletsContainer.appendChild(addBtn);
  }

  if (balanceEl && incomeEl && expenseEl) {
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
  }

  const mascot = document.getElementById('negative-mascot');
  if (mascot) {
    if (currentBalance < 0) {
      mascot.classList.remove('hidden');
    } else {
      mascot.classList.add('hidden');
    }
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
// 10. TAMBAH & EDIT TRANSAKSI
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
  let category = document.getElementById('category-select').value === 'new' ? document.getElementById('category').value.trim() : document.getElementById('category-select').value;
  const description = document.getElementById('description').value.trim();
  const walletId = document.getElementById('wallet-id').value;
  const toWalletId = document.getElementById('to-wallet-id').value;

  if (!amount || amount <= 0) { showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning'); return; }
  if (!category) { showToast('Perhatian', 'Kategori harus diisi!', 'warning'); return; }
  if (!walletId) { showToast('Perhatian', 'Pilih dompet asal!', 'warning'); return; }
  if (type === 'transfer' && !toWalletId) { showToast('Perhatian', 'Pilih dompet tujuan!', 'warning'); return; }
  if (type === 'transfer' && walletId === toWalletId) { showToast('Perhatian', 'Dompet asal dan tujuan tidak boleh sama!', 'warning'); return; }

  const encryptedAmount = encrypt(amount.toString(), userCode);
  const encryptedType = encrypt(type, userCode);
  const encryptedCategory = encrypt(category, userCode);
  const encryptedDescription = encrypt(description, userCode);

  const payload = {
    amount: encryptedAmount,
    type: encryptedType,
    category: encryptedCategory,
    description: encryptedDescription,
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    user_code: userCode,
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

function editTransaksi(id) {
  const trx = allTransactions.find(t => String(getTrxId(t)) === String(id));
  if (!trx) {
    showToast('Error', 'Transaksi tidak ditemukan di data lokal.', 'error');
    return;
  }

  // Switch to transaksi page if editing from review
  if (currentPage !== 'page-transaksi') {
    switchPage('page-transaksi');
  }

  editTrxId = getTrxId(trx);

  document.getElementById('amount').value = toRibuan(trx.amount);

  const catSelect = document.getElementById('category-select');
  const catInput = document.getElementById('category');
  if (catSelect && catInput) {
    const optionExists = Array.from(catSelect.options).some(opt => opt.value === trx.category);
    if (optionExists && trx.category !== '') {
      catSelect.value = trx.category;
      catInput.classList.add('hidden');
      catInput.value = '';
    } else {
      catSelect.value = 'new';
      catInput.classList.remove('hidden');
      catInput.value = trx.category || '';
    }
  }

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
  const catSelect = document.getElementById('category-select');
  if (catSelect) catSelect.value = '';
  const catInput = document.getElementById('category');
  if (catInput) {
    catInput.value = '';
    catInput.classList.add('hidden');
  }
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

  const amount = parseRibuan(document.getElementById('amount').value);
  const type = document.getElementById('type').value;
  let category = document.getElementById('category-select').value === 'new' ? document.getElementById('category').value.trim() : document.getElementById('category-select').value;
  const description = document.getElementById('description').value.trim();
  const walletId = document.getElementById('wallet-id').value;
  const toWalletId = document.getElementById('to-wallet-id').value;

  if (!amount || amount <= 0) { showToast('Perhatian', 'Jumlah harus diisi dan lebih dari 0!', 'warning'); return; }
  if (!category) { showToast('Perhatian', 'Kategori harus diisi!', 'warning'); return; }
  if (!walletId) { showToast('Perhatian', 'Pilih dompet asal!', 'warning'); return; }
  if (type === 'transfer' && !toWalletId) { showToast('Perhatian', 'Pilih dompet tujuan!', 'warning'); return; }
  if (type === 'transfer' && walletId === toWalletId) { showToast('Perhatian', 'Dompet asal dan tujuan tidak boleh sama!', 'warning'); return; }

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

  const { data, error } = await supabaseClient
    .from('transactions')
    .update(updatePayload)
    .eq(ID_COLUMN, editTrxId)
    .eq('user_code', userCode)
    .select();

  if (error) {
    showToast('Gagal', 'Gagal update transaksi: ' + error.message, 'error');
  } else if (!data || data.length === 0) {
    showToast('Gagal', 'Update gagal — baris data tidak terpengaruh.', 'error');
  } else {
    showToast('Berhasil', 'Transaksi berhasil diperbarui!', 'success');
    cancelEdit();
    fetchTransactions();
  }
}

// --- Delete Transaction ---
let deleteTrxId = null;

function hapusTransaksi(id) {
  const trx = allTransactions.find(t => String(getTrxId(t)) === String(id));
  if (!trx) {
    showToast('Error', 'Transaksi tidak ditemukan.', 'error');
    return;
  }

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

  const { data, error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq(ID_COLUMN, deleteTrxId)
    .eq('user_code', userCode)
    .select();

  closeDeleteModal();

  if (error) {
    showToast('Gagal', 'Gagal menghapus transaksi: ' + error.message, 'error');
  } else if (!data || data.length === 0) {
    showToast('Gagal', 'Hapus gagal — data tidak ditemukan.', 'error');
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
// 11. EDIT TOKEN
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

  const { data: existByToken } = await supabaseClient.from('users').select('user_code').eq('user_code', newToken).limit(1);
  if (existByToken && existByToken.length > 0) {
    showToast('Token Tidak Tersedia', 'Kombinasi token ini tidak valid atau tidak tersedia.', 'warning');
    return;
  }

  try {
    const { data: oldUser } = await supabaseClient.from('users').select('*').eq('user_code', oldToken).single();
    if (!oldUser) {
      showToast('Gagal', 'Tidak dapat mengambil data akun saat ini.', 'error');
      return;
    }

    const { data: walletsData } = await supabaseClient.from('wallets').select('*').eq('user_code', oldToken);
    const { data: trxData } = await supabaseClient.from('transactions').select('*').eq('user_code', oldToken);
    const { data: budgetsData } = await supabaseClient.from('budgets').select('*').eq('user_code', oldToken);

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

    const { error: insertErr } = await supabaseClient.from('users').insert([{
      user_code: newToken,
      name: oldUser.name,
      email: oldUser.email,
      initial_balance: encUserBal
    }]);

    const { error: dErr } = await supabaseClient
      .from('users')
      .update({ user_code: newToken, initial_balance: encUserBal })
      .eq('user_code', oldToken);

    if (newWallets.length > 0) {
      for (const w of newWallets) {
        await supabaseClient.from('wallets').update({
          user_code: newToken,
          wallet_name: w.wallet_name,
          initial_balance: w.initial_balance
        }).eq('id', w.id);
      }
    }

    if (newTrx.length > 0) {
      for (const trx of newTrx) {
        await supabaseClient.from('transactions').update({
          user_code: newToken,
          amount: trx.amount,
          category: trx.category,
          description: trx.description,
          type: trx.type
        }).eq('id', trx.id);
      }
    }

    if (newBudgets.length > 0) {
      for (const b of newBudgets) {
        await supabaseClient.from('budgets').update({
          user_code: newToken,
          category: b.category,
          amount_limit: b.amount_limit
        }).eq('id', b.id);
      }
    }

    if (dErr) {
      await supabaseClient.from('users').delete().eq('user_code', oldToken);
    }

    localStorage.setItem('user_code', newToken);
    const customCycle = localStorage.getItem('budget_cycle_' + oldToken);
    if (customCycle) {
      localStorage.setItem('budget_cycle_' + newToken, customCycle);
      localStorage.removeItem('budget_cycle_' + oldToken);
    }

    closeEditTokenModal();
    showToast('Berhasil', 'Token Anda berhasil diperbarui menjadi: ' + newToken, 'success');

    await fetchWallets();
    await fetchTransactions();

    if (currentPage === 'page-budget') renderRekapPage();
    if (currentPage === 'page-review') renderReviewPage();
    if (currentPage === 'page-transaksi') updateBalance(allTransactions);

  } catch (err) {
    console.error('Error saat migrasi token:', err);
    showToast('Gagal', 'Terjadi kesalahan sistem saat migrasi token.', 'error');
  }
}

// ===================================================
// 12. MENU 2: BUDGET & REKAP
// ===================================================

let allBudgets = [];
let deleteBudgetId = null;
let editBudgetId = null;

async function fetchBudgets() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return [];

  const { data, error } = await supabaseClient
    .from('budgets')
    .select('*')
    .eq('user_code', userCode);

  if (error) {
    console.error('Fetch budgets error:', error);
    return [];
  }

  const decryptedData = (data || []).map(b => {
    return {
      ...b,
      category: (decrypt(b.category, userCode) || '').trim(),
      amount_limit: Number(decrypt(b.amount_limit, userCode)) || 0
    };
  });

  const mergedBudgets = [];
  const catMap = new Map();

  for (const b of decryptedData) {
    const key = (b.category || '').toLowerCase();
    if (catMap.has(key)) {
      const existing = catMap.get(key);
      existing.amount_limit += b.amount_limit;
      if (!existing.allIds) existing.allIds = [existing.id];
      existing.allIds.push(b.id);
    } else {
      const clone = { ...b, allIds: [b.id] };
      catMap.set(key, clone);
      mergedBudgets.push(clone);
    }
  }

  allBudgets = mergedBudgets;
  populateBudgetCategoryDatalist();
  return allBudgets;
}

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

  const categoryInput = document.getElementById('budget-category').value.trim();
  const amountLimit = parseRibuan(document.getElementById('budget-amount').value);

  if (!categoryInput) { showToast('Perhatian', 'Kategori harus diisi!', 'warning'); return; }
  if (!amountLimit || amountLimit <= 0) { showToast('Perhatian', 'Batas budget harus lebih dari 0!', 'warning'); return; }

  const existingBudget = allBudgets.find(b =>
    (b.category || '').trim().toLowerCase() === categoryInput.toLowerCase() &&
    (!editBudgetId || b.id !== editBudgetId)
  );

  if (editBudgetId) {
    if (existingBudget) {
      const combinedLimit = Number(existingBudget.amount_limit) + amountLimit;
      const encCombinedLimit = encrypt(combinedLimit.toString(), userCode);

      await supabaseClient
        .from('budgets')
        .update({ amount_limit: encCombinedLimit })
        .eq('id', existingBudget.id)
        .eq('user_code', userCode);

      await supabaseClient
        .from('budgets')
        .delete()
        .eq('id', editBudgetId)
        .eq('user_code', userCode);

      showToast('Berhasil', `Budget digabungkan ke "${existingBudget.category}"!`, 'success');
    } else {
      const encryptedCategory = encrypt(categoryInput, userCode);
      const encryptedAmountLimit = encrypt(amountLimit.toString(), userCode);

      const { error } = await supabaseClient
        .from('budgets')
        .update({ amount_limit: encryptedAmountLimit, category: encryptedCategory })
        .eq('id', editBudgetId)
        .eq('user_code', userCode);

      if (error) {
        showToast('Gagal', error.message, 'error');
        return;
      }
      showToast('Berhasil', `Budget "${categoryInput}" berhasil diperbarui!`, 'success');
    }
  } else {
    if (existingBudget) {
      const newLimit = Number(existingBudget.amount_limit) + amountLimit;
      const encryptedAmountLimit = encrypt(newLimit.toString(), userCode);

      await supabaseClient
        .from('budgets')
        .update({ amount_limit: encryptedAmountLimit })
        .eq('id', existingBudget.id)
        .eq('user_code', userCode);

      showToast('Berhasil', `Budget "${existingBudget.category}" berhasil ditambah!`, 'success');
    } else {
      const encryptedCategory = encrypt(categoryInput, userCode);
      const encryptedAmountLimit = encrypt(amountLimit.toString(), userCode);

      const { error } = await supabaseClient.from('budgets').insert([{
        user_code: userCode,
        category: encryptedCategory,
        amount_limit: encryptedAmountLimit
      }]);

      if (error) {
        showToast('Gagal', error.message, 'error');
        return;
      }
      showToast('Berhasil', `Budget "${categoryInput}" berhasil disimpan!`, 'success');
    }
  }

  closeBudgetModal();
  renderRekapPage();
}

function editBudget(id) {
  const budget = allBudgets.find(b => b.id === id);
  if (!budget) return;

  editBudgetId = id;
  document.getElementById('budget-category').value = budget.category;
  document.getElementById('budget-amount').value = toRibuan(budget.amount_limit);
  document.getElementById('budget-modal').classList.remove('hidden');
}

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
  const targetBudget = allBudgets.find(b => b.id === deleteBudgetId);
  const idsToDelete = targetBudget && targetBudget.allIds ? targetBudget.allIds : [deleteBudgetId];

  const { error } = await supabaseClient
    .from('budgets')
    .delete()
    .in('id', idsToDelete)
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

async function renderRekapPage() {
  await fetchBudgets();
  populateBudgetCategoryDatalist();

  const userCode = localStorage.getItem('user_code');
  const customStartDateStr = userCode ? localStorage.getItem('budget_cycle_' + userCode) : null;
  let cycleStartDate = null;
  if (customStartDateStr) {
    const parsed = new Date(customStartDateStr);
    if (!isNaN(parsed.getTime())) {
      cycleStartDate = parsed;
    }
  }

  // Strict manual reset logic (never auto-reset by calendar month):
  // If a manual reset date exists, accumulate strictly from that date onwards.
  // If no reset date exists, accumulate from the very beginning of the records.
  let filteredTrx = allTransactions;
  if (cycleStartDate) {
    filteredTrx = allTransactions.filter(trx => parseTrxTime(trx) >= cycleStartDate);
  }

  let totalExpenseFiltered = 0;
  let totalIncomeFiltered = 0;
  filteredTrx.forEach(trx => {
    if (trx.type === 'expense') totalExpenseFiltered += Number(trx.amount);
    else if (trx.type === 'income') totalIncomeFiltered += Number(trx.amount);
  });

  const expenseEl = document.getElementById('rekap-total-expense');
  const incomeEl = document.getElementById('rekap-total-income');
  const budgetEl = document.getElementById('rekap-total-budget');

  if (expenseEl) expenseEl.textContent = 'Rp ' + toRibuan(totalExpenseFiltered);
  if (incomeEl) incomeEl.textContent = 'Rp ' + toRibuan(totalIncomeFiltered);

  let totalBudget = 0;
  allBudgets.forEach(b => totalBudget += Number(b.amount_limit));
  if (budgetEl) budgetEl.textContent = 'Rp ' + toRibuan(totalBudget);

  const cycleExpenses = filteredTrx.filter(trx => trx.type === 'expense');
  const expenseByCategory = {};
  cycleExpenses.forEach(trx => {
    const catKey = (trx.category || '').trim().toLowerCase();
    expenseByCategory[catKey] = (expenseByCategory[catKey] || 0) + Number(trx.amount);
  });

  const grid = document.getElementById('budget-cards-grid');
  if (!grid) return;

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
    const catKey = (budget.category || '').trim().toLowerCase();
    const monthlySpent = expenseByCategory[catKey] || 0;
    const limit = Number(budget.amount_limit);
    const percent = limit > 0 ? Math.round((monthlySpent / limit) * 100) : 0;
    const isOver = monthlySpent > limit;
    const barWidth = Math.min(percent, 100);

    let sisaBudget = limit - monthlySpent;
    let sisaBudgetText = sisaBudget < 0
      ? `⚠️ Overbudget: Rp ${toRibuan(Math.abs(sisaBudget))}`
      : `Sisa Budget: Rp ${toRibuan(sisaBudget)}`;

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
        <span class="budget-spent ${isOver ? 'expense-color' : ''}">Rp ${toRibuan(monthlySpent)}</span>
        <span class="budget-limit">/ Rp ${toRibuan(limit)}</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill ${isOver ? 'bar-red' : 'bar-green'}" style="width: ${barWidth}%"></div>
      </div>
      <div class="budget-card-percent ${isOver ? 'percent-red' : 'percent-green'}">
        ${percent}% — ${sisaBudgetText}
      </div>
    `;

    grid.appendChild(card);
  });
}

function applyRekapFilter() {
  renderRekapPage();
}

function toggleNewCategory() {
  const select = document.getElementById('category-select');
  const input = document.getElementById('category');
  if (select.value === 'new') {
    input.classList.remove('hidden');
    input.value = '';
    input.focus();
  } else {
    input.classList.add('hidden');
  }
}

function populateBudgetCategoryDatalist() {
  const select = document.getElementById('category-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Pilih Kategori --</option>';

  const seenCategories = new Set();
  allBudgets.forEach(b => {
    const trimmed = (b.category || '').trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seenCategories.has(key)) {
      seenCategories.add(key);
      const opt = document.createElement('option');
      opt.value = trimmed;
      opt.textContent = trimmed;
      select.appendChild(opt);
    }
  });

  // Also include any categories present in allTransactions
  allTransactions.forEach(t => {
    const trimmed = (t.category || '').trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seenCategories.has(key)) {
      seenCategories.add(key);
      const opt = document.createElement('option');
      opt.value = trimmed;
      opt.textContent = trimmed;
      select.appendChild(opt);
    }
  });

  select.insertAdjacentHTML('beforeend', '<option value="new">+ Tambah Kategori Baru...</option>');
  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

// ===================================================
// 13. MENU 3: REVIEW (CALENDAR & LEADERBOARD SYSTEM)
// ===================================================

let reviewCalYear = new Date().getFullYear();
let reviewCalMonth = new Date().getMonth();
let selectedReviewDate = null; // null or 'YYYY-MM-DD'

const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function changeReviewMonth(delta) {
  reviewCalMonth += delta;
  if (reviewCalMonth < 0) {
    reviewCalMonth = 11;
    reviewCalYear--;
  } else if (reviewCalMonth > 11) {
    reviewCalMonth = 0;
    reviewCalYear++;
  }
  renderReviewPage();
}

function goToTodayReview() {
  const now = new Date();
  reviewCalYear = now.getFullYear();
  reviewCalMonth = now.getMonth();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  selectedReviewDate = `${now.getFullYear()}-${month}-${day}`;
  renderReviewPage();
}

function toggleCalendarDate(dateStr) {
  if (selectedReviewDate === dateStr) {
    selectedReviewDate = null; // Toggle cancel filter
  } else {
    selectedReviewDate = dateStr;
  }
  renderReviewPage();
}

function clearReviewDateFilter() {
  selectedReviewDate = null;
  renderReviewPage();
}

function renderReviewPage() {
  renderReviewCalendar();
  renderReviewLeaderboard();
  renderReviewTransactions();
}

// 5A. Kalender Grid Interaktif
function renderReviewCalendar() {
  const titleEl = document.getElementById('review-calendar-title');
  if (titleEl) {
    titleEl.textContent = `${INDO_MONTH_NAMES[reviewCalMonth]} ${reviewCalYear}`;
  }

  // Active filter indicator bar
  const filterBar = document.getElementById('calendar-filter-bar');
  const filterText = document.getElementById('calendar-filter-text');
  if (selectedReviewDate) {
    const parts = selectedReviewDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const formatted = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (filterText) filterText.textContent = `Menampilkan Transaksi: ${formatted}`;
    if (filterBar) filterBar.classList.remove('hidden');
  } else {
    if (filterBar) filterBar.classList.add('hidden');
  }

  const gridEl = document.getElementById('review-calendar-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const firstDayOfMonth = new Date(reviewCalYear, reviewCalMonth, 1);
  const totalDaysInMonth = new Date(reviewCalYear, reviewCalMonth + 1, 0).getDate();

  // Senin-based index: 0 = Senin, ..., 6 = Minggu
  const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Map transactions count by date
  const trxCountByDate = {};
  allTransactions.forEach(t => {
    if (t.date) {
      trxCountByDate[t.date] = (trxCountByDate[t.date] || 0) + 1;
    }
  });

  // Empty leading cells
  for (let i = 0; i < startDayOffset; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    gridEl.appendChild(emptyCell);
  }

  // Days 1 .. totalDaysInMonth
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(reviewCalMonth + 1).padStart(2, '0');
    const fullDateStr = `${reviewCalYear}-${monthStr}-${dayStr}`;

    const cellDate = new Date(reviewCalYear, reviewCalMonth, day);
    const trxCount = trxCountByDate[fullDateStr] || 0;
    const hasTrx = trxCount > 0;
    const isToday = (fullDateStr === todayStr);
    const isPast = (cellDate < todayMidnight);
    const isFuture = (cellDate > todayMidnight);
    const isSelected = (selectedReviewDate === fullDateStr);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day-cell';

    // ATURAN WARNA / INDIKATOR TANGGAL:
    // * Biru: Hari yang memiliki data transaksi (sudah diisi)
    // * Abu-abu: Hari di masa lalu yang terlewati tanpa ada transaksi (kosong)
    // * Normal/Warna Tema: Hari di masa depan yang belum terjadi
    if (hasTrx) {
      btn.classList.add('cal-day-has-data');
    } else if (isPast) {
      btn.classList.add('cal-day-missed');
    } else {
      btn.classList.add('cal-day-future');
    }

    if (isToday) {
      btn.classList.add('cal-day-today');
    }

    if (isSelected) {
      btn.classList.add('cal-day-selected');
    }

    btn.setAttribute('onclick', `toggleCalendarDate('${fullDateStr}')`);
    btn.title = `${day} ${INDO_MONTH_NAMES[reviewCalMonth]} ${reviewCalYear} (${trxCount} transaksi)`;

    btn.innerHTML = `
      <span class="cal-day-num">${day}</span>
      <span class="cal-day-dot"></span>
    `;

    gridEl.appendChild(btn);
  }
}

// 5B. Rincian Pengeluaran per Kategori (Leaderboard Terbesar ke Terkecil)
function renderReviewLeaderboard() {
  const periodSubtitle = document.getElementById('review-leaderboard-subtitle');
  let activeTrx = [];

  if (selectedReviewDate) {
    activeTrx = allTransactions.filter(t => t.date === selectedReviewDate);
    const parts = selectedReviewDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const formatted = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (periodSubtitle) periodSubtitle.textContent = `Periode: ${formatted}`;
  } else {
    activeTrx = allTransactions.filter(t => {
      if (!t.date) return false;
      const parts = t.date.split('-').map(Number);
      return parts[0] === reviewCalYear && (parts[1] - 1) === reviewCalMonth;
    });
    if (periodSubtitle) periodSubtitle.textContent = `Periode: Bulan ${INDO_MONTH_NAMES[reviewCalMonth]} ${reviewCalYear}`;
  }

  // Filter ONLY expenses
  const expenseTrx = activeTrx.filter(t => t.type === 'expense');
  let totalExpense = 0;
  const categoryTotals = {};

  expenseTrx.forEach(t => {
    const cat = (t.category || 'Lainnya').trim();
    const amt = Number(t.amount) || 0;
    totalExpense += amt;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const totalBadge = document.getElementById('review-leaderboard-total');
  if (totalBadge) totalBadge.textContent = 'Total: Rp ' + toRibuan(totalExpense);

  // Sort dynamically descending by nominal
  const sortedCategories = Object.keys(categoryTotals).map(cat => ({
    name: cat,
    total: categoryTotals[cat]
  })).sort((a, b) => b.total - a.total);

  const listEl = document.getElementById('review-leaderboard-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (sortedCategories.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 28px 16px;">
        <div class="empty-icon">🍃</div>
        <p>Tidak ada pengeluaran yang tercatat pada periode ini.</p>
      </div>
    `;
    return;
  }

  const maxVal = sortedCategories[0].total || 1;

  sortedCategories.forEach((item, index) => {
    const rank = index + 1;
    let rankClass = 'rank-other';
    let rankDisplay = `#${rank}`;
    if (rank === 1) { rankClass = 'rank-1'; rankDisplay = '🥇'; }
    else if (rank === 2) { rankClass = 'rank-2'; rankDisplay = '🥈'; }
    else if (rank === 3) { rankClass = 'rank-3'; rankDisplay = '🥉'; }

    const pct = totalExpense > 0 ? ((item.total / totalExpense) * 100).toFixed(1) : 0;
    const barWidth = Math.min(100, Math.round((item.total / maxVal) * 100));

    const div = document.createElement('div');
    div.className = 'leaderboard-item';
    div.innerHTML = `
      <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
      <div class="leaderboard-content">
        <div class="leaderboard-top-line">
          <span class="leaderboard-cat-name">${item.name}</span>
          <span class="leaderboard-amount">Rp ${toRibuan(item.total)}</span>
        </div>
        <div class="leaderboard-bar-bg">
          <div class="leaderboard-bar-fill" style="width: ${barWidth}%"></div>
        </div>
        <div class="leaderboard-meta">
          <span>Porsi: ${pct}%</span>
          <span>Banding Puncak: ${barWidth}%</span>
        </div>
      </div>
    `;
    listEl.appendChild(div);
  });
}

// Mini Riwayat Transaksi Review Table
function renderReviewTransactions() {
  const tbody = document.getElementById('review-transaction-list');
  const countEl = document.getElementById('review-trx-count');
  if (!tbody) return;
  tbody.innerHTML = '';

  let activeTrx = [];
  if (selectedReviewDate) {
    activeTrx = allTransactions.filter(t => t.date === selectedReviewDate);
  } else {
    activeTrx = allTransactions.filter(t => {
      if (!t.date) return false;
      const parts = t.date.split('-').map(Number);
      return parts[0] === reviewCalYear && (parts[1] - 1) === reviewCalMonth;
    });
  }

  if (countEl) countEl.textContent = `${activeTrx.length} Transaksi`;

  if (activeTrx.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state" style="padding: 24px 12px;">
            <div class="empty-icon">📭</div>
            <p>Tidak ada transaksi pada periode ini.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  activeTrx.forEach(trx => {
    let typeLabel = '';
    let badgeClass = '';
    let amountClass = '';
    let amountPrefix = '';

    if (trx.type === 'expense') {
      typeLabel = '🔴 Keluar';
      badgeClass = 'badge-expense';
      amountClass = 'amount-expense';
      amountPrefix = '- Rp';
    } else if (trx.type === 'income') {
      typeLabel = '🟢 Masuk';
      badgeClass = 'badge-income';
      amountClass = 'amount-income';
      amountPrefix = '+ Rp';
    } else {
      typeLabel = '↔️ Transfer';
      badgeClass = 'badge-transfer';
      amountClass = '';
      amountPrefix = 'Rp';
    }

    const safeDesc = (trx.description || '-').replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const trxId = getTrxId(trx);

    let fromWallet = allWallets.find(w => w.id == trx.wallet_id)?.wallet_name || '-';
    let toWallet = allWallets.find(w => w.id == trx.to_wallet_id)?.wallet_name || '-';
    let walletInfo = trx.type === 'transfer' ? `${fromWallet} ➔ ${toWallet}` : fromWallet;

    const row = `
      <tr>
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
    tbody.innerHTML += row;
  });
}

// ===================================================
// 14. TEMA TERANG / GELAP
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
// 15. INISIALISASI
// ===================================================

window.onload = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('[PWA] Service Worker registered.', reg))
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  }

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
// 16. FITUR TAMBAHAN (MAX & AUTO-GENERATE)
// ===================================================

function fillMaxAmount() {
  const type = document.getElementById('type').value;
  if (type === 'income') return;

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
// 17. RESET SIKLUS DATA
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

  localStorage.setItem('budget_cycle_' + userCode, new Date().toISOString());

  closeResetDataModal();
  showToast('Berhasil', 'Siklus Budget berhasil direset! Total pengeluaran & pemasukan kembali ke Rp 0.', 'success');

  updateBalance(allTransactions);
  if (currentPage === 'page-budget') {
    renderRekapPage();
  }
}

// ===================================================
// 18. BACKUP & RESTORE JSON
// ===================================================

async function exportJSON() {
  const userCode = localStorage.getItem('user_code');
  if (!userCode) return showToast('Error', 'Login diperlukan', 'error');

  const [u, w, t, b] = await Promise.all([
    supabaseClient.from('users').select('*').eq('user_code', userCode).single(),
    supabaseClient.from('wallets').select('*').eq('user_code', userCode),
    supabaseClient.from('transactions').select('*').eq('user_code', userCode),
    supabaseClient.from('budgets').select('*').eq('user_code', userCode)
  ]);

  const backupData = { user: u.data, wallets: w.data, transactions: t.data, budgets: b.data };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `ArcadeFin_Backup_${userCode}_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

async function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.user || !data.wallets) throw new Error("Format JSON tidak valid");

      const userCode = data.user.user_code;
      localStorage.setItem('user_code', userCode);

      await supabaseClient.from('users').upsert([data.user]);
      if (data.wallets && data.wallets.length) await supabaseClient.from('wallets').upsert(data.wallets);
      if (data.transactions && data.transactions.length) await supabaseClient.from('transactions').upsert(data.transactions);
      if (data.budgets && data.budgets.length) await supabaseClient.from('budgets').upsert(data.budgets);

      showToast("Berhasil", "Data berhasil dipulihkan!", "success");
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast("Error", "Gagal memulihkan data: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}
