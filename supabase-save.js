// ===== supabase-save.js =====

// === CONFIGURAZIONE ===
const SUPABASE_URL = 'https://ndpqnoyzfxthclcrvszn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcHFub3l6Znh0aGNsY3J2c3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjQ3MDAsImV4cCI6MjA3NTQwMDcwMH0.r4FqmB7_FiQWb_yJsFgjMESoqhTMtUgfGGQ7OpyUTbE';

let sbClient = null;

// === INIZIALIZZAZIONE ===
document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabase) {
    console.error('Libreria Supabase non trovata');
    return;
  }

  // Creo il client con headers forzati
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'public' },
    global: {
      fetch: (url, options = {}) => {
        options.headers = {
          ...(options.headers || {}),
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        };
        return fetch(url, options);
      },
    },
  });

  const btnSave = document.getElementById('saveSupabase');
  if (btnSave) btnSave.addEventListener('click', onSaveClick);
});

// === EVENTO CLICK ===
async function onSaveClick() {
  if (!sbClient) {
    alert('Supabase non configurato.');
    return;
  }

  const payload = collectOrderPayload();
  if (!payload.jobRef) {
    alert('Inserisci la commessa.');
    return;
  }
  if (!payload.lines.length) {
    alert('Aggiungi almeno una riga (qty > 0).');
    return;
  }

  const merged = mergeLines(payload.lines);

    try {
    // 1️⃣ Inserisci l'ordine
    const { error: orderErr } = await sbClient
    .from('material_orders')
    .insert({
    job_ref: payload.jobRef,
    job_year: payload.jobYear,
    request_date: payload.requestDate || null,
    });


    if (orderErr) throw orderErr;

    // 2️⃣ Recupera l'ultimo ordine inserito (il più recente per quella commessa)
    const { data: latest, error: selErr } = await sbClient
      .from('material_orders')
      .select('id')
      .eq('job_ref', payload.jobRef)
      .order('created_at', { ascending: false })
      .limit(1);

    if (selErr) throw selErr;
    if (!latest || !latest.length) throw new Error('Nessun ID trovato per l’ordine');

    const order_id = latest[0].id;

    // 3️⃣ Inserisci le righe
    const rows = merged.map((r) => ({
      order_id,
      supplier_id: r.supplier_id || null,
      supplier_name: r.supplier_name || null,
      code: r.code || null,
      description: r.description || null,
      qty: r.qty,
    }));

    const { error: linesErr } = await sbClient
      .from('material_order_lines')
      .insert(rows);

    if (linesErr) throw linesErr;

    alert('Ordine salvato su Supabase ✅');
  } catch (err) {
    console.error('Errore Supabase:', err);
    alert('Errore salvataggio su Supabase ❌');
  }

}

// === RACCOLTA DATI DAL DOM ===
function collectOrderPayload() {
  const jobRef = (document.getElementById('jobRef')?.value || '').trim();
  const jobYear = parseInt(document.getElementById('jobYear')?.value || '2025', 10);
  const requestDate = (document.getElementById('requestDate')?.value || '').trim();

  const lines = [];
  document.querySelectorAll('#lines .line').forEach((line) => {
    const qty = parseFloat(line.querySelector('.quantity')?.value || '0');
    if (!qty || qty <= 0) return;

    const sel = line.querySelector('.supplier');
    const supplier_id = sel?.value || '';
    const supplier_name = sel?.options?.[sel.selectedIndex]?.text || '';

    const code = (line.querySelector('.codeInput')?.value || '').trim();
    const description = (line.querySelector('.descInput')?.value || '').trim();
    if (!code && !description) return;

    lines.push({ supplier_id, supplier_name, code, description, qty });
  });

  return { jobRef, jobYear, requestDate, lines };
}


// === MERGE RIGHE DUPLICATE ===
function mergeLines(lines) {
  const acc = {};
  for (const r of lines) {
    const key = `${r.supplier_id}||${r.code}||${r.description}`;
    if (!acc[key]) acc[key] = { ...r };
    else acc[key].qty = Number(acc[key].qty) + Number(r.qty);
  }
  return Object.values(acc);
}
