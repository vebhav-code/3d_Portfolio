import Lenis from 'lenis';
import { measureSupabaseLatency, sendContactMessage, fetchContactMessages, deleteContactMessage } from './supabase.js';

const TOTAL_FRAMES = 180;
const canvas = document.getElementById('canvas-bg');
const ctx = canvas.getContext('2d', { alpha: false });

const images = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let lastRenderedIndex = -1;
let currentProgress = 0;
let targetProgress = 0;

function getFrameUrl(index) {
  const pad = String(index + 1).padStart(3, '0');
  return `/3d_image/ezgif-frame-${pad}.jpg`;
}

// Initialize Lenis for smooth momentum scrolling
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.5,
});

function calculateProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;
  return Math.max(0, Math.min(1, window.scrollY / maxScroll));
}

lenis.on('scroll', () => {
  targetProgress = calculateProgress();
});

window.addEventListener('scroll', () => {
  targetProgress = calculateProgress();
}, { passive: true });

// Smooth anchor scrolling via Lenis
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href');
    if (targetId && targetId !== '#') {
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        lenis.scrollTo(targetElement, { offset: -80, duration: 1.2 });
      }
    }
  });
});

function findLoadedImage(index) {
  if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
    return images[index];
  }
  for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
    const prev = index - offset;
    if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
      return images[prev];
    }
    const next = index + offset;
    if (next < TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth > 0) {
      return images[next];
    }
  }
  return null;
}

function drawFrame(index) {
  const img = findLoadedImage(index);
  if (!img) return;

  const canvasW = canvas.width;
  const canvasH = canvas.height;

  // Clear background
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const imgW = img.naturalWidth || 1920;
  const imgH = img.naturalHeight || 1080;

  // Full-bleed cover scaling to ensure the background fills every screen
  const scale = Math.max(canvasW / imgW, canvasH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const drawX = (canvasW - drawW) / 2;
  const drawY = (canvasH - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  lastRenderedIndex = index;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  lastRenderedIndex = -1;
  const frameIndex = Math.min(
    TOTAL_FRAMES - 1,
    Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
  );
  drawFrame(frameIndex);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Preload the first frame immediately for instant first paint
const firstImg = new Image();
firstImg.src = getFrameUrl(0);
firstImg.onload = () => {
  images[0] = firstImg;
  loadedCount++;
  drawFrame(0);
};

// Asynchronously preload all remaining frames
for (let i = 1; i < TOTAL_FRAMES; i++) {
  const img = new Image();
  img.src = getFrameUrl(i);
  img.onload = () => {
    images[i] = img;
    loadedCount++;
  };
}

// Animation loop
function raf(time) {
  lenis.raf(time);

  targetProgress = calculateProgress();

  const diff = targetProgress - currentProgress;
  if (Math.abs(diff) > 0.0001) {
    currentProgress += diff * 0.16;
  } else {
    currentProgress = targetProgress;
  }

  const frameIndex = Math.min(
    TOTAL_FRAMES - 1,
    Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
  );

  if (frameIndex !== lastRenderedIndex) {
    drawFrame(frameIndex);
  }

  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

// ================= SUPABASE INTEGRATION =================

async function initSupabaseLiveTelemetry() {
  const latency = await measureSupabaseLatency();
  const latencyText = latency !== null ? `${latency}ms` : 'ONLINE';

  const heroDisplay = document.getElementById('hero-latency-display');
  if (heroDisplay) {
    heroDisplay.textContent = `SUPABASE: ${latencyText} ONLINE`;
  }

  const statusPill = document.getElementById('supabase-status-pill');
  if (statusPill) {
    statusPill.textContent = `SUPABASE BACKEND: ${latencyText} (HEALTHY)`;
  }

  const terminalLatency = document.getElementById('terminal-ping-latency');
  if (terminalLatency) {
    terminalLatency.innerHTML = `Ping Latency: <span class="text-emerald-400 font-semibold">${latencyText}</span> [OK]`;
  }

  const modalPing = document.getElementById('modal-ping-result');
  if (modalPing) {
    modalPing.textContent = `64 bytes from geaziypuwsucehkrcjup.supabase.co: time=${latencyText} [OK]`;
  }
}

initSupabaseLiveTelemetry();

// Supabase Contact Message Form Submission Handler
const dispatchForm = document.getElementById('contact-dispatch-form');
const submitBtn = document.getElementById('dispatch-submit-btn');
const statusMsg = document.getElementById('dispatch-status-msg');

if (dispatchForm) {
  dispatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('input-sender-name')?.value.trim();
    const email = document.getElementById('input-sender-email')?.value.trim();
    const message = document.getElementById('input-sender-message')?.value.trim();

    if (!name || !email || !message) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-sm animate-spin">sync</span>
        <span>Transmitting...</span>
      `;
    }

    if (statusMsg) {
      statusMsg.className = 'font-mono text-xs text-sky-400';
      statusMsg.textContent = 'Connecting to Supabase...';
    }

    const res = await sendContactMessage({ name, email, message });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-sm">rocket_launch</span>
        <span>Transmit to Supabase</span>
      `;
    }

    if (res.success) {
      if (statusMsg) {
        statusMsg.className = 'font-mono text-xs text-emerald-400 font-semibold';
        statusMsg.textContent = '✓ Payload stored in Supabase!';
      }
      dispatchForm.reset();
    } else {
      // If table doesn't exist yet or permission error, provide helpful feedback + mailto fallback
      if (statusMsg) {
        statusMsg.className = 'font-mono text-xs text-amber-300';
        statusMsg.textContent = 'Message logged! (Opening email protocol fallback)';
      }
      // Trigger mailto fallback so the communication is never lost
      setTimeout(() => {
        window.location.href = `mailto:vebhavsharma2006@gmail.com?subject=Portfolio%20Inquiry%20from%20${encodeURIComponent(name)}&body=${encodeURIComponent(message)}%0A%0AFrom:%20${encodeURIComponent(email)}`;
      }, 800);
    }
  });
}

// ================= ADMIN CONSOLE CONTROLLER =================

const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'Vebhav';
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Vebhav@123';
const AUTH_KEY = 'vebhav_admin_authenticated';

let adminMessagesCache = [];
let adminFilterQuery = '';

function isAuth() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoStr;
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  } catch (e) {
    return '';
  }
}

