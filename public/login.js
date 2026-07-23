const credentialsForm = document.getElementById('credentialsForm');
const totpForm = document.getElementById('totpForm');
const loginMsg = document.getElementById('loginMsg');

let pendingUsername = null;

credentialsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (res.ok && data.requires2FA) {
    pendingUsername = data.username;
    loginMsg.style.color = '#8fd18f';
    loginMsg.textContent = data.message;
    credentialsForm.style.display = 'none';
    totpForm.style.display = 'block';
    return;
  }

  loginMsg.style.color = '#ef5350';
  loginMsg.textContent = data.error || 'Erreur de connexion';
});

totpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';

  const code = document.getElementById('totpCode').value;

  const res = await fetch('/api/verify-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: pendingUsername, code }),
  });
  const data = await res.json();

  if (res.ok) {
    window.location.href = '/bat-computer';
    return;
  }

  loginMsg.style.color = '#ef5350';
  loginMsg.textContent = data.error || 'Code invalide';
});
