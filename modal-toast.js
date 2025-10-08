// ===== TOAST SYSTEM =====
const Toast = {
  show(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
      console.error('Toast container mancante');
      return;
    }

    const icons = {
      success: '●',
      error: '●',
      warning: '●'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove dopo duration
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// ===== MODAL SYSTEM =====
const Modal = {
  confirm(message, title = 'Conferma', options = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const isDanger = options.danger || false;
    const confirmText = options.confirmText || 'Conferma';
    const cancelText = options.cancelText || 'Annulla';

    overlay.innerHTML = `
      <div class="modal-box">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-buttons">
          <button class="modal-btn cancel" tabindex="1">${cancelText}</button>
          <button class="modal-btn ${isDanger ? 'danger' : 'confirm'}" tabindex="2">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const [cancelBtn, confirmBtn] = overlay.querySelectorAll('.modal-btn');

    const cleanup = (result) => {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup(false);
    };

            // Tastiera: ESC, Tab, Enter, Spazio, Frecce
            const keyHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup(false);
                document.removeEventListener('keydown', keyHandler);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement === cancelBtn) {
                cancelBtn.click();
                } else {
                confirmBtn.click();
                }
            } else if (e.key === ' ') {
                e.preventDefault();
                if (document.activeElement === confirmBtn) {
                confirmBtn.click();
                } else if (document.activeElement === cancelBtn) {
                cancelBtn.click();
                }
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (document.activeElement === cancelBtn) {
                confirmBtn.focus();
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (document.activeElement === confirmBtn) {
                cancelBtn.focus();
                }
            }
            };
                
    document.addEventListener('keydown', keyHandler);

    // Focus automatico sul bottone di conferma
    setTimeout(() => confirmBtn.focus(), 100);
  });
}
};

// Rendi globali
window.Toast = Toast;
window.Modal = Modal;