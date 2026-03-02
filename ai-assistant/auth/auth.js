// ============================================
// ORBIAN AI — AUTH LOGIC
// ============================================

// Dynamic URL — works on localhost AND local network (phone/tablet)
const FLASK_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001'
    : 'https://orbian.onrender.com';

const GOOGLE_CLIENT_ID = '553791966216-urnq8pi1hc2au0iol2t2dgqiauo2sl8u.apps.googleusercontent.com';

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const sideHeading = document.getElementById('sideHeading');

// --- PASSWORD VISIBILITY TOGGLE ---
window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('.eye-icon');

    if (input.type === 'password') {
        input.type = 'text';
        btn.style.color = '#000';
    } else {
        input.type = 'password';
        btn.style.color = '#999';
    }
}

// --- FORGOT PASSWORD MODAL ---
const forgotModal = document.getElementById('forgotModal');
const openForgotBtn = document.getElementById('openForgotBtn');
const closeForgotBtn = document.getElementById('closeForgotBtn');

openForgotBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.add('active');
});

closeForgotBtn?.addEventListener('click', () => {
    forgotModal.classList.remove('active');
    resetModal();
});

function resetModal() {
    document.getElementById('forgotStep1').classList.remove('hidden');
    document.getElementById('forgotStep2').classList.add('hidden');
    document.getElementById('forgotStep3').classList.add('hidden');
}

let resetEmail = '';

window.sendOTP = async function () {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) { showToast('Please enter your email'); return; }

    const btn = document.getElementById('sendOtpBtn');
    const loader = document.getElementById('sendOtpLoader');
    const spanText = btn?.querySelector('span');
    if (btn) btn.disabled = true;
    if (loader) loader.classList.remove('hidden');
    if (spanText) spanText.classList.add('hidden');

    resetEmail = email; // Store for next steps

    try {
        const res = await fetch(`${FLASK_URL}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.success) {
            showToast('OTP sent to your email!', 'success');
            document.getElementById('forgotStep1').classList.add('hidden');
            document.getElementById('forgotStep2').classList.remove('hidden');
        } else {
            showToast(data.message || 'Error sending OTP');
        }
    } catch (e) {
        showToast('Server error. Check Flask connection.');
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.classList.add('hidden');
        if (spanText) spanText.classList.remove('hidden');
    }
}

window.verifyOTP = async function () {
    const otp = document.getElementById('otpInput').value.trim();
    if (otp.length !== 6) { showToast('Please enter 6-digit OTP'); return; }

    const btn = document.getElementById('verifyOtpBtn');
    const loader = document.getElementById('verifyOtpLoader');
    const spanText = btn?.querySelector('span');
    if (btn) btn.disabled = true;
    if (loader) loader.classList.remove('hidden');
    if (spanText) spanText.classList.add('hidden');

    try {
        const res = await fetch(`${FLASK_URL}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, otp: otp })
        });
        const data = await res.json();

        if (data.success) {
            showToast('OTP Verified!', 'success');
            document.getElementById('forgotStep2').classList.add('hidden');
            document.getElementById('forgotStep3').classList.remove('hidden');
        } else {
            showToast(data.message || 'Invalid OTP');
        }
    } catch (e) {
        showToast('Server error during verification.');
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.classList.add('hidden');
        if (spanText) spanText.classList.remove('hidden');
    }
}

