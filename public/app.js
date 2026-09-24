(function () {
  const g = (id) => document.getElementById(id);

  let currentEmail = '';
  let balanceMb = 0;
  let capMb = 100;
  let tapping = false;

  function showToast(msg) {
    const t = g('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 3500);
  }

  function showPage(id) {
    ['authPage', 'dashPage', 'withdrawPage'].forEach((p) => {
      g(p).classList.toggle('show', p === id);
    });
    window.scrollTo(0, 0);
  }

  function showErr(elId, msg) {
    const el = g(elId);
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideErr(elId) {
    g(elId).classList.remove('show');
  }

  async function api(path, options) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  function renderBalance() {
    g('balVal').textContent = balanceMb.toFixed(1);
    g('capLbl').textContent = capMb;
    g('capLbl2').textContent = capMb;
    const pct = Math.min(100, (balanceMb / capMb) * 100);
    g('pfil').style.width = pct + '%';

    const capped = balanceMb >= capMb;
    g('coinBtn').disabled = capped;
    g('tapZone').style.display = capped ? 'none' : 'flex';
    g('cappedBox').style.display = capped ? 'block' : 'none';
  }

  function enterDashboard(email, balance, cap) {
    currentEmail = email;
    balanceMb = balance;
    capMb = cap;
    g('userChip').style.display = 'flex';
    g('userChip').textContent = email;
    renderBalance();
    showPage('dashPage');
  }

  g('sendCodeBtn').addEventListener('click', async () => {
    const email = g('emailIn').value.trim();
    hideErr('emailErr');
    if (!email) return showErr('emailErr', 'Enter your email address.');

    g('sendCodeBtn').disabled = true;
    g('sendCodeBtn').textContent = 'Sending...';
    try {
      await api('/api/auth/request-code', { body: JSON.stringify({ email }) });
      g('codeSentTo').textContent = `We sent a 6-digit code to ${email}`;
      g('stepEmail').style.display = 'none';
      g('stepCode').style.display = 'block';
      g('codeIn').focus();
    } catch (e) {
      showErr('emailErr', e.message);
    } finally {
      g('sendCodeBtn').disabled = false;
      g('sendCodeBtn').textContent = 'Send My Code';
    }
  });

  g('backBtn').addEventListener('click', () => {
    g('stepCode').style.display = 'none';
    g('stepEmail').style.display = 'block';
    hideErr('codeErr');
  });

  g('verifyBtn').addEventListener('click', async () => {
    const email = g('emailIn').value.trim();
    const code = g('codeIn').value.trim();
    hideErr('codeErr');
    if (!/^\d{6}$/.test(code)) return showErr('codeErr', 'Enter the 6-digit code.');

    g('verifyBtn').disabled = true;
    g('verifyBtn').textContent = 'Verifying...';
    try {
      const data = await api('/api/auth/verify-code', { body: JSON.stringify({ email, code }) });
      showToast('Logged in!');
      enterDashboard(data.email, data.balanceMb, data.capMb);
    } catch (e) {
      showErr('codeErr', e.message);
    } finally {
      g('verifyBtn').disabled = false;
      g('verifyBtn').textContent = 'Verify & Login';
    }
  });

  g('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', {});
    currentEmail = '';
    g('userChip').style.display = 'none';
    g('emailIn').value = '';
    g('codeIn').value = '';
    g('stepCode').style.display = 'none';
    g('stepEmail').style.display = 'block';
    showPage('authPage');
  });

  g('coinBtn').addEventListener('click', async () => {
    if (tapping || balanceMb >= capMb) return;
    tapping = true;
    try {
      const data = await api('/api/tap', {});
      balanceMb = data.balanceMb;
      capMb = data.capMb;
      renderBalance();
      if (data.capped) showToast(`You hit the ${capMb}MB limit! Time to withdraw.`);
    } catch (e) {
      // ignore rate-limit errors silently, they just mean "tap slower"
    } finally {
      tapping = false;
    }
  });

  g('goWithdrawBtn').addEventListener('click', () => {
    g('wAmount').textContent = balanceMb.toFixed(1);
    hideErr('wErr');
    showPage('withdrawPage');
  });
  g('backToDashBtn').addEventListener('click', () => showPage('dashPage'));

  g('submitWithdrawBtn').addEventListener('click', async () => {
    const phone = g('phoneIn').value.trim();
    hideErr('wErr');
    if (!phone) return showErr('wErr', 'Enter your MTN phone number.');

    g('submitWithdrawBtn').disabled = true;
    g('submitWithdrawBtn').textContent = 'Submitting...';
    try {
      const data = await api('/api/withdraw', { body: JSON.stringify({ phone }) });
      balanceMb = data.balanceMb;
      renderBalance();
      showToast('Withdrawal submitted! Data arrives within 24 hours.');
      showPage('dashPage');
      g('phoneIn').value = '';
    } catch (e) {
      showErr('wErr', e.message);
    } finally {
      g('submitWithdrawBtn').disabled = false;
      g('submitWithdrawBtn').textContent = 'Submit Withdrawal Request';
    }
  });

  (async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        enterDashboard(data.email, data.balanceMb, data.capMb);
        return;
      }
    } catch (e) {}
    showPage('authPage');
  })();
})();