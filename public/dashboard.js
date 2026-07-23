async function apiFetch(url, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  let res = await fetch(url, opts);

  if (res.status === 401) {
    console.log('[Batcave] accessToken expiré — rafraîchissement en tâche de fond...');
    const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });

    if (!refreshRes.ok) {
      console.warn('[Batcave] refreshToken invalide ou expiré — redirection vers la connexion.');
      window.location.href = '/auth/login';
      throw new Error('Session expirée');
    }

    console.log('[Batcave] accessToken renouvelé — rejeu de la requête initiale.');
    res = await fetch(url, opts);
  }

  return res;
}

function loadProfile() {
  apiFetch('/bat-computer/api/me')
    .then((res) => res.json())
    .then((data) => {
      document.getElementById('welcome').textContent =
        'Bienvenue, Justicier ' + data.username + ' — la Batcave vous attend.';
    })
    .catch(() => {});
}

function loadArsenal() {
  apiFetch('/bat-computer/api/secrets')
    .then((res) => res.json())
    .then((gadgets) => {
      const container = document.getElementById('arsenal');
      container.innerHTML = '';
      gadgets.forEach((g) => {
        const div = document.createElement('div');
        div.className = 'gadget';
        div.innerHTML = `<strong>${g.name}</strong>${g.desc}`;
        container.appendChild(div);
      });
    })
    .catch(() => {});
}

document.getElementById('sendReport').addEventListener('click', async () => {
  const content = document.getElementById('reportContent').value;
  const res = await apiFetch('/bat-computer/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  document.getElementById('reportMsg').textContent = data.message || data.error;
});

const batmobileBtn = document.getElementById('batmobileBtn');
if (batmobileBtn) {
  batmobileBtn.addEventListener('click', async () => {
    const res = await apiFetch('/api/user/secret-batmobile');
    const data = await res.json();
    document.getElementById('batmobileMsg').textContent = res.ok
      ? `${data.message} Commandes : ${data.commands.join(', ')}`
      : data.error;
  });
}

const enroll2FABtn = document.getElementById('enroll2FABtn');
const qrCodeImg = document.getElementById('qrCodeImg');
const twoFASecretText = document.getElementById('twoFASecretText');
const confirm2FASection = document.getElementById('confirm2FASection');
const twoFAStatus = document.getElementById('twoFAStatus');

if (enroll2FABtn) {
  enroll2FABtn.addEventListener('click', async () => {
    const res = await apiFetch('/api/2fa/setup', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      twoFAStatus.textContent = data.error;
      return;
    }

    qrCodeImg.src = data.qrCode;
    qrCodeImg.style.display = 'block';
    twoFASecretText.textContent = `Secret (si le QR code ne scanne pas) : ${data.secret}`;
    confirm2FASection.style.display = 'block';
    twoFAStatus.textContent = 'Scannez le QR code avec Google Authenticator, puis saisissez le code généré.';
  });
}

const confirm2FABtn = document.getElementById('confirm2FABtn');
if (confirm2FABtn) {
  confirm2FABtn.addEventListener('click', async () => {
    const code = document.getElementById('totpCodeInput').value;
    const res = await apiFetch('/api/2fa/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    twoFAStatus.textContent = data.message || data.error;
    if (res.ok) {
      confirm2FASection.style.display = 'none';
      qrCodeImg.style.display = 'none';
    }
  });
}

loadProfile();
loadArsenal();
