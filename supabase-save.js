// ===== supabase-save.js =====

// Usa il client globale creato in login.js: window.sbClient

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
  const btnSave = document.getElementById('saveSupabase');
  const originalText = btnSave.textContent;
  
  // Disabilita bottone e mostra loading
  btnSave.disabled = true;
  btnSave.textContent = 'Salvataggio in corso...';
  
  const sbClient = window.sbClient;
  const payload = collectOrderPayload();

  // Validazioni
  if (!payload.jobRef) {
    Toast.error('Inserisci il numero commessa prima di salvare');
    btnSave.textContent = originalText;
    btnSave.disabled = false;
    return;
  }
  
  if (!payload.lines.length) {
    Toast.warning('Non ci sono righe materiali da salvare');
    btnSave.textContent = originalText;
    btnSave.disabled = false;
    return;
  }

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
      
      const proceed = await Modal.confirm(msg, 'Righe già presenti', {
        confirmText: 'Aggiungi comunque',
        cancelText: 'Annulla'
      });
      
      if (!proceed) {
        Toast.warning('Operazione annullata');
        btnSave.textContent = originalText;
        btnSave.disabled = false;
        return;
      }
    }
  } catch (err) {
    console.error('DEBUG check error:', err);
    Toast.error('Errore durante il controllo della commessa');
    btnSave.textContent = originalText;
    btnSave.disabled = false;
    return;
  }

  // 2) Inserimento ordine E recupero ID immediato
  try {
    const { data: newOrder, error: orderErr } = await sbClient
      .from('material_orders')
      .insert({
        job_ref: payload.jobRef,
        job_year: payload.jobYear,
        request_date: payload.requestDate || null,
      })
      .select('id')
      .single();
      
    if (orderErr) throw orderErr;

    const orderId = newOrder.id;

    // 3) Inserimento righe materiali
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

    Toast.success('Dati salvati correttamente');
    window.__lastSaveOk = true;
    
    // Abilita bottone email
    const mailBtn = document.getElementById('exportMail');
    if (mailBtn) { 
      mailBtn.disabled = false; 
      mailBtn.title = ''; 
    }
    
    // Ripristina bottone salva
    btnSave.textContent = originalText;
    btnSave.disabled = false;

  } catch (err) {
    console.error('DEBUG save error:', err);
    Toast.error('Errore durante il salvataggio');
    
    // Ripristina bottone anche in caso di errore
    btnSave.textContent = originalText;
    btnSave.disabled = false;
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