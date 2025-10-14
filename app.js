// ===== Config & State =====
const JSON_PRODUCTS_URL = 'data.json';
const JSON_SUPPLIERS_URL = 'fornitori.json';

let productMap = {};
let products = [];
let suppliers = [];

// Destinatari email di default
const DEFAULT_RECIPIENTS = {
  to: ['laura.valente@enextechnologies.com', 'chiara.guagliumi@enextechnologies.com'],
  cc: ['acquisti@enex.it', 'romane.jacques@enextechnologies.com']
};

const normalize = s => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

const debounce = (fn, ms=150) => {
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
};

async function loadData() {
  const resProducts = await fetch(JSON_PRODUCTS_URL);
  productMap = await resProducts.json();
  
  products = Object.entries(productMap).map(([code, description]) => ({
    code,
    description,
    normDesc: normalize(description)
  }));

  const resSuppliers = await fetch(JSON_SUPPLIERS_URL);
  const suppliersRaw = await resSuppliers.json();
  
  suppliers = suppliersRaw.map((s, index) => 
    typeof s === 'string' 
      ? { id: String(index + 1), name: s }
      : { id: s.id || String(index + 1), name: s.name }
  );
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadData();
  } catch (e) {
    console.warn('loadData fallita:', e);
  }
  const linesEl = document.getElementById('lines');
  if (linesEl && !linesEl.children.length) {
    addLine(linesEl);
  }
});

function initUI(){
  const linesEl = document.getElementById('lines');
  addLine(linesEl);
}

// === RESTRIZIONE NUMERO COMMESSA ===
document.addEventListener('DOMContentLoaded', () => {
  const jobRefInput = document.getElementById('jobRef');
  if (!jobRefInput) return;

  jobRefInput.addEventListener('input', (e) => {
    const clean = e.target.value.replace(/\D/g, '');
    e.target.value = clean;

    const num = parseInt(clean, 10);
    if (isNaN(num) || num < 10 || num > 999) {
      e.target.setCustomValidity('Inserisci un numero compreso tra 10 e 999');
    } else {
      e.target.setCustomValidity('');
    }
  });

  jobRefInput.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });
});

function addLine(container){
  const tpl = document.getElementById('lineTemplate');
  const node = tpl.content.firstElementChild.cloneNode(true);

  const selSupplier = node.querySelector('.supplier');
  const qtyInput    = node.querySelector('.quantity');
  const codeInput   = node.querySelector('.codeInput');
  const descInput   = node.querySelector('.descInput');

  const btnUp   = node.querySelector('.stepper .step.up');
  const btnDown = node.querySelector('.stepper .step.down');

  const step = parseInt(qtyInput.getAttribute('step') || '1', 10);
  const min  = parseInt(qtyInput.getAttribute('min')  || '0', 10);

  const applyQty = (val) => {
    const v = Math.max(min, val);
    qtyInput.value = String(v);
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

  qtyInput.addEventListener('change', () => {
    const cur = parseInt(qtyInput.value || '0', 10) || 0;
    if (cur < min) applyQty(min);
  });

  selSupplier.innerHTML = '';
  selSupplier.append(new Option('-- Seleziona --',''));
  suppliers.forEach(s => selSupplier.append(new Option(s.name, s.id)));

  setupAutocomplete(codeInput, 'code');
  setupAutocomplete(descInput, 'desc');

  qtyInput.addEventListener('input', () => {
    const v = parseInt(qtyInput.value || '0', 10);
    if (isNaN(v) || v < 0) qtyInput.value = 0;

    const isLast = container.lastElementChild === node;
    if (isLast && parseInt(qtyInput.value,10) > 0) {
      addLine(container);
    }
  });

  container.appendChild(node);
}

function setupAutocomplete(input, mode){
  const otherInput = mode === 'code'
    ? input.closest('.line').querySelector('.descInput')
    : input.closest('.line').querySelector('.codeInput');

  const list = input.parentElement.querySelector('.suggestions');

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
      input.value = mode === 'code' ? picked.code : picked.description;
      otherInput.value = mode === 'code' ? picked.description : picked.code;
      hideList(list);
      input.blur();
    }, mode);
  }, 120);

  input.addEventListener('input', runSearch);
  input.addEventListener('focus', runSearch);
  input.addEventListener('blur', () => setTimeout(()=>hideList(list), 120));

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

    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPick(p);
      hideList(listEl);
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

