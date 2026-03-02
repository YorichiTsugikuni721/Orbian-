// ============================================
// ORBIAN AI — SECRET GATE LOGIC
// ============================================

const FLASK_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://orbian.onrender.com'
    : 'https://orbian.onrender.com';

// TOAST
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

// SECRET LOGIN
document.getElementById('secretLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('secretEmail').value.trim();
    const password = document.getElementById('secretPassword').value;
    const loader = document.getElementById('gateLoader');
    const btn = document.getElementById('gateBtn');

    btn.querySelector('span').textContent = 'AUTHORIZING...';
    loader.classList.remove('hidden');
    btn.disabled = true;

    try {
        const res = await fetch(`${FLASK_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            // Only allow Master Developer email on this specific gate
            if (data.user.email === 'himanshuraj8028@gmail.com') {
                showToast('Welcome Creator. Access Granted.');
                localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));
                setTimeout(() => { window.location.href = '../app'; }, 1000);
            } else {
                showToast('Restricted: You are not the Creator.');
            }
        } else {
            showToast(data.message || 'Identity Verification Failed');
        }
    } catch (err) {
        showToast('System Offline: Backend unreachable');
    }

    btn.querySelector('span').textContent = 'UNLOCK CORE';
    loader.classList.add('hidden');
    btn.disabled = false;
});
