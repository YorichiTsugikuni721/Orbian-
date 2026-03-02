document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const ghostBtn = document.getElementById('ghostBtn');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const statusText = document.getElementById('statusText');
    const body = document.body;

    // --- State ---
    let isGhostMode = false;
    let currentTheme = 'theme-tech'; // tech, happy, angry, creative

    // --- Ghost Mode Logic ---
    ghostBtn.addEventListener('click', () => {
        isGhostMode = !isGhostMode;

        if (isGhostMode) {
            ghostBtn.classList.add('active');
            statusText.textContent = "Mode: Ghost (Incognito - Nothing Saved)";
            statusText.style.color = "#a3a3a3";
            // In a real app, clear UI or stop saving to LS here
        } else {
            ghostBtn.classList.remove('active');
            statusText.textContent = "Mode: Normal (Saving History)";
            statusText.style.color = "var(--text-secondary)";
        }
    });

    // --- Mood Analysis Logic ---
    function analyzeSentiment(text) {
        text = text.toLowerCase();

        // Simple keyword matching for demo
        const happyWords = ['good', 'great', 'love', 'active', 'happy', 'excited', 'thanks', 'cool', 'awesome', 'woo'];
        const angryWords = ['bad', 'hate', 'error', 'fail', 'stupid', 'bug', 'broken', 'angry', 'mad', 'frustrated'];
        const techWords = ['code', 'python', 'javascript', 'html', 'css', 'function', 'api', 'server', 'database'];
        const creativeWords = ['write', 'poem', 'story', 'idea', 'creative', 'design', 'art', 'music', 'dream'];

        if (happyWords.some(w => text.includes(w))) return 'theme-happy';
        if (angryWords.some(w => text.includes(w))) return 'theme-angry';
        if (creativeWords.some(w => text.includes(w))) return 'theme-creative';

        // Default to tech if no strong emotion or explicit tech words
        return 'theme-tech';
    }

    function updateTheme(newTheme) {
        if (currentTheme !== newTheme) {
            // Remove old theme
            body.classList.remove(currentTheme);
            // Add new theme
            body.classList.add(newTheme);
            currentTheme = newTheme;

            console.log(`Theme switched to: ${newTheme}`);
        }
    }

    // --- Chat Logic ---
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        // 1. Add User Message
        addMessage(text, 'user');
        messageInput.value = '';

        // 2. Analyze Mood
        const newTheme = analyzeSentiment(text);
        updateTheme(newTheme);

        // 3. Simulate AI Response (Delayed)
        setTimeout(() => {
            const response = `I noticed your message was ${newTheme.replace('theme-', '')}-themed. I've adjusted the UI accordingly! (Ghost Mode: ${isGhostMode ? 'ON' : 'OFF'})`;
            addMessage(response, 'system');
        }, 800);
    }

    function addMessage(text, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<div class="message-content">${text}</div>`;
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // --- Event Listeners ---
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Set initial theme
    body.classList.add(currentTheme);

    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('✅ Service Worker Registered!', reg);
                const status = document.createElement('div');
                status.style.cssText = 'position:fixed; bottom:10px; right:10px; background:green; color:white; padding:5px 10px; border-radius:5px; font-size:12px;';
                status.innerText = 'Service Worker Active (Offline Ready)';
                document.body.appendChild(status);
            })
            .catch((err) => console.error('❌ Service Worker Failed:', err));
    }
});
