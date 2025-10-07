// ===== supabase-save.js =====

// Non creare un nuovo client qui.
// Usiamo quello globale creato in login.js: window.sbClient

document.addEventListener('DOMContentLoaded', () => {
  if (!window.sbClient) {
    console.error('Supabase client mancante: assicurati che login.js sia caricato prima.');
    return;
  }
  const btnSave = document.getElementById('saveSupabase');
  if (btnSave) btnSave.addEventListener('click', onSaveClick);
});

// === CLICK SALVA ===
async function onSaveClick() {
  const sbClient = window.sbClient; // alias locale
  const payload = collectOrderPayload();

  // Validazioni
  if (!payload.jobRef) { alert('Inserisci il numero commessa prima di salvare.'); return; }
  if (!payload.lines.length) { alert('Non ci sono righe materiali da salvare.'); return; }

  // 1) Controllo righe già presenti per stessa commessa/anno
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

    if (existing && existing.length > 0) {
      const preview = existing.map(r =>
        `• ${r.supplier_name || ''} - ${r.code || ''} (${r.qty}) ${r.description || ''}`
      ).join('\n');

      const msg =
        `Sono già presenti ${existing.length} righe per la commessa ${payload.jobRef} (${payload.jobYear}).\n\n` +
        `${preview}\n\nVuoi aggiungere comunque le nuove righe?`;
      const proceed = confirm(msg);
      if (!proceed) { alert('Operazione annullata. Nessun dato modificato.'); return; }
    }
  } catch (err) {
    console.error('DEBUG check error:', err);
    alert('Errore durante il controllo della commessa.');
    return;
  }

  // 2) Inserimento ordine (senza .select)
  try {
    const { error: orderErr } = await sbClient
      .from('material_orders')
      .insert({
        job_ref: payload.jobRef,
        job_year: payload.jobYear,
        request_date: payload.requestDate || null,
      });
    if (orderErr) throw orderErr;

    // 3) Recupero ID ordine appena creato (più recente per stessa commessa/anno)
    const { data: latest, error: selErr } = await sbClient
      .from('material_orders')
      .select('id')
      .eq('job_ref', payload.jobRef)
      .eq('job_year', payload.jobYear)
      .order('created_at', { ascending: false })
      .limit(1);
    if (selErr) throw selErr;
    if (!latest || !latest.length) throw new Error('Nessun ID trovato per l’ordine');

    const orderId = latest[0].id;

    // 4) Inserimento righe materiali
    const rows = payload.lines.map(l => ({
      order_id: orderId,
      supplier_id: l.supplier_id || null,
      supplier_name: l.supplier_name || null,
      code: l.code || null,
      description: l.description || null,
      qty: l.qty,
    }));

    const { error: lineErr } = await sbClient.from('material_order_lines').insert(rows);
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

// === MERGE RIGHE DUPLICATE (se ti serve in futuro) ===
function mergeLines(lines) {
  const acc = {};
  for (const r of lines) {
    const key = `${r.supplier_id}||${r.code}||${r.description}`;
    if (!acc[key]) acc[key] = { ...r };
    else acc[key].qty = Number(acc[key].qty) + Number(r.qty);
  }
  return Object.values(acc);
}
