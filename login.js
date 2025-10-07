const SUPABASE_URL = 'https://ndpqnoyzfxthclcrvszn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcHFub3l6Znh0aGNsY3J2c3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MzU3MDAsImV4cCI6MjA3NTQwMDcwMH0.r4FqmB7_FiQWb_yJsFgjMESoqhTMtUgfGGQ7OpyUTbE';

//(const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnMagicLogin');
  const emailInput = document.getElementById('loginEmail');
  const msg = document.getElementById('loginMsg');

  btn.addEventListener('click', async () => {
    msg.textContent = '';

    const email = emailInput.value.trim().toLowerCase();
    if (!email) { msg.textContent = 'Inserisci la tua email.'; return; }

    // 1️⃣ Verifica nella whitelist
    const { data: allowed, error: checkErr } = await sbClient
      .from('allowed_emails')
      .select('email')
      .eq('email', email);

    if (checkErr) {
      msg.textContent = 'Errore di verifica. Riprova.';
      console.error(checkErr);
      return;
    }

    if (!allowed || allowed.length === 0) {
      msg.textContent = 'Email non appartenente alla whitelist.';
      return;
    }

    // 2️⃣ Se ok, invia magic link
    const { error } = await sbClient.auth.signInWithOtp({ email });
    if (error) {
      msg.textContent = 'Errore nell’invio del link.';
      console.error(error);
      return;
    }

    msg.style.color = '#7aa2ff';
    msg.textContent = 'Controlla la tua email: ti abbiamo inviato un link di accesso.';
  });
});
