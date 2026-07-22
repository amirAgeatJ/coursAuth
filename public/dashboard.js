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
    const code = prompt("Code secret transmis par Alfred :");
    if (!code) return;

    const verifyRes = await apiFetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      document.getElementById('batmobileMsg').textContent = verifyData.error;
      return;
    }

    const secretRes = await apiFetch('/api/user/secret-batmobile');
    const secretData = await secretRes.json();
    document.getElementById('batmobileMsg').textContent = secretRes.ok
      ? `${secretData.message} Commandes : ${secretData.commands.join(', ')}`
      : secretData.error;
  });
}

loadProfile();
loadArsenal();
