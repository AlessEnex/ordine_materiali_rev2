// ===== Config & State =====
const JSON_PRODUCTS_URL = 'data.json';      // mappa { "CODICE": "DESCRIZIONE", ... }
const JSON_SUPPLIERS_URL = 'fornitori.json';// ["Danfoss","Castel",...] oppure [{id,name},...]

let productMap = {};         // { code: description }
let products = [];           // [{code, description, normDesc}]
let suppliers = [];          // [{id, name}]

// Utility normalizzazione testo per ricerca
const normalize = s => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

// Debounce
const debounce = (fn, ms=150) => {
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  initUI();
});

async function loadData(){
  // carica products
  try{
    const res = await fetch(JSON_PRODUCTS_URL, {cache:'no-cache'});
    productMap = await res.json(); // oggetto code -> description
    products = Object.entries(productMap).map(([code, description])=>({
      code,
      description,
      normDesc: normalize(description)
    }));
  }catch(e){
    console.error('Errore caricamento data.json', e);
    productMap = {};
    products = [];
  }

  // carica suppliers
  try{
    const res = await fetch(JSON_SUPPLIERS_URL, {cache:'no-cache'});
    const raw = await res.json();
    if (Array.isArray(raw)) {
      if (raw.length && typeof raw[0] === 'string') {
        suppliers = raw.map(name => ({id:name, name}));
      } else {
        suppliers = raw.map(o => ({id: o.id ?? o.name ?? String(o), name: o.name ?? o.id ?? String(o)}));
      }
    } else {
      // fallback se fosse oggetto {id:name}
      suppliers = Object.entries(raw).map(([id,name])=>({id,name}));
    }
  }catch(e){
    console.warn('fornitori.json non trovato o invalido, uso placeholder', e);
    suppliers = [{id:'', name:'-- Seleziona --'}];
  }
}

function initUI(){
  const linesEl = document.getElementById('lines');
  addLine(linesEl); // prima riga vuota
}

// Crea una nuova riga
function addLine(container){
  const tpl = document.getElementById('lineTemplate');
  const node = tpl.content.firstElementChild.cloneNode(true);

  // elementi
  const selSupplier = node.querySelector('.supplier');
  const qtyInput    = node.querySelector('.quantity');
  const codeInput   = node.querySelector('.codeInput');
  const descInput   = node.querySelector('.descInput');


  // Stepper custom
  const btnUp   = node.querySelector('.stepper .step.up');
  const btnDown = node.querySelector('.stepper .step.down');

  const step = parseInt(qtyInput.getAttribute('step') || '1', 10);
  const min  = parseInt(qtyInput.getAttribute('min')  || '0', 10);

  const applyQty = (val) => {
    const v = Math.max(min, val);
    qtyInput.value = String(v);
    // trigghiamo l'evento input per mantenere la logica "aggiungi nuova riga"
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  btnUp.addEventListener('click', () => {
    const cur = parseInt(qtyInput.value || '0', 10) || 0;
    applyQty(cur + step);
  });

  btnDown.addEventListener('click', () => {
    const cur = parseInt(qtyInput.value || '0', 10) || 0;
    applyQty(cur - step);
  });

  // Evita numeri negativi anche da tastiera/wheel
  qtyInput.addEventListener('change', () => {
    const cur = parseInt(qtyInput.value || '0', 10) || 0;
    if (cur < min) applyQty(min);
  });


  // popola fornitori
  selSupplier.innerHTML = '';
  selSupplier.append(new Option('-- Seleziona --',''));
  suppliers.forEach(s => selSupplier.append(new Option(s.name, s.id)));

  // Autocomplete handlers
  setupAutocomplete(codeInput, 'code');
  setupAutocomplete(descInput, 'desc');

  // qty: blocco valori < 0 e auto-add riga
  qtyInput.addEventListener('input', () => {
    const v = parseInt(qtyInput.value || '0', 10);
    if (isNaN(v) || v < 0) qtyInput.value = 0;

    // Se questa riga è l'ultima visibile e qty > 0, aggiungi una nuova riga
    const isLast = container.lastElementChild === node;
    if (isLast && parseInt(qtyInput.value,10) > 0) {
      addLine(container);
    }
  });

  container.appendChild(node);
}

// Autocomplete per code/desc
function setupAutocomplete(input, mode){
  // mode: 'code' o 'desc'
  const otherInput = mode === 'code'
    ? input.closest('.line').querySelector('.descInput')
    : input.closest('.line').querySelector('.codeInput');

  const list = input.parentElement.querySelector('.suggestions');

  // ricerca filtrata
  const runSearch = debounce(() => {
    const q = normalize(input.value);
    if (!q) { hideList(list); return; }

    let matches;
    if (mode === 'code') {
      matches = products.filter(p => normalize(p.code).includes(q)).slice(0, 50);
    } else {
      matches = products.filter(p => p.normDesc.includes(q)).slice(0, 50);
    }
    renderSuggestions(list, matches, (picked) => {
      // on select: riempi entrambi i campi
      input.value = mode === 'code' ? picked.code : picked.description;
      otherInput.value = mode === 'code' ? picked.description : picked.code;
      hideList(list);
      input.blur();
    }, mode);
  }, 120);

  input.addEventListener('input', runSearch);
  input.addEventListener('focus', runSearch);
  input.addEventListener('blur', () => setTimeout(()=>hideList(list), 120)); // lascia tempo al click

  // tastiera
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('li');
    if (list.style.display !== 'block' || !items.length) return;

    const current = list.querySelector('li[aria-selected="true"]');
    let idx = current ? Array.from(items).indexOf(current) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < items.length - 1) idx++;
      setActive(items, idx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) idx--;
      setActive(items, idx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0) items[idx].click();
    } else if (e.key === 'Escape') {
      hideList(list);
    }
  });
}

