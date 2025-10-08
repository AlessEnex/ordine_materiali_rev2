

// ===== login.js =====
// Crea UN SOLO client globale e riusalo ovunque
const SUPABASE_URL = 'https://ndpqnoyzfxthclcrvszn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcHFub3l6Znh0aGNsY3J2c3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjQ3MDAsImV4cCI6MjA3NTQwMDcwMH0.r4FqmB7_FiQWb_yJsFgjMESoqhTMtUgfGGQ7OpyUTbE';

window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const emailEl   = document.getElementById('loginEmail');
  const sendBtn   = document.getElementById('btnSendOtp');
  const codeEl    = document.getElementById('otpCode');
  const verifyBtn = document.getElementById('btnVerifyOtp');
  const msgEl     = document.getElementById('loginMsg');

  const setMsg = (text, ok = false) => {
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#7aa2ff' : '#ff8c8c';
  };

  // Solo cifre nel campo codice
  codeEl?.addEventListener('input', () => {
    codeEl.value = (codeEl.value || '').replace(/\D/g, '').slice(0, 6);
  });

  // 1) Invia codice (OTP) SOLO se l'email è in whitelist
  sendBtn?.addEventListener('click', async () => {
    setMsg('');
    const email = (emailEl.value || '').trim().toLowerCase();
    if (!email) { setMsg('Inserisci la tua email.'); return; }

    sendBtn.disabled = true;

    try {
      // Whitelist check
      const { data: allowed, error: checkErr } = await window.sbClient
      .from('allowed_emails').select('email').ilike('email', email).maybeSingle()


      if (checkErr) { console.error(checkErr); setMsg('Errore di verifica whitelist.'); return; }
      if (!allowed) { setMsg('Email non appartenente alla whitelist.'); return; }

      // Invia OTP (codice a 6 cifre via email)
      const { error: otpErr } = await window.sbClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false } // non crea utenti nuovi
      });

      if (otpErr) { console.error(otpErr); setMsg('Errore nell’invio del codice.'); return; }

      setMsg('Codice inviato. Controlla la tua casella email (può volerci qualche secondo).', true);

        if (window.confetti) {
        window.confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
          });
        }


      
      codeEl.focus();
    } finally {
      sendBtn.disabled = false;
    }
  });

  // 2) Verifica codice (OTP) e crea sessione
  verifyBtn?.addEventListener('click', async () => {
    setMsg('');
    const email = (emailEl.value || '').trim().toLowerCase();
    const code  = (codeEl.value || '').trim();

    if (!email) { setMsg('Inserisci la tua email.'); return; }
    if (!/^\d{6}$/.test(code)) { setMsg('Inserisci il codice a 6 cifre.'); return; }

    verifyBtn.disabled = true;

    try {
      const { data, error } = await window.sbClient.auth.verifyOtp({
        email,
        token: code,
        type: 'email' // OTP via email
      });

      if (error) { console.error(error); setMsg('Codice non valido o scaduto.'); return; }

      setMsg('Accesso effettuato.', true);

      // (opzionale) nascondi box login e mostra UI principale
      const loginBox = document.getElementById('loginBox');
      if (loginBox) loginBox.style.display = 'none';

      // Se vuoi ricaricare la pagina per propagare la sessione:
      // location.reload();
    } finally {
      verifyBtn.disabled = false;
    }
  });
});