// ===== GESTIONE DESTINATARI EMAIL =====
function createEmailRecipientsUI() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
      <h3 class="modal-title">Destinatari email</h3>
      
      <div style="margin: 1.5rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
          Destinatari principali (A:)
        </label>
        <div id="toRecipients" class="recipients-list"></div>
        <input type="email" id="newToEmail" placeholder="Aggiungi email destinatario..." 
               style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin: 1.5rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
          Copia conoscenza (CC:)
        </label>
        <div id="ccRecipients" class="recipients-list"></div>
        <input type="email" id="newCcEmail" placeholder="Aggiungi email in CC..." 
               style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div class="modal-buttons">
        <button class="modal-btn cancel" tabindex="1">Annulla</button>
        <button class="modal-btn confirm" tabindex="2">Invia email</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Popola le liste
  const toContainer = modal.querySelector('#toRecipients');
  const ccContainer = modal.querySelector('#ccRecipients');
  
  const toEmails = [...DEFAULT_RECIPIENTS.to];
  const ccEmails = [...DEFAULT_RECIPIENTS.cc];
  
  const renderRecipient = (email, container, array) => {
    const tag = document.createElement('div');
    tag.className = 'email-tag';
    tag.innerHTML = `
      <span>${email}</span>
      <button type="button" class="remove-email" title="Rimuovi">×</button>
    `;
    
    tag.querySelector('.remove-email').addEventListener('click', () => {
      const idx = array.indexOf(email);
      if (idx > -1) array.splice(idx, 1);
      tag.remove();
    });
    
    container.appendChild(tag);
  };
  
  const renderAll = () => {
    toContainer.innerHTML = '';
    ccContainer.innerHTML = '';
    toEmails.forEach(e => renderRecipient(e, toContainer, toEmails));
    ccEmails.forEach(e => renderRecipient(e, ccContainer, ccEmails));
  };
  
  renderAll();
  
  // Aggiungi destinatari
  const newToInput = modal.querySelector('#newToEmail');
  const newCcInput = modal.querySelector('#newCcEmail');
  
  const addEmail = (input, array, container) => {
    const email = input.value.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (!array.includes(email)) {
        array.push(email);
        renderRecipient(email, container, array);
      }
      input.value = '';
    }
  };
  
  newToInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail(newToInput, toEmails, toContainer);
    }
  });
  
  newCcInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail(newCcInput, ccEmails, ccContainer);
    }
  });
  
  // Gestione bottoni
  const [cancelBtn, confirmBtn] = modal.querySelectorAll('.modal-btn');
  
  return new Promise((resolve) => {
    const cleanup = (result) => {
      modal.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => {
        modal.remove();
        resolve(result);
      }, 200);
    };
    
    cancelBtn.onclick = () => cleanup(null);
    confirmBtn.onclick = () => cleanup({ to: toEmails, cc: ccEmails });
    
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(null);
    };
  });
}

// ===== EXPORT TO MAIL (MODIFICATO) =====
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exportMail');
  if (btn) {
    btn.addEventListener('click', exportToMail);
  }
});

async function exportToMail() {
  // Apri modale per scegliere destinatari
  const recipients = await createEmailRecipientsUI();
  
  if (!recipients) {
    return; // Utente ha annullato
  }
  
  const jobRef = document.getElementById('jobRef').value.trim();
  const jobName = document.getElementById('jobName').value.trim();
  const reqDate = document.getElementById('requestDate').value;

  let body = [];
  body.push(`Numero commessa: ${jobRef || "-"}`);
  body.push(`Nome commessa: ${jobName || "-"}`);
  body.push(`Data richiesta: ${reqDate || "-"}`);
  body.push("");
  body.push("Materiali:");

  document.querySelectorAll('#lines .line').forEach(line => {
    const qty = parseInt(line.querySelector('.quantity')?.value || "0", 10);
    if (qty > 0) {
      const supplierSelect = line.querySelector('.supplier');
      const supplierName = supplierSelect?.options[supplierSelect.selectedIndex]?.text || "-";
      const code = line.querySelector('.codeInput')?.value || "";
      const desc = line.querySelector('.descInput')?.value || "";
      body.push(`- [${supplierName}] ${qty} × ${code} — ${desc}`);
    }
  });

  const subject = encodeURIComponent(`ORDINI MATERIALI — ${jobRef || ""}`);
  const mailBody = encodeURIComponent(body.join("\n"));
  
  // Costruisci URL mailto con destinatari e CC
  const toList = recipients.to.join(',');
  const ccList = recipients.cc.join(',');
  
  let mailUrl = `mailto:${toList}?subject=${subject}&body=${mailBody}`;
  if (ccList) {
    mailUrl += `&cc=${ccList}`;
  }
  
  window.location.href = mailUrl;
}

// === PULSANTE APRI VISUALIZZA ===
document.addEventListener('DOMContentLoaded', () => {
  const btnVisualizza = document.getElementById('openVisualizza');
  if (btnVisualizza) {
    btnVisualizza.addEventListener('click', () => {
      window.location.href = 'visualizza.html';
    });
  }
});

// Feedback quando si clicca su "Invia email" mentre è disabilitato
document.addEventListener('DOMContentLoaded', () => {
  const mailBtn = document.getElementById('exportMail');
  if (!mailBtn) return;

  mailBtn.addEventListener('click', (e) => {
    if (mailBtn.disabled) {
      e.preventDefault();
      Toast.warning('Salva prima i dati su Supabase');
    }
  });
});