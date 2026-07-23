fetch('/bat-computer/admin/audit/data')
  .then(res => {
    if (!res.ok) { window.location.href = '/auth/login'; return; }
    return res.json();
  })
  .then(logs => {
    const tbody = document.getElementById('logs-body');
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#666;text-align:center;padding:2rem;">Aucun événement enregistré.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(log => `
      <tr>
        <td>${log.id}</td>
        <td>${log.username}</td>
        <td><span class="badge ${log.action}">${log.action}</span></td>
        <td>${log.ip_address || '—'}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${log.user_agent || ''}">${log.user_agent || '—'}</td>
        <td>${log.timestamp}</td>
      </tr>
    `).join('');
  });