function renderSuggestions(listEl, arr, onPick, mode){
  if (!arr.length) { hideList(listEl); return; }
  listEl.innerHTML = '';
  arr.forEach(p => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.innerHTML = mode === 'code'
      ? `<strong>${escapeHtml(p.code)}</strong> — ${escapeHtml(p.description)}`
      : `<strong>${escapeHtml(p.description)}</strong> — ${escapeHtml(p.code)}`;

    // Usa mousedown per chiudere PRIMA del blur/focus management
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();           // evita che l'input perda focus prima del pick
      e.stopPropagation();
      onPick(p);                    // compila i campi
      hideList(listEl);             // chiudi subito il menu
    });

    listEl.appendChild(li);
  });
  listEl.style.display = 'block';
}


function hideList(listEl){
  listEl.style.display = 'none';
  listEl.innerHTML = '';
}

function setActive(items, idx){
  items.forEach(li => li.removeAttribute('aria-selected'));
  if (idx >= 0 && idx < items.length) items[idx].setAttribute('aria-selected','true');
}

function escapeHtml(s){
  return (s ?? '').toString().replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}



// ===== EXPORT TO MAIL =====
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exportMail');
  if (btn) {
    btn.addEventListener('click', exportToMail);
  }
});

function exportToMail(){
  const jobRef = document.getElementById('jobRef').value.trim();
  const reqDate = document.getElementById('requestDate').value;

  let body = [];
  body.push(`Numero/Nome commessa: ${jobRef || "-"}`);
  body.push(`Data richiesta: ${reqDate || "-"}`);
  body.push("");
  body.push("Materiali:");

  // raccogli tutte le righe con qty > 0
  document.querySelectorAll('#lines .line').forEach(line => {
    const qty = parseInt(line.querySelector('.quantity')?.value || "0", 10);
    if (qty > 0) {
      const supplier = line.querySelector('.supplier')?.value || "";
      const code = line.querySelector('.codeInput')?.value || "";
      const desc = line.querySelector('.descInput')?.value || "";
      body.push(`- [${supplier}] ${qty} × ${code} – ${desc}`);
    }
  });

  const subject = encodeURIComponent(`ORDINI MATERIALI – ${jobRef || ""}`);
  const mailBody = encodeURIComponent(body.join("\n"));

  window.location.href = `mailto:acquisti@enex.it?subject=${subject}&body=${mailBody}`;
}
