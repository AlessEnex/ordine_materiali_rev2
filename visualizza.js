// ===== visualizza.js =====
// Usa il client globale creato in login.js: window.sbClient

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.sbClient) {
    console.error('Supabase client mancante (carica prima login.js)');
    return;
  }

  // Sessione: se non loggato torna alla pagina di accesso
  const { data: { session } } = await window.sbClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  // Pulisci eventuale box login presente in visualizza.html
  const authBox   = document.getElementById('authBox');
  const btnLogout = document.getElementById('btnLogout');
  const filters   = document.querySelector('.filters');
  const tableCont = document.getElementById('tableContainer');

  if (authBox)   authBox.style.display = 'none';
  if (filters)   filters.style.display = 'flex';
  if (btnLogout) btnLogout.style.display = 'inline-block';

  // Logout
  btnLogout?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Filtri (compatibile con id vecchi o nuovi)
  const btnFilter   = document.getElementById('btnFilter');
  const jobEl       = document.getElementById('filterJob')     || document.getElementById('filterJobRef');
  const yearEl      = document.getElementById('filterYear')    || document.getElementById('filterJobYear');
  const dateEl      = document.getElementById('filterDate');
  const codeEl      = document.getElementById('filterCode');

  btnFilter?.addEventListener('click', async () => {
    const job  = (jobEl?.value || '').trim();
    const year = yearEl?.value ? parseInt(yearEl.value, 10) : null;
    const date = dateEl?.value || null;
    const code = (codeEl?.value || '').trim();

    await loadOrders(job || null, year, date, code || null);
  });

  // Caricamento iniziale
  await loadOrders();

  // Esportazione CSV della vista corrente
  document.getElementById('btnExport')?.addEventListener('click', () => {
    const table = document.querySelector('#tableContainer table');
    if (!table) { 
      Toast.warning('Nessun dato da esportare');
      return;
    }

    const rows = table.querySelectorAll('tr');
    const csv = Array.from(rows).map(row => {
      const cols = Array.from(row.querySelectorAll('th, td'))
        .map(c => `"${c.innerText.replace(/"/g, '""')}"`);
      return cols.join(';');
    });

    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordini_materiali_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    Toast.success('File CSV scaricato');
  });

  // Funzione di caricamento con filtri
  async function loadOrders(jobRef = null, jobYear = null, date = null, code = null) {
    tableCont.textContent = 'Caricamento dati...';

    try {
      let query = window.sbClient
        .from('material_order_lines')
        .select(`
          id,
          supplier_name,
          code,
          description,
          qty,
          material_orders!inner(job_ref, job_year, request_date)
        `)
        .order('job_year', { referencedTable: 'material_orders', ascending: false })
        .order('job_ref',  { referencedTable: 'material_orders', ascending: true });

      if (jobRef)  query = query.filter('material_orders.job_ref', 'ilike', `%${jobRef}%`);
      if (jobYear) query = query.filter('material_orders.job_year', 'eq', jobYear);
      if (date)    query = query.filter('material_orders.request_date', 'gte', date);
      if (code)    query = query.ilike('code', `%${code}%`);

      const { data, error } = await query;
      if (error) throw error;

      if (!data?.length) { tableCont.textContent = 'Nessun ordine trovato.'; return; }

      const html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Commessa</th>
              <th>Anno</th>
              <th>Data richiesta</th>
              <th>Fornitore</th>
              <th>Codice</th>
              <th>Descrizione</th>
              <th>Q.tà</th>
              <th class="actions-cell"></th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => `
              <tr data-line-id="${r.id}">
                <td>${r.material_orders.job_ref}</td>
                <td>${r.material_orders.job_year}</td>
                <td>${r.material_orders.request_date || '-'}</td>
                <td>${r.supplier_name || '-'}</td>
                <td>${r.code || '-'}</td>
                <td>${r.description || '-'}</td>
                <td>${r.qty ?? 0}</td>
                <td class="actions-cell">
                  <button class="delete-row" data-id="${r.id}" title="Elimina riga">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      tableCont.innerHTML = html;

      // Aggiungi event listener ai bottoni elimina
      document.querySelectorAll('.delete-row').forEach(btn => {
        btn.addEventListener('click', () => deleteRow(btn.dataset.id));
      });

    } catch (err) {
      console.error(err);
      tableCont.textContent = 'Errore nel caricamento dati.';
      Toast.error('Errore nel caricamento dati');
    }
  }

  // Funzione eliminazione riga
  async function deleteRow(lineId) {
    const result = await Modal.confirm(
      'Eliminare definitivamente questa riga?',
      'Conferma eliminazione',
      { danger: true, confirmText: 'Elimina', cancelText: 'Annulla' }
    );
    
    if (!result) return;

    try {
      const { error } = await window.sbClient
        .from('material_order_lines')
        .delete()
        .eq('id', lineId);

      if (error) throw error;

      // Rimuovi visivamente la riga
      const row = document.querySelector(`tr[data-line-id="${lineId}"]`);
      if (row) row.remove();

      Toast.success('Riga eliminata');

      // Se non ci sono più righe, mostra messaggio
      const remainingRows = document.querySelectorAll('#tableContainer tbody tr');
      if (!remainingRows.length) {
        tableCont.textContent = 'Nessun ordine trovato.';
      }

    } catch (err) {
      console.error('Errore eliminazione:', err);
      Toast.error('Errore durante l\'eliminazione');
    }
  }
});