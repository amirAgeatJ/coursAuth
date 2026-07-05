document.getElementById('btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  document.getElementById('message').textContent = data.message || data.error;

  if (res.ok) {
    setTimeout(() => { window.location.href = '/auth/login'; }, 1000);
  }
});