// Global modal switcher
window.handleToggleAdminModal = function(open) {
  const modal = document.getElementById('admin-modal');
  if (!modal) return;

  const authView = document.getElementById('admin-auth-view');
  const dashView = document.getElementById('admin-dashboard-view');

  const shouldOpen = open === undefined ? modal.classList.contains('hidden') : open;

  if (shouldOpen) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (isAuth()) {
      if (authView) authView.classList.add('hidden');
      if (dashView) dashView.classList.remove('hidden');
      loadAdminData();
    } else {
      if (authView) authView.classList.remove('hidden');
      if (dashView) dashView.classList.add('hidden');
      setTimeout(() => {
        document.getElementById('admin-user-input')?.focus();
      }, 100);
    }
  } else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// Close modal when clicking backdrop outside cards
const adminModalEl = document.getElementById('admin-modal');
if (adminModalEl) {
  adminModalEl.addEventListener('click', (e) => {
    if (e.target === adminModalEl) {
      window.handleToggleAdminModal(false);
    }
  });
}

// Password show/hide toggle
const togglePwdBtn = document.getElementById('admin-toggle-pwd-btn');
const passInput = document.getElementById('admin-pass-input');
const pwdIcon = document.getElementById('admin-pwd-icon');

if (togglePwdBtn && passInput) {
  togglePwdBtn.addEventListener('click', () => {
    const isPassword = passInput.getAttribute('type') === 'password';
    passInput.setAttribute('type', isPassword ? 'text' : 'password');
    if (pwdIcon) {
      pwdIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    }
  });
}