window.resetPassword = async function () {
    const pass = document.getElementById('newPassword').value;
    if (pass.length < 6) { showToast('Password must be at least 6 characters'); return; }

    const btn = document.getElementById('resetPwdBtn');
    const loader = document.getElementById('resetPwdLoader');
    const spanText = btn?.querySelector('span');
    if (btn) btn.disabled = true;
    if (loader) loader.classList.remove('hidden');
    if (spanText) spanText.classList.add('hidden');

    try {
        const res = await fetch(`${FLASK_URL}/api/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, new_password: pass })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Password Reset Successful!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast(data.message || 'Password reset failed');
        }
    } catch (e) {
        showToast('Server error during reset.');
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.classList.add('hidden');
        if (spanText) spanText.classList.remove('hidden');
    }
}

// --- SWITCHING (BOTTOM LINKS) ---
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');
const sideSubtext = document.getElementById('sideSubtext');

function showLogin() {
    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.classList.remove('signup-active');

    if (signupForm) signupForm.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');

    if (sideHeading) sideHeading.innerHTML = 'WELCOME<br>BACK!';
    if (sideSubtext) sideSubtext.textContent = 'Join us and experience the most advanced AI assistant in the world. Secure, fast, and intelligent.';

    const formTitle = document.querySelector('.form-title');
    if (formTitle) formTitle.textContent = 'Login';
}

function showSignup() {
    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.classList.add('signup-active');

    if (loginForm) loginForm.classList.add('hidden');
    if (signupForm) signupForm.classList.remove('hidden');

    if (sideHeading) sideHeading.innerHTML = 'CREATE<br>ACCOUNT!';
    if (sideSubtext) sideSubtext.textContent = 'Unlock the full potential of Orbian AI. Sign up now to start your futuristic journey.';

    const formTitle = document.querySelector('.form-title');
    if (formTitle) formTitle.textContent = 'Sign Up';
}

switchToSignup?.addEventListener('click', showSignup);
switchToLogin?.addEventListener('click', showLogin);

// --- OAUTH LOGIN ---
const X_CLIENT_ID = 'NyI5kFwIPuWngpb7ra4BSHg0g';

window.onload = async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Check for Twitter OAuth Callback
    const twitterCode = urlParams.get('code');
    const twitterState = urlParams.get('state');

    if (twitterCode && twitterState) {
        showToast('Syncing with X profile...', 'success');
        try {
            const res = await fetch(`${FLASK_URL}/api/oauth/twitter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: twitterCode, state: twitterState })
            });
            const data = await res.json();
            if (data.success) {
                showToast('X login successful!', 'success');
                localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));
                setTimeout(() => window.location.href = '../app', 1000);
            } else {
                showToast(data.message || 'X auth failed');
            }
        } catch (e) {
            showToast('X sync error');
        }
        return;
    }

    // Check for Orbian OAuth Code
    if (code) {
        showToast('Processing Orbian Auth Code...', 'success');
        try {
            const res = await fetch(`${FLASK_URL}/api/orbian/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: 'orbian_internal_platform',
                    client_secret: 'internal_platform_secret',
                    code: code
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Welcome back, Orbian User!', 'success');
                localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));
                setTimeout(() => window.location.href = '../app', 1000);
            }
        } catch (e) {
            showToast('Orbian Token Exchange Failed');
        }
    }

    // Handle signup hash toggle or path
    if (window.location.hash === '#signup' || window.location.pathname.includes('signup')) {
        showSignup();
    } else {
        showLogin();
    }

    // Optimized Google Init with Invisible Overlay
    function initGoogle() {
        if (typeof google !== 'undefined') {
            console.log("Initializing Google Auth with Client ID:", GOOGLE_CLIENT_ID);
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: window.handleCredentialResponse,
                ux_mode: 'popup',
                auto_select: false,
                itp_support: true
            });

            // Helper to overlay official button on our custom one invisible for a static look
            const setupOverlay = (id) => {
                const container = document.getElementById(id);
                if (container) {
                    console.log(`Setting up Google Overlay for: ${id}`);
                    
                    // We render a generic one, but hide it
                    // Small delay ensures parent width is calculated after render
                    setTimeout(() => {
                        const targetWidth = container.offsetWidth || 350;
                        console.log(`Rendering Google Overlay with width: ${targetWidth}`);
                        
                        google.accounts.id.renderButton(container, {
                            type: 'standard',
                            shape: 'pill',
                            theme: 'outline',
                            size: 'large',
                            width: targetWidth,
                            text: 'continue_with',
                            logo_alignment: 'left'
                        });

                        const observer = new MutationObserver(() => {
                            const iframe = container.querySelector('iframe');
                            if (iframe) {
                                console.log(`Iframe detected for ${id}, making invisible overlay...`);
                                iframe.style.setProperty('position', 'absolute', 'important');
                                iframe.style.setProperty('top', '0', 'important');
                                iframe.style.setProperty('left', '0', 'important');
                                iframe.style.setProperty('width', '100%', 'important');
                                iframe.style.setProperty('height', '100%', 'important');
                                iframe.style.setProperty('min-width', '100%', 'important');
                                iframe.style.setProperty('max-width', '100%', 'important');
                                iframe.style.setProperty('opacity', '0', 'important'); // Completely invisible
                                iframe.style.setProperty('cursor', 'pointer', 'important');
                                iframe.style.setProperty('z-index', '20', 'important');
                                observer.disconnect();
                            }
                        });
                        observer.observe(container, { childList: true });
                    }, 100);
                }
            };

            setupOverlay('googleBtn');
            setupOverlay('googleSignupBtn');
            setupOverlay('googleBtnWrapper'); // For mobile
            setupOverlay('googleSignupBtnWrapper'); // For mobile signup

            console.log("Google library initialized with overlays.");
        } else {
            console.warn("Google library not found, retrying...");
            setTimeout(initGoogle, 500);
        }
    }
    // Call immediately and also on load
    initGoogle();
};

window.handleCredentialResponse = async function (response) {
    console.log("🚀 Google Credential Received:", response);
    window.googlePrompting = false;
    
    // Show loading state
    const loader = document.getElementById('loginLoader') || document.getElementById('signupLoader');
    if (loader) loader.classList.remove('hidden');
    
    showToast('Verifying with Google... Please wait', 'success');

    console.log("🔗 Syncing with Backend:", `${FLASK_URL}/api/oauth/google`);

    try {
        const res = await fetch(`${FLASK_URL}/api/oauth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        
        console.log("📥 Backend Response Status:", res.status);
        const data = await res.json();
        console.log("📦 Backend Data:", data);

        if (data.success) {
            showToast('Login successful! Redirecting...', 'success');
            localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));
            setTimeout(() => window.location.href = '../app', 1000);
        } else {
            if (loader) loader.classList.add('hidden');
            console.error("❌ Sync Failed:", data.message);
            showToast(data.message || 'Google sync failed');
        }
    } catch (e) {
        if (loader) loader.classList.add('hidden');
        console.error("🚨 Fetch Error:", e);
        showToast('Connection error. Check your internet.');
    }
}

