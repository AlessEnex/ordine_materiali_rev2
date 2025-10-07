const SUPABASE_URL = 'https://ndpqnoyzfxthclcrvszn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcHFub3l6Znh0aGNsY3J2c3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjQ3MDAsImV4cCI6MjA3NTQwMDcwMH0.r4FqmB7_FiQWb_yJsFgjMESoqhTMtUgfGGQ7OpyUTbE';

let sbClient;

document.addEventListener('DOMContentLoaded', async () => {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (url, options = {}) => {
        options.headers = {
          ...(options.headers || {}),
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        };
        return fetch(url, options);
      },
    },
  });

  await loadOrders();

  // === FILTRI ===
  document.getElementById('btnFilter').addEventListener('click', async () => {
    console.log('Filtro cliccato'); // per verifica
    const job = document.getElementById('filterJob').value.trim().toLowerCase();
    const year = document.getElementById('filterYear').value;
    const date = document.getElementById('filterDate').value || null;
    const code = document.getElementById('filterCode').value.trim().toLowerCase();
    await loadOrders(job, year, date, code);
  });
});


async function loadOrders(jobFilter = '', yearFilter = '', dateFilter = null, codeFilter = '') {
  const container = document.getElementById('tableContainer');
  container.textContent = 'Caricamento dati...';
  console.log('Filtri ricevuti:', jobFilter, yearFilter, dateFilter, codeFilter);

  try {
    let query = sbClient
      .from('material_order_lines')
      .select(`
        id,
        order_id,
        supplier_name,
        code,
        description,
        qty,
        material_orders!inner(job_ref, job_year, request_date)
      `)
      .order('job_year', { referencedTable: 'material_orders', ascending: false })
      .order('job_ref', { referencedTable: 'material_orders', ascending: true });

    // Filtri su tabella collegata => usa .filter()
    if (jobFilter)  query = query.filter('material_orders.job_ref', 'ilike', `%${jobFilter}%`);
    if (yearFilter) query = query.filter('material_orders.job_year', 'eq', parseInt(yearFilter, 10));
    if (dateFilter) query = query.filter('material_orders.request_date', 'gte', dateFilter);

    // Filtro su colonna locale
    if (codeFilter) query = query.ilike('code', `%${codeFilter}%`);

    const { data, error } = await query;

    if (error) throw error;
    console.log('Righe trovate:', data?.length ?? 0);

    if (!data || !data.length) {
      container.textContent = 'Nessun ordine trovato.';
      return;
    }

    renderTable(container, data);
  } catch (err) {
    console.error(err);
    container.textContent = 'Errore nel caricamento dati.';
  }
}


function renderTable(container, rows) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Anno</th>
      <th>Commessa</th>
      <th>Data richiesta</th>
      <th>Fornitore</th>
      <th>Codice</th>
      <th>Descrizione</th>
      <th>Quantità</th>
      <th></th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.material_orders.job_year || ''}</td>
      <td>${r.material_orders.job_ref}</td>
      <td>${r.material_orders.request_date || ''}</td>
      <td>${r.supplier_name || ''}</td>
      <td>${r.code || ''}</td>
      <td>${r.description || ''}</td>
      <td>${r.qty}</td>
      <td class="actions-cell">
        <button class="delete-row" data-id="${r.id}" title="Elimina riga">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);

  // Gestione click su "Elimina"
  container.querySelectorAll('.delete-row').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const confirmed = confirm('Vuoi eliminare questa riga?');
      if (!confirmed) return;

      try {
        const { error } = await sbClient
          .from('material_order_lines')
          .delete()
          .eq('id', id);

        if (error) throw error;
        btn.closest('tr').remove();
      } catch (err) {
        console.error('Errore eliminazione:', err);
        alert('Errore durante l’eliminazione della riga.');
      }
    });
  });
}