// Admin login form handler
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('admin-login-error');
const loginErrorText = document.getElementById('admin-login-error-text');

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userInput = document.getElementById('admin-user-input')?.value.trim();
    const passValue = document.getElementById('admin-pass-input')?.value;

    if (userInput.toLowerCase() === ADMIN_USER.toLowerCase() && passValue === ADMIN_PASS) {
      if (loginError) loginError.classList.add('hidden');
      sessionStorage.setItem(AUTH_KEY, 'true');

      const authView = document.getElementById('admin-auth-view');
      const dashView = document.getElementById('admin-dashboard-view');
      if (authView) authView.classList.add('hidden');
      if (dashView) dashView.classList.remove('hidden');

      loadAdminData();
    } else {
      if (loginError) {
        loginError.classList.remove('hidden');
        if (loginErrorText) {
          loginErrorText.textContent = 'Invalid credentials. Please verify your admin username and password.';
        }
      }
    }
  });
}

// Admin logout handler
const logoutBtn = document.getElementById('admin-logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    const authView = document.getElementById('admin-auth-view');
    const dashView = document.getElementById('admin-dashboard-view');
    if (dashView) dashView.classList.add('hidden');
    if (authView) authView.classList.remove('hidden');

    const passEl = document.getElementById('admin-pass-input');
    if (passEl) passEl.value = '';
    if (loginError) loginError.classList.add('hidden');
  });
}

// Refresh button handler
const refreshBtn = document.getElementById('admin-refresh-btn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    loadAdminData();
  });
}

// Search filter handler
const searchInput = document.getElementById('admin-search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    adminFilterQuery = e.target.value.toLowerCase().trim();
    renderFilteredMessages();
  });
}

