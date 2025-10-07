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
// PRIMA: c'era una versione che faceva .insert(...).select('id') e falliva con RLS
// DOPO: versione robusta con controllo duplicati + insert ordine + select separata + insert righe

async function onSaveClick() {
  const payload = collectOrderPayload();

  // Validazioni
  if (!payload.jobRef) {
    alert('Inserisci il numero commessa prima di salvare.');
    return;
  }
  if (!payload.lines.length) {
    alert('Non ci sono righe materiali da salvare.');
    return;
  }

  // === 1) Controllo righe già presenti per stessa commessa/anno ===
  try {
    const { data: existing, error: checkErr } = await sbClient
      .from('material_order_lines')
      .select(`
        id,
        supplier_name,
        code,
        description,
        qty,
        material_orders!inner(job_ref, job_year)
      `)
      .eq('material_orders.job_ref', payload.jobRef)
      .eq('material_orders.job_year', payload.jobYear);

    if (checkErr) throw checkErr;

    console.log('DEBUG existing lines count:', existing?.length || 0, existing);

    if (existing && existing.length > 0) {
      const preview = existing.map(r =>
        `• ${r.supplier_name || ''} - ${r.code || ''} (${r.qty}) ${r.description || ''}`
      ).join('\n');

      const msg =
        `Sono già presenti ${existing.length} righe per la commessa ${payload.jobRef} (${payload.jobYear}).\n\n` +
        `${preview}\n\n` +
        `Vuoi aggiungere comunque le nuove righe?`;

      const proceed = confirm(msg);
      if (!proceed) {
        alert('Operazione annullata. Nessun dato è stato modificato.');
        return;
      }
    }
  } catch (err) {
    console.error('DEBUG check error:', err);
    alert('Errore durante il controllo della commessa.');
    return;
  }

  // === 2) Inserimento ORDINE (senza .select per evitare problemi RLS) ===
  try {
    const { error: orderErr } = await sbClient
      .from('material_orders')
      .insert({
        job_ref: payload.jobRef,
        job_year: payload.jobYear,
        request_date: payload.requestDate || null,
      });

    console.log('DEBUG order insert error:', orderErr || 'none');
    if (orderErr) throw orderErr;

    // === 3) Recupero ID dell'ultimo ordine creato (stessa commessa/anno) ===
    const { data: latest, error: selErr } = await sbClient
      .from('material_orders')
      .select('id')
      .eq('job_ref', payload.jobRef)
      .eq('job_year', payload.jobYear)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('DEBUG selected order row:', latest, 'selErr:', selErr || 'none');
    if (selErr) throw selErr;
    if (!latest || !latest.length) throw new Error('Nessun ID trovato per l’ordine');

    const orderId = latest[0].id;

    // === 4) Inserimento RIGHE ===
    const rows = payload.lines.map(l => ({
      order_id: orderId,
      supplier_id: l.supplier_id || null,
      supplier_name: l.supplier_name || null,
      code: l.code || null,
      description: l.description || null,
      qty: l.qty,
    }));
    console.log('DEBUG lines to insert:', rows.length, rows);

    const { error: lineErr } = await sbClient
      .from('material_order_lines')
      .insert(rows);

    console.log('DEBUG lines insert error:', lineErr || 'none');
    if (lineErr) throw lineErr;

    alert('✅ Dati salvati correttamente su Supabase.');
  } catch (err) {
    console.error('DEBUG save error:', err);
    alert('Errore durante il salvataggio su Supabase.');
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
