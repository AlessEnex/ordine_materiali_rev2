// === CONFIGURAZIONE SUPABASE ===
//const SUPABASE_URL = 'https://ndpqnoyzfxthclcrvszn.supabase.co';
//const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcHFub3l6Znh0aGNsY3J2c3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MzU3MDAsImV4cCI6MjA3NTQwMDcwMH0.r4FqmB7_FiQWb_yJsFgjMESoqhTMtUgfGGQ7OpyUTbE';

let sbClient;

// === AVVIO ===
document.addEventListener('DOMContentLoaded', async () => {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (url, opt = {}) => {
        opt.headers = {
          ...(opt.headers || {}),
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        };
        return fetch(url, opt);
      },
    },
  });

  const authBox = document.getElementById('authBox');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const authMsg = document.getElementById('authMsg');
  const filters = document.querySelector('.filters');
  const tableContainer = document.getElementById('tableContainer');
  const btnFilter = document.getElementById('btnFilter');
  const jobRefInput = document.getElementById('filterJobRef');
  const jobYearInput = document.getElementById('filterJobYear');
  const dateInput = document.getElementById('filterDate');

  const setUI = (logged) => {
    authBox.style.display = logged ? 'none' : 'block';
    btnLogout.style.display = logged ? 'inline-block' : 'none';
    filters.style.display = logged ? 'flex' : 'none';
    tableContainer.style.display = logged ? 'block' : 'none';
  };

  // === CONTROLLO SESSIONE INIZIALE ===
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    setUI(true);
    await loadOrders();
  } else {
    setUI(false);
  }

  // === LOGIN ===
  btnLogin?.addEventListener('click', async () => {
    authMsg.textContent = '';
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
      authMsg.textContent = 'Inserisci email e password.';
      return;
    }

    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = 'Accesso negato. Controlla le credenziali.';
      return;
    }

    setUI(true);
    await loadOrders();
  });

  // === LOGOUT ===
  btnLogout?.addEventListener('click', async () => {
    await sbClient.auth.signOut();
    setUI(false);
    tableContainer.innerHTML = 'Accedi per visualizzare i dati.';
  });

  // === FILTRI ===
  btnFilter?.addEventListener('click', async () => {
    const jobRef = jobRefInput.value.trim() || null;
    const jobYear = jobYearInput.value ? parseInt(jobYearInput.value) : null;
    const date = dateInput.value || null;
    console.log('Filtro cliccato\nFiltri ricevuti:', jobRef, jobYear, date);
    await loadOrders(jobRef, jobYear, date);
  });

  // === FUNZIONE CARICAMENTO ORDINI ===
  async function loadOrders(jobRef = null, jobYear = null, date = null) {
    let query = sbClient
      .from('material_order_lines')
      .select(`
        id,
        supplier_name,
        code,
        description,
        qty,
        material_orders!inner(job_ref, job_year, request_date)
      `)
      .order('id', { ascending: false });

    if (jobRef) query = query.eq('material_orders.job_ref', jobRef);
    if (jobYear) query = query.eq('material_orders.job_year', jobYear);
    if (date) query = query.eq('material_orders.request_date', date);

    const { data, error } = await query;

    if (error) {
      console.error('Errore caricamento dati:', error);
      tableContainer.innerHTML = `<p style="color:#f66;">Errore nel caricamento dati.</p>`;
      return;
    }

    if (!data || !data.length) {
      tableContainer.innerHTML = `<p style="color:#888;">Nessun dato trovato.</p>`;
      return;
    }

    // Crea tabella HTML
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
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td>${row.material_orders.job_ref}</td>
              <td>${row.material_orders.job_year}</td>
              <td>${row.material_orders.request_date || '-'}</td>
              <td>${row.supplier_name || '-'}</td>
              <td>${row.code || '-'}</td>
              <td>${row.description || '-'}</td>
              <td>${row.qty || 0}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;

    tableContainer.innerHTML = html;
  }
});