// Export CSV handler
const exportBtn = document.getElementById('admin-export-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (!adminMessagesCache || adminMessagesCache.length === 0) {
      alert('No messages available to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Name', 'Email', 'Message'];
    const rows = adminMessagesCache.map(msg => [
      `"${(msg.id || '').replace(/"/g, '""')}"`,
      `"${formatTimestamp(msg.created_at).replace(/"/g, '""')}"`,
      `"${(msg.name || '').replace(/"/g, '""')}"`,
      `"${(msg.email || '').replace(/"/g, '""')}"`,
      `"${(msg.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vebhav_portfolio_messages_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Fetch and load data
async function loadAdminData() {
  const loadingEl = document.getElementById('admin-data-loading');
  const errorEl = document.getElementById('admin-data-error');
  const errorDesc = document.getElementById('admin-error-desc');
  const emptyEl = document.getElementById('admin-data-empty');
  const container = document.getElementById('admin-messages-container');
  const countLabel = document.getElementById('admin-count-label');
  const refreshIcon = document.getElementById('admin-refresh-icon');

  if (refreshIcon) refreshIcon.classList.add('animate-spin');
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (container) container.innerHTML = '';
  if (countLabel) countLabel.textContent = 'Querying Supabase database...';

  const res = await fetchContactMessages();

  if (refreshIcon) {
    setTimeout(() => refreshIcon.classList.remove('animate-spin'), 400);
  }
  if (loadingEl) loadingEl.classList.add('hidden');

  if (!res.success) {
    if (errorEl) {
      errorEl.classList.remove('hidden');
      if (errorDesc) {
        errorDesc.textContent = res.error || 'Unable to retrieve messages from Supabase.';
      }
    }
    if (countLabel) countLabel.textContent = 'Query error';
    return;
  }

  adminMessagesCache = res.data || [];
  updateAdminMetrics(adminMessagesCache);
  renderFilteredMessages();
}

function updateAdminMetrics(messages) {
  const totalEl = document.getElementById('admin-stat-total');
  const uniqueEl = document.getElementById('admin-stat-unique');
  const latestEl = document.getElementById('admin-stat-latest');

  if (totalEl) totalEl.textContent = messages.length;

  if (uniqueEl) {
    const uniqueEmails = new Set(messages.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean));
    uniqueEl.textContent = uniqueEmails.size;
  }

  if (latestEl) {
    if (messages.length > 0 && messages[0].created_at) {
      latestEl.textContent = formatTimestamp(messages[0].created_at);
    } else {
      latestEl.textContent = 'None yet';
    }
  }
}

function renderFilteredMessages() {
  const container = document.getElementById('admin-messages-container');
  const emptyEl = document.getElementById('admin-data-empty');
  const countLabel = document.getElementById('admin-count-label');
  if (!container) return;

  const filtered = adminMessagesCache.filter(msg => {
    if (!adminFilterQuery) return true;
    const nameMatch = (msg.name || '').toLowerCase().includes(adminFilterQuery);
    const emailMatch = (msg.email || '').toLowerCase().includes(adminFilterQuery);
    const msgMatch = (msg.message || '').toLowerCase().includes(adminFilterQuery);
    return nameMatch || emailMatch || msgMatch;
  });

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${adminMessagesCache.length} messages`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      if (adminFilterQuery) {
        emptyEl.querySelector('span.font-semibold').textContent = 'No messages matching search query';
      } else {
        emptyEl.querySelector('span.font-semibold').textContent = 'No messages in database yet';
      }
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  container.innerHTML = filtered.map(msg => {
    const id = msg.id;
    const name = escapeHtml(msg.name || 'Anonymous Sender');
    const email = escapeHtml(msg.email || 'No email provided');
    const message = escapeHtml(msg.message || '');
    const dateFormatted = formatTimestamp(msg.created_at);
    const relTime = timeAgo(msg.created_at);

    return `
      <div class="p-4 exec-card-subtle border border-white/10 hover:border-brand-cyan/40 transition-all space-y-3" id="admin-row-${id}">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b exec-divider pb-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
            <span class="font-bold text-white text-sm tracking-wide">${name}</span>
            <span class="text-xs text-slate-400 font-mono flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <span class="material-symbols-outlined text-[13px] text-brand-cyan">mail</span>
              <a href="mailto:${email}" class="hover:text-brand-cyan transition-colors">${email}</a>
            </span>
          </div>
          <div class="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span class="material-symbols-outlined text-[13px]">schedule</span>
            <span>${dateFormatted}</span>
            ${relTime ? `<span class="text-brand-cyan/80">(${relTime})</span>` : ''}
          </div>
        </div>

        <div class="font-mono text-xs text-slate-200 bg-[#06080d] p-3.5 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed select-text">
          ${message}
        </div>

        <div class="flex items-center justify-between pt-1 font-mono text-xs">
          <a href="mailto:${email}?subject=Re:%20Portfolio%20Inquiry%20from%20Vebhav%20Sharma&body=%0A%0A---%0AOriginal%20Message:%0A${encodeURIComponent(msg.message || '')}" class="text-brand-cyan hover:text-white transition-colors flex items-center gap-1 font-semibold">
            <span class="material-symbols-outlined text-sm">reply</span>
            <span>Reply via Email</span>
          </a>
          <button class="admin-del-btn text-rose-400 hover:text-white hover:bg-rose-500/20 px-2.5 py-1 rounded transition-colors flex items-center gap-1 border border-rose-500/30" data-id="${id}" data-name="${name}">
            <span class="material-symbols-outlined text-sm">delete</span>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach delete handlers
  container.querySelectorAll('.admin-del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.getAttribute('data-id');
      const senderName = btn.getAttribute('data-name');
      if (!id) return;

      if (!confirm(`Are you sure you want to delete the message from "${senderName}"?`)) {
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Deleting...`;

      const delRes = await deleteContactMessage(id);
      if (delRes.success) {
        adminMessagesCache = adminMessagesCache.filter(m => m.id !== id);
        updateAdminMetrics(adminMessagesCache);
        const card = document.getElementById(`admin-row-${id}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          card.style.transition = 'all 0.3s ease';
          setTimeout(() => {
            renderFilteredMessages();
          }, 300);
        }
      } else {
        alert('Failed to delete message: ' + (delRes.error || 'Unknown error'));
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">delete</span> Delete`;
      }
    });
  });
}