window.oauthLogin = async function (provider) {
    if (provider === 'google') {
        if (typeof google === 'undefined') {
            showToast('Google Library not loaded.');
            return;
        }

        // Clear any previous/outstanding requests to avoid "Only one navigator.credentials.get" error
        google.accounts.id.cancel();

        console.log("Forcing Google Prompt (Repeatable Mode)...");

        google.accounts.id.prompt((notification) => {
            console.log("Prompt Status:", notification.getNotDisplayedReason());
            if (notification.isNotDisplayed() || notification.isSkippedMomentarily() || notification.isDismissedMomentarily()) {
                window.googlePrompting = false;
            }
        });

        // Safety timeout to reset the lock after 10 seconds if no callback received
        setTimeout(() => { window.googlePrompting = false; }, 10000);
        return;
    }

    if (provider === 'twitter') {
        showToast('Connecting to X (Twitter)...', 'success');
        try {
            const res = await fetch(`${FLASK_URL}/api/oauth/twitter/authorize`);
            const data = await res.json();
            if (data.success) {
                window.location.href = data.url;
            } else {
                showToast('Failed to start X authorization');
            }
        } catch (e) {
            showToast('X connection error');
        }
        return;
    }

    if (provider === 'orbian') {
        showToast('Redirecting to Orbian Secure Authorization...', 'success');
        setTimeout(() => {
            // For own app, we can use a reserved client_id
            window.location.href = 'authorize?client_id=orbian_internal_platform';
        }, 1000);
        return;
    }

    showToast(`Connecting to ${provider}... simulating flow.`, 'success');

    setTimeout(async () => {
        try {
            const mockToken = "simulated_token_" + Math.random().toString(36).substring(7);
            const endpoint = `/api/oauth/${provider}`;
            const body = { access_token: mockToken };

            const res = await fetch(`${FLASK_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                showToast(`${provider} login successful!`, 'success');
                localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));
                setTimeout(() => window.location.href = '../app', 1000);
            } else {
                showToast(data.message || `${provider} login failed`);
            }
        } catch (e) {
            showToast(`Connection to ${provider} failed.`);
        }
    }, 1000);
}

// --- TOAST ---
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#10b981' : '#111';
    toast.className = 'toast show';
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// --- API CALL ---
async function handleAuth(event, endpoint, buttonId, loaderId) {
    event.preventDefault();
    const btn = document.getElementById(buttonId);
    const loader = document.getElementById(loaderId);
    const spanText = btn?.querySelector('span');

    if (btn) btn.disabled = true;
    if (loader) loader.classList.remove('hidden');
    if (spanText) spanText.classList.add('hidden');

    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    // Fallback: Ensure fields are captured if FormData is empty or missing keys
    if (endpoint === '/api/signup') {
        body.username = body.username || document.getElementById('signupUsername')?.value || '';
        body.email = body.email || document.getElementById('signupEmail')?.value || '';
        body.password = body.password || document.getElementById('signupPassword')?.value || '';
    } else if (endpoint === '/api/login') {
        body.email = body.email || document.getElementById('loginEmail')?.value || '';
        body.password = body.password || document.getElementById('loginPassword')?.value || '';
    }

    console.log("🚀 Sending Auth Request to:", endpoint, "Body (Final):", body);

    try {
        const res = await fetch(`${FLASK_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message || 'Success! Redirecting...', 'success');
            // Store current user
            localStorage.setItem('ai_assistant_user', JSON.stringify(data.user));

            // NEW: Multi-account management
            let accounts = JSON.parse(localStorage.getItem('orbian_accounts')) || [];
            // Remove if already exists with same email to avoid duplicates
            accounts = accounts.filter(acc => acc.email !== data.user.email);
            accounts.unshift(data.user); // Add to top
            localStorage.setItem('orbian_accounts', JSON.stringify(accounts));

            // Check for redirect URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');

            setTimeout(() => {
                if (redirect) {
                    window.location.href = redirect;
                } else {
                    window.location.href = '../app';
                }
            }, 1000);
        } else {
            console.error("Auth Error details:", data);
            showToast(data.message || 'Error occurred');
        }
    } catch (e) {
        console.error("Auth Connection Error:", e);
        showToast('Server error. check Flask backend.');
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.classList.add('hidden');
        if (spanText) spanText.classList.remove('hidden');
    }
}

if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/login', 'loginBtn', 'loginLoader'));
if (signupForm) signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup', 'signupBtn', 'signupLoader'));

// Check Auth
(function checkAuth() {
    const user = localStorage.getItem('ai_assistant_user');
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');

    // If already logged in, only redirect to app if we DON'T have a pending redirect
    if (user && !redirect) {
        window.location.href = '../app';
    } else if (user && redirect) {
        // If logged in and have redirect, go there immediately
        window.location.href = redirect;
    }
})();

// --- EMAIL SUGGESTIONS LOGIC ---
const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'hotmail.com'];

function setupEmailSuggestions(inputId, suggestionId) {
    const input = document.getElementById(inputId);
    const suggestionBox = document.getElementById(suggestionId);

    if (!input || !suggestionBox) return;

    input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!val.includes('@')) {
            suggestionBox.classList.add('hidden');
            return;
        }

        const parts = val.split('@');
        const prefix = parts[0];
        const domainPart = parts[1] || '';

        const filtered = domains.filter(d => d.startsWith(domainPart));

        if (filtered.length > 0) {
            suggestionBox.innerHTML = filtered.map(d => `<div class="suggestion-item">${prefix}@${d}</div>`).join('');
            suggestionBox.classList.remove('hidden');
        } else {
            suggestionBox.classList.add('hidden');
        }
    });

    suggestionBox.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            input.value = e.target.textContent;
            suggestionBox.classList.add('hidden');
        }
    });

    // Hide if click outside
    document.addEventListener('click', (e) => {
        if (e.target !== input && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.add('hidden');
        }
    });
}

setupEmailSuggestions('loginEmail', 'loginEmailSuggestions');
setupEmailSuggestions('signupEmail', 'signupEmailSuggestions');

// Toggle Password Visibility
window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
};
