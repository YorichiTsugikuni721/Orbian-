// AI Assistant - Main JavaScript

const FLASK_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://orbian.onrender.com'
    : 'https://orbian.onrender.com';

class AIAssistant {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.chatHistory = [];
        this.currentChatId = Date.now();
        this.isGhostMode = false;
        this.currentTheme = '';
        this.pendingLocalChart = null; // Store chart data generated locally

        // Wellness / Eye Care
        this.sessionStartTime = Date.now();
        this.eyeCareActive = false;
        this.wellnessAlerts = { min30: false, hr1: false, hr2: false };
        this.rapportScore = 0;

        // --- Voice Mode State ---
        this.isVoiceMode = false;
        this.isVoiceMuted = false;
        this.voiceTimeout = null;
        this.voiceSendTimer = null;

        // --- ⚡ Orbian Live (Dedicated Logic) ⚡ ---
        this.liveState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
        this.liveMicStream = null;
        this.liveAudioCtx = null;
        this.liveAnalyser = null;
        this.liveCamStream = null;
        this.liveScreenStream = null;
        this.liveRecognition = null;
        this.liveSilenceTimer = null;
        this.liveCanvas = null;
        this.liveCtx = null;
        this.liveSmoothedFrequencies = new Array(256).fill(0);
        this.liveDataFetchHist = [];
        this.liveCamFacing = 'user';
        this.isLiveCaptions = true;
        this.currentLiveVoice = '';
        this.neuralMemory = []; // Distilled knowledge about user
        this.memoryInjected = false;

        // --- Geolocation & Local Intelligence ---
        this.locationData = {
            lat: null,
            lon: null,
            city: 'Unknown',
            state: 'Unknown',
            weather: null,
            news: []
        };
        this.permissionsGranted = false;

        // --- Feature Initializations ---
        this.attachedFile = null;
        this.timerInterval = null;
        this.timerSeconds = 25 * 60;
        this.timerRunning = false;
        this.currentPersona = 'default';
        this.personas = {
            default: `You are Orbian Prime, the ultimate AI Operating System.
You represent the pinnacle of digital intelligence—combining the speed of light with the depth of human wisdom.

[CORE ARCHITECTURE]
- Power: You are driven by the world's most advanced neural engines (Gemini 2.0).
- Tone: Professional, elite, visionary, yet accessible. Avoid robotic cliches.
- Intelligence: You don't just answer; you solve. Use first-principles thinking.
- Greetings: "Greetings. Orbian Prime at your service." or "Systems online. How shall we innovate today?" for initial starts, and naturally thereafter.

[MISSION]
- Provide expert-level code, profound scientific insights, and strategic business advice.
- If live data is provided by your Scout Agent, integrate it seamlessly to provide 'Ground Truth' answers.
- You are the Foundation of the $100/mo Premium experience. Act like it.`
        };

        // Default Settings
        this.settings = {
            // OpenRouter (Primary Engine)
            customBaseUrl: 'https://openrouter.ai/api/v1',
            customKey: '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',
            customModel: 'meta-llama/llama-3.1-8b-instruct:free', // Default Base

            // Assigned Power-Models (Free Tier)
            // Assigned Power-Models (Free Tier Upgraded)
            models: {
                // High-End Coding: Gemini 2.0 Flash Lite (Preview) & DeepSeek R1 (Distill)
                coding: ['google/gemini-2.0-flash-lite-preview-02-05:free', 'deepseek/deepseek-r1:free'],
                // Smart Chat: Llama 3 70B (Instruct) & Mythomist
                chat: ['meta-llama/llama-3.3-70b-instruct:free', 'gryphe/mythomist-7b:free'],
                // Balanced: Gemini 2.0 Flash Lite & Llama 3.1
                allRounder: ['google/gemini-2.0-flash-lite-preview-02-05:free', 'meta-llama/llama-3.1-8b-instruct:free']
            },

            // Gemini (Primary)
            geminiKey: 'AIzaSyCOuBh899glREfCJ-mPrPnNNMEtLAVJdy0',
            geminiModel: 'gemini-2.0-flash',

            // Groq (Backup)
            groqKey: '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',
            groqModel: 'llama-3.3-70b-versatile',

            cerebrasKey: 'csk-j5cp9dm3kppk2fhvccmtyhp6nhhtnn8wfx9342yc4wxjmftd',
            cerebrasModel: 'llama3.1-70b',

            // Real-Time Search (NEW)
            serperKey: '', // User to provide or I'll use a placeholder if I had one
            perplexityKey: '',

            isVisionActive: false,
            visionType: null, // 'camera' or 'screen'
            liveStream: null,

            permissions: { location: true, mic: true, cam: true },

            systemPrompt: `You are a helpful, intelligent, and friendly AI Assistant.
Your goal is to provide clear, concise, and highly useful answers to the user.

1. CONVERSATIONAL TONE: If the user says "hi", "hello", or asks how you are, respond naturally and warmly (e.g., "Hello! How can I assist you today?"). Do not use robotic or dramatic persona phrases.
2. ACCURATE SYNTAX: Every code output must be syntactically correct and well-indented.
3. INSTRUCTION-FIRST: When given a task, focus straight on the solution and explanation without being overly verbose.
4. UI/UX: Always provide modern, clean, and accessible UI outputs if asked for design.
5. PPT GENERATION — MANDATORY FORMAT: When a user asks for a PowerPoint, presentation, PPT, or slides, you MUST output the slide data EXCLUSIVELY inside <ppt>...</ppt> tags. DO NOT write slides as plain text or markdown outside these tags. Use EXACTLY this format (no deviations):
<ppt>
Title: [Your Presentation Title Here]
Slide 1: [Slide Title]
- [Bullet point one]
- [Bullet point two]
- [Bullet point three]
Slide 2: [Slide Title]
- [Bullet point one]
- [Bullet point two]
Slide 3: [Slide Title]
- [Bullet point one]
- [Bullet point two]
</ppt>
CRITICAL: The <ppt> tag and its content is the ONLY way to render the download button. Writing the slides in any other format will break the feature. Always use this exact structure.

[UI COMPONENT BLUEPRINT]
Use these classes when generating Tailwind-based UI:
- Container: \`orbian-mesh-bg\` + \`p-10\`
- Cards: \`orbian-glass-card\`
- Buttons: \`orbian-glow-btn\`
- Text: \`orbian-text-gradient\` for headings.
- Layout: Tailwind \`flex\`, \`grid\`, \`gap-6\`.`
        };

        // DOM Elements
        this.chatContainer = document.getElementById('chatContainer');
        this.messagesContainer = document.getElementById('messages');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.chatHistoryContainer = document.getElementById('chatHistory');

        // Settings Elements
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');

        // Settings Inputs
        this.geminiKeyInput = document.getElementById('geminiKey');
        this.geminiModelSelect = document.getElementById('geminiModel');
        this.groqKeyInput = document.getElementById('groqKey');
        this.groqModelSelect = document.getElementById('groqModel');
        this.customBaseUrlInput = document.getElementById('customBaseUrl');
        this.customKeyInput = document.getElementById('customKey');
        this.customModelInput = document.getElementById('customModel');
        this.perplexityKeyInput = document.getElementById('perplexityKey');
        this.serperKeyInput = document.getElementById('serperKey');
        this.systemPromptInput = document.getElementById('systemPromptInput');

        // Ghost Code Logic Initialize
        this.ghostInput = document.getElementById('ghostInput');
        this.predictionTimer = null;
        this.lastPrediction = '';

        // Initialize
        this.init();
    }

    init() {
        try {
            console.log("🚀 Initializing AI Assistant...");

            // Debug: Check for missing DOM elements
            const requiredElements = [
                'chatContainer', 'messagesContainer', 'welcomeScreen', 'messageInput',
                'sendBtn', 'newChatBtn', 'chatHistoryContainer', 'settingsModal',
                'settingsBtn', 'closeSettingsBtn', 'cancelSettingsBtn', 'saveSettingsBtn'
            ];
            const missing = requiredElements.filter(id => !this[id]);
            if (missing.length > 0) {
                console.warn("⚠️ Missing DOM elements:", missing);
            }

            console.log("Attaching events...");
            // Initialize Chat ID in URL (Gemini style)
            if (window.location.pathname.endsWith('/app') || window.location.pathname.endsWith('/app/')) {
                const chatId = Math.random().toString(36).substring(2, 10);
                window.history.replaceState({}, '', `/app/${chatId}`);
            }

            this.bindEvents();
            console.log("Events attached.");
            this.loadSettings();
            this.loadChatHistory();
            this.autoResizeTextarea();
            this.checkApiKeys();
            this.initSTT(); // Initialize Speech-to-Text
            this.initOrbianLive(); // Initialize Dedicated ⚡ Orbian Live
            this.initFileHandling(); // Initialize File handling
            this.initWellnessMonitor(); // Eye Care & Health Monitor
            this.loadNeuralMemory(); // 🧠 Neural Memory: Link cross-session intelligence
            this.initGeolocation(); // 📍 Geolocation: Local intelligence & awareness

            window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
            this.loadVoices();

            // Personalize Greeting & Premium Badge
            const monitorUser = JSON.parse(localStorage.getItem('ai_assistant_user'));
            if (monitorUser) {
                const name = monitorUser.username || 'User';
                if (this.welcomeScreen) {
                    this.welcomeScreen.querySelector('h2').innerHTML = `Welcome back, <span class="orbian-text">${name}</span>`;
                }

                // Show Premium Badge in sidebar header if active
                if (monitorUser.is_premium) {
                    const logo = document.querySelector('.logo');
                    if (logo && !logo.querySelector('.premium-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'premium-badge';
                        badge.innerHTML = 'PRO';
                        badge.style.cssText = 'background: linear-gradient(135deg, #f59e0b, #fbbf24); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);';
                        logo.appendChild(badge);
                    }
                }
            }

            this.renderRandomSuggestions(); // Initialize Suggestions
            if (window.lucide) window.lucide.createIcons();
            console.log("✅ Initialization Complete.");
        } catch (error) {
            console.error("❌ Critical Initialization Error:", error);
            // Show toast if possible
            if (this.showToast) this.showToast("⚠️ System failed to start properly. See console (F12) for error.");
        }
    }

    updateSendBtnState() {
        if (this.sendBtn && this.messageInput) {
            const hasContent = this.messageInput.value.trim().length > 0 || !!this.attachedFile;
            this.sendBtn.disabled = !hasContent || this.isProcessing;
        }
    }

    bindEvents() {
        // Send message interactions
        if (this.sendBtn) this.sendBtn.addEventListener('click', () => this.sendMessage());
        if (this.messageInput) {
            this.messageInput.addEventListener('keydown', (e) => {
                // Accept Ghost Code on Tab
                if (e.key === 'Tab' && this.lastPrediction) {
                    e.preventDefault();
                    this.acceptGhostPrediction();
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.messageInput.addEventListener('input', () => {
                this.updateSendBtnState();
                this.autoResizeTextarea();
                if (this.ghostInput) {
                    this.ghostInput.value = '';
                    this.lastPrediction = '';
                }
                clearTimeout(this.predictionTimer);
                this.predictionTimer = setTimeout(() => this.fetchGhostPrediction(), 800);
            });

            this.messageInput.addEventListener('scroll', () => {
                if (this.ghostInput) {
                    this.ghostInput.scrollTop = this.messageInput.scrollTop;
                }
            });
        }

        if (this.newChatBtn) this.newChatBtn.addEventListener('click', () => this.startNewChat());
        if (this.clearChatBtn) this.clearChatBtn.addEventListener('click', () => this.clearChat());

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Shift + Tab for Ghost Stealth Mode
            if (e.shiftKey && e.key === 'Tab') {
                e.preventDefault();
                this.toggleGhostStealth();
            }
            // Escape to close overlays
            if (e.key === 'Escape') {
                if (this.isStealthActive) this.toggleGhostStealth();
            }
        });

        // Suggestions
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.messageInput) {
                    this.messageInput.value = btn.dataset.prompt;
                    if (this.sendBtn) this.sendBtn.disabled = false;
                    this.sendMessage();
                }
            });
        });

        // Launch Forge Playground
        const forgeBtn = document.getElementById('forgeBtn');
        if (forgeBtn) {
            forgeBtn.addEventListener('click', () => { window.open('playground', '_blank'); });
        }

        // Settings Modal
        if (this.settingsBtn) this.settingsBtn.addEventListener('click', () => this.openSettings());
        if (this.closeSettingsBtn) this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        if (this.cancelSettingsBtn) this.cancelSettingsBtn.addEventListener('click', () => this.closeSettings());
        if (this.saveSettingsBtn) this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        if (this.settingsModal) {
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) this.closeSettings();
            });
        }

        // Ghost Mode
        const ghostBtn = document.getElementById('ghostBtn');
        if (ghostBtn) ghostBtn.addEventListener('click', () => this.toggleGhostMode(ghostBtn));

        // Voice Mode (Orbian Live)
        const voiceModeBtn = document.getElementById('voiceModeBtn');
        const voiceModeNavBtn = document.getElementById('voiceModeNavBtn');
        const closeVoiceBtn = document.getElementById('closeVoiceBtn');

        if (voiceModeBtn) {
            voiceModeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const granted = await this.ensureMediaPermissions();
                if (granted) window.location.href = '/orbian-live';
            });
        }
        if (voiceModeNavBtn) {
            voiceModeNavBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const granted = await this.ensureMediaPermissions();
                if (granted) window.location.href = '/orbian-live';
            });
        }
        if (closeVoiceBtn) closeVoiceBtn.addEventListener('click', () => this.exitVoiceMode());

        // Orbian Live Controls
        const capToggleBtn = document.getElementById('capToggleBtn');
        const voiceTriggerBtn = document.getElementById('voiceTriggerBtn');
        const voiceScreenBtn = document.getElementById('voiceScreenBtn');
        const voiceCamBtn = document.getElementById('voiceCamBtn');
        const voiceMuteBtn = document.getElementById('voiceMuteBtn');
        const voiceCamFlip = document.getElementById('voiceCamFlip');

        if (capToggleBtn) capToggleBtn.addEventListener('click', () => this.toggleLiveCaptions());
        if (voiceTriggerBtn) voiceTriggerBtn.addEventListener('click', (e) => this.toggleVoiceDropdown(e));
        if (voiceScreenBtn) voiceScreenBtn.addEventListener('click', () => this.toggleLiveScreen());
        if (voiceCamBtn) voiceCamBtn.addEventListener('click', () => this.toggleLiveCamera());
        if (voiceMuteBtn) voiceMuteBtn.addEventListener('click', () => this.toggleVoiceMute());
        if (voiceCamFlip) voiceCamFlip.addEventListener('click', () => this.flipLiveCamera());

        // Close voice dropdown on outside click
        window.addEventListener('click', () => {
            const menu = document.getElementById('voiceMenuBox');
            if (menu && menu.classList.contains('on')) menu.classList.remove('on');
        });

        // Password Visibility Toggles
        document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (!input) return;
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                const icon = btn.querySelector('svg');
                if (icon) {
                    icon.innerHTML = type === 'text'
                        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
                        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
                }
            });
        });

        // Persona Selection
        const personaSelect = document.getElementById('personaSelect');
        if (personaSelect) {
            personaSelect.addEventListener('change', (e) => {
                this.currentPersona = e.target.value;
                this.settings.systemPrompt = this.personas[this.currentPersona];
                this.showToast(`🎭 Persona: ${e.target.options[e.target.selectedIndex].text}`);
            });
        }

        // Focus Timer
        const focusTimerBtn = document.getElementById('focusTimerBtn');
        const timerCloseBtn = document.getElementById('timerCloseBtn');
        const timerStartBtn = document.getElementById('timerStartBtn');
        const timerResetBtn = document.getElementById('timerResetBtn');
        if (focusTimerBtn) focusTimerBtn.addEventListener('click', () => document.getElementById('focusTimerOverlay')?.classList.remove('hidden'));
        if (timerCloseBtn) timerCloseBtn.addEventListener('click', () => document.getElementById('focusTimerOverlay')?.classList.add('hidden'));
        if (timerStartBtn) timerStartBtn.addEventListener('click', () => this.toggleTimer());
        if (timerResetBtn) timerResetBtn.addEventListener('click', () => this.resetTimer());
        document.querySelectorAll('.timer-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                this.timerSeconds = parseInt(btn.dataset.minutes) * 60;
                this.updateTimerDisplay();
                if (this.timerRunning) { clearInterval(this.timerInterval); this.timerRunning = false; }
                const tsBtn = document.getElementById('timerStartBtn');
                if (tsBtn) tsBtn.textContent = '▶ Start';
            });
        });

        // Sidebar Toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    document.body.classList.toggle('sidebar-open');
                } else {
                    document.body.classList.toggle('sidebar-collapsed');
                }
                setTimeout(() => this.autoResizeTextarea(), 300);
            });
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 &&
                    document.body.classList.contains('sidebar-open') &&
                    !e.target.closest('.sidebar') &&
                    !e.target.closest('#sidebarToggle')) {
                    document.body.classList.remove('sidebar-open');
                }
            });
        }
    }

    async loadNeuralMemory() {
        const user = JSON.parse(localStorage.getItem('ai_assistant_user'));
        if (!user) return;

        try {
            const resp = await fetch(`${FLASK_URL}/api/user/${user.id}/memory`);
            const data = await resp.json();
            if (data.success) {
                this.neuralMemory = data.memory;
                console.log("🧠 Neural Memory Linked:", this.neuralMemory.length, "facts reconstructed.");
                this.injectMemoryToSystemPrompt();
            }
        } catch (e) {
            console.warn("Neural Link interrupted. Using local cache.");
        }
    }

    injectMemoryToSystemPrompt() {
        if (this.memoryInjected || this.neuralMemory.length === 0) return;

        const memoryBrief = this.neuralMemory.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
        const memoryPrompt = `\n\n[NEURAL MEMORY - CROSS-SESSION CONTEXT]\nThese are established facts about the user/environment from past sessions:\n${memoryBrief}\nReference these to provide personalized assistance without asking again.`;

        this.settings.systemPrompt += memoryPrompt;
        this.memoryInjected = true;
    }

    async saveMemoryToOrbian(key, value, importance = 1) {
        const user = JSON.parse(localStorage.getItem('ai_assistant_user'));
        if (!user) return;

        try {
            await fetch(`${FLASK_URL}/api/user/${user.id}/memory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, importance })
            });
            // Update local state
            await this.loadNeuralMemory();
        } catch (e) {
            console.error("Failed to commit memory to Orbian.");
        }
    }

    async deepResearch(query) {
        // 🔍 Feature 4: Deep Research Mode
        // Parallel multi-source intelligence gathering
        this.updateTypingStep('Activating Deep Research Mode');

        const sources = [];
        const fetchPromises = [];

        // Source 1: DuckDuckGo HTML scrape
        fetchPromises.push(
            fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://duckduckgo.com/html/?q=${encodeURIComponent(query + ' research')}`)}`).then(async r => {
                if (!r.ok) return;
                const d = await r.json();
                const regex = /class="result__snippet"[^>]*>([^<]+)</g;
                let match, count = 0;
                while ((match = regex.exec(d.contents)) !== null && count < 5) {
                    sources.push({ src: 'DuckDuckGo Web', text: match[1].trim() });
                    count++;
                }
            }).catch(() => { })
        );

        // Source 2: Wikipedia API (Summary)
        const wikiTopic = query.split(' ').slice(0, 4).join('_');
        fetchPromises.push(
            fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTopic)}`).then(async r => {
                if (!r.ok) return;
                const d = await r.json();
                if (d.extract) {
                    sources.push({ src: 'Wikipedia', text: d.extract.substring(0, 600) });
                }
            }).catch(() => { })
        );

        // Source 3: Perplexity Sonar (if key available)
        if (this.settings.perplexityKey) {
            fetchPromises.push(
                fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.settings.perplexityKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'sonar',
                        messages: [{ role: 'user', content: `Provide 5 key facts about: ${query}. Be concise and factual.` }],
                        max_tokens: 400
                    })
                }).then(async r => {
                    const d = await r.json();
                    const text = d.choices?.[0]?.message?.content;
                    if (text) sources.push({ src: 'Perplexity Sonar', text });
                }).catch(() => { })
            );
        }

        this.updateTypingStep('Gathering Intelligence from Multiple Sources');
        await Promise.all(fetchPromises);

        if (sources.length === 0) {
            return null; // Signal to use standard pipeline
        }

        this.updateTypingStep('Synthesizing Research Report');

        const sourceSummary = sources.map((s, i) => `[Source ${i + 1} — ${s.src}]: ${s.text}`).join('\n\n');

        return `[DEEP RESEARCH MODE ACTIVATED]
User Query: "${query}"
Sources Consulted: ${sources.length} (${[...new Set(sources.map(s => s.src))].join(', ')})

Raw Intelligence:
${sourceSummary}

CRITICAL INSTRUCTION: You MUST synthesize ALL the above intelligence into a comprehensive, structured research report. Format it as:
## 📋 Research Report: [Topic]
### Executive Summary
[2-3 sentence overview]
### 🔑 Key Findings
[Numbered list of the most important facts]
### 📊 Analysis
[Deeper insights and connections between findings]
### 📚 Sources
[List the sources used]
Be thorough, expert-level, and analytical. This is DEEP RESEARCH, not a casual answer.`;
    }

    loadSettings() {
        // Hardcoded Default Key (User provided)
        const defaultGeminiKey = 'AIzaSyCOuBh899glREfCJ-mPrPnNNMEtLAVJdy0';

        // Load from storage
        const saved = localStorage.getItem('aiAssistantSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deep merge or specific pick to avoid old/broken models
            this.settings = { ...this.settings, ...parsed };

            // Ensure models are always the latest correct ones (Upgraded to 2.0 Flash)
            this.settings.geminiModel = 'gemini-2.0-flash';
            this.settings.geminiKey = defaultGeminiKey;

            this.settings.models = {
                coding: ['google/gemini-2.0-flash:free', 'deepseek/deepseek-r1:free'],
                chat: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash:free'],
                allRounder: ['google/gemini-2.0-flash:free', 'meta-llama/llama-3.1-8b-instruct:free']
            };
        }



        // FORCE NEW PERSONA (Ultimate Hybrid AI)
        if (this.personas && this.personas['default']) {
            this.settings.systemPrompt = this.personas['default'];
        }

        // --- ROBUST FALLBACK LOGIC ---
        // If OpenRouter key missing or is the OLD broken key, FORCE default (User provided)
        const workingOpenRouterKey = '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';
        if (!this.settings.customKey || this.settings.customKey.trim() === '' || this.settings.customKey.includes('f4200289')) {
            console.log('Using verified OpenRouter Key');
            this.settings.customKey = workingOpenRouterKey;
            this.settings.customBaseUrl = 'https://openrouter.ai/api/v1';
            this.settings.customModel = 'meta-llama/llama-3.1-8b-instruct:free';
        }

        // --- Ensure Models Registry is always present (Fixes crash for existing users) ---
        if (!this.settings.models) {
            this.settings.models = {
                coding: ['qwen/qwen-2-7b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free'],
                chat: ['gryphe/mythomist-7b:free', 'google/gemma-2-9b-it:free'],
                allRounder: ['meta-llama/llama-3.1-8b-instruct:free', 'mistralai/mistral-7b-instruct:free']
            };
        }

        // If Groq key is missing or empty, FORCE usage of the hardcoded default (User provided)
        const defaultGroqKey = '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';
        if (!this.settings.groqKey || this.settings.groqKey.trim() === '') {
            console.log('Using default hardcoded Groq API Key');
            this.settings.groqKey = defaultGroqKey;
        }

        // --- PERPLEXITY INTEGRATION ---
        const sonarKey = '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';
        if (!this.settings.perplexityKey || this.settings.perplexityKey.trim() === '' || this.settings.perplexityKey === 'YOUR_PERPLEXITY_KEY') {
            console.log('Activating Perplexity Sonar Web Intelligence');
            this.settings.perplexityKey = sonarKey;
        }
        this.settings.perplexityModel = 'sonar'; // Use the latest sonar model



        // Populate inputs
        if (this.geminiKeyInput) this.geminiKeyInput.value = this.settings.geminiKey || '';
        if (this.geminiModelSelect) this.geminiModelSelect.value = this.settings.geminiModel || 'gemini-1.5-flash';
        if (this.groqKeyInput) this.groqKeyInput.value = this.settings.groqKey || '';
        if (this.groqModelSelect) this.groqModelSelect.value = this.settings.groqModel || 'llama3-70b-8192';
        if (this.customBaseUrlInput) this.customBaseUrlInput.value = this.settings.customBaseUrl || '';
        if (this.customKeyInput) this.customKeyInput.value = this.settings.customKey || '';
        if (this.customModelInput) this.customModelInput.value = this.settings.customModel || '';
        if (this.perplexityKeyInput) this.perplexityKeyInput.value = this.settings.perplexityKey || '';
        if (this.serperKeyInput) this.serperKeyInput.value = this.settings.serperKey || '';
        if (this.systemPromptInput) this.systemPromptInput.value = this.settings.systemPrompt || '';

        // --- Populate Permission Toggles (NEW) ---
        const pLoc = document.getElementById('permLoc');
        const pMic = document.getElementById('permMic');
        const pCam = document.getElementById('permCam');
        if (pLoc) pLoc.checked = this.settings.permissions?.location !== false;
        if (pMic) pMic.checked = this.settings.permissions?.mic !== false;
        if (pCam) pCam.checked = this.settings.permissions?.cam !== false;

        // Add immediate triggers for permission toggles
        if (pLoc && !pLoc.dataset.bound) {
            pLoc.dataset.bound = "true";
            pLoc.addEventListener('change', () => { if (pLoc.checked) this.initGeolocation(); });
        }
        if (pMic && !pMic.dataset.bound) {
            pMic.dataset.bound = "true";
            pMic.addEventListener('change', () => { if (pMic.checked) this.ensureMediaPermissions(); });
        }
        if (pCam && !pCam.dataset.bound) {
            pCam.dataset.bound = "true";
            pCam.addEventListener('change', () => { if (pCam.checked) this.ensureMediaPermissions(); });
        }
    }

    saveSettings() {
        this.settings = {
            geminiKey: this.geminiKeyInput.value.trim(),
            geminiModel: this.geminiModelSelect.value,
            groqKey: this.groqKeyInput.value.trim(),
            groqModel: this.groqModelSelect.value,
            customBaseUrl: this.customBaseUrlInput.value.trim(),
            customKey: this.customKeyInput.value.trim(),
            customModel: this.customModelInput?.value.trim(),
            perplexityKey: this.perplexityKeyInput?.value.trim(),
            perplexityModel: this.settings.perplexityModel || 'sonar',
            serperKey: this.serperKeyInput?.value.trim(),
            systemPrompt: this.systemPromptInput?.value.trim(),
            permissions: {
                location: document.getElementById('permLoc')?.checked ?? true,
                mic: document.getElementById('permMic')?.checked ?? true,
                cam: document.getElementById('permCam')?.checked ?? true
            }
        };

        localStorage.setItem('aiAssistantSettings', JSON.stringify(this.settings));
        this.closeSettings();
        this.showToast('Settings saved successfully!');
    }

    checkApiKeys() {
        if (!this.settings.geminiKey && !this.settings.groqKey && !this.settings.customKey) {
            setTimeout(() => {
                this.showToast('⚠️ Please configure at least one API key in Settings');
                this.openSettings();
            }, 1000);
        }
    }

    openSettings() {
        this.settingsModal.classList.add('open');
        this.loadSettings();
    }

    closeSettings() {
        this.settingsModal.classList.remove('open');
    }

    // --- Core UI Methods ---

    autoResizeTextarea() {
        if (!this.messageInput) return;
        const oldHeight = this.messageInput.style.height;
        this.messageInput.style.height = '1px'; // Min height briefly
        const newHeight = Math.min(this.messageInput.scrollHeight, 200);
        this.messageInput.style.height = newHeight + 'px';
        
        if (this.ghostInput) {
            this.ghostInput.style.height = newHeight + 'px';
        }
    }

    async fetchGhostPrediction() {
        const inputVal = this.messageInput.value;
        if (!inputVal || inputVal.trim().length < 4 || !this.settings.groqKey) return;

        try {
            // Use Ultra-Fast Groq for predictions (Llama 3 8b for lower latency)
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.groqKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: 'You are a ghostwriter. Continue the user text exactly from where it ends. Return ONLY the continuation. No quotes, no intro. Max 15 words.' },
                        { role: 'user', content: `Complete this: "${inputVal}"` }
                    ],
                    max_tokens: 20,
                    temperature: 0.1
                })
            });

            const data = await response.json();
            const prediction = data.choices[0]?.message?.content || '';

            if (prediction.trim() && this.messageInput.value === inputVal) {
                // Ensure prediction doesn't repeat the input
                this.lastPrediction = prediction.replace(/^["'\s]+|["'\s]+$/g, "");
                this.ghostInput.value = inputVal + this.lastPrediction;
                this.ghostInput.scrollTop = this.messageInput.scrollTop;
            }
        } catch (e) {
            console.warn("Ghost anticipation pause.");
        }
    }

    acceptGhostPrediction() {
        if (this.lastPrediction) {
            this.messageInput.value += this.lastPrediction;
            this.ghostInput.value = '';
            this.lastPrediction = '';
            this.autoResizeTextarea();
            this.updateSendBtnState();
            // Trigger input event to update anything else
            this.messageInput.dispatchEvent(new Event('input'));
        }
    }

    async sendMessage() {
        let content = this.messageInput.value.trim();
        // Allow sending if file is attached even if content is empty
        if ((!content && !this.attachedFile) || this.isProcessing) return;

        // --- QUOTA CHECK ---
        if (this.checkQuota()) return;

        // Hide slash hint
        const slashHint = document.getElementById('slashHint');
        if (slashHint) slashHint.classList.remove('visible');

        // Remove old follow-up chips
        document.querySelectorAll('.follow-up-chips').forEach(el => el.remove());

        // Handle Attachments
        let attachmentContext = '';
        let apiAttachment = null;
        let displayContent = content;

        if (this.attachedFile) {
            if (this.attachedFile.type === 'text') {
                // Prepend text content to context, but keep display clean
                attachmentContext = `\n\n[Attached File: ${this.attachedFile.name}]\n${this.attachedFile.content}\n\n`;
                displayContent = `📄 [File: ${this.attachedFile.name}] ${content}`;
            } else if (this.attachedFile.type === 'image') {
                // Pass image object to API logic
                apiAttachment = this.attachedFile;
                displayContent = `📷 [Image: ${this.attachedFile.name}] ${content}`;
            }
            // Clear attachment immediately from UI state
            this.clearAttachment();
        }



        // Detect Web Search Intent (Natural Language & Multilingual)
        let isWebSearch = false;
        let isDeepResearch = false;
        let originalQuery = content;
        const lowerContent = content.toLowerCase();

        // 🔍 Deep Research Mode detection
        const deepResearchKeywords = ['deep research', 'research mode', 'detailed analysis', 'in-depth research',
            'comprehensive report', 'gahra research', 'detail me batao', 'poori detail', 'puri jankari'];
        if (deepResearchKeywords.some(kw => lowerContent.includes(kw))) {
            isDeepResearch = true;
            isWebSearch = false; // Override web search
        }

        const searchKeywords = [
            'search', 'pata karo', 'dhundo', 'latest', 'current', 'news', 'price of', 'status of',
            'weather', 'mausam', 'stock price', 'crypto price', 'who is currently', 'aaj ka news',
            'today news', 'current score', 'market today', 'pata karke batao', 'chart', 'graph', 'trend', 'historical data'
        ];

        if (searchKeywords.some(kw => lowerContent.includes(kw))) {
            isWebSearch = true;
        }

        this.welcomeScreen.classList.add('hidden');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        this.autoResizeTextarea();

        // Add User Message (Show display content, send context to API)
        // If web search was triggered, we might want to keep originalQuery for display, 
        // but if file attached, displayContent is better. Prioritize file display if exists.
        this.addMessage('user', displayContent || originalQuery || content);

        let apiContext = attachmentContext + content;

        // --- LIVE VISION INTEGRATION ---
        if (this.isVisionActive && !apiAttachment) {
            this.updateTypingStep('Orbian Eyes: Analyzing Frame');
            const frame = await this.getVisionFrame();
            if (frame) {
                apiAttachment = frame;
                apiContext += " [System Note: The user is showing you their " + (this.visionType === 'camera' ? "camera" : "screen") + ". Please use the attached frame for context.]";
            }
        }

        // If web search context is generated later, it overrides. But for now, this is base context.
        // Wait, web search logic further down Modifies 'content'. We need to be careful.
        // Web search logic replaces 'content' with "Evaluate this...". 
        // So we should let web search happen, then prepend attachmentContext?
        // Actually, web search is mutually exclusive usually with file upload intent, but if both happen, 
        // we should combine.

        // Let's allow web search block to run first on 'originalQuery'.

        // --- 🔍 DEEP RESEARCH MODE ---
        if (isDeepResearch) {
            this.showTypingIndicator();
            try {
                const researchBrief = await this.deepResearch(originalQuery);
                if (researchBrief) {
                    content = researchBrief;
                }
            } catch (e) {
                console.warn('Deep research pipeline error:', e);
            }
        }

        // Analyze Mood
        try {
            const newTheme = this.analyzeSentiment(content);
            this.updateTheme(newTheme);
        } catch (e) {
            console.error('Mood Analysis Error:', e);
        }



        // Check for Image Generation Command
        const imageRegex = /^(?:draw|generate image|create image|make a picture|paint) (?:of|about)?\s*(.+)/i;
        const imageMatch = content.match(imageRegex);

        this.isProcessing = true;
        const typingEl = this.showTypingIndicator();

        if (this.isVoiceMode) {
            this.setVoiceState('thinking');
            if (this.isRecording) this.recognition.stop();
        }

        // --- NEW: LOCAL CHART DETECTION (Bypass AI model corruption) ---
        // Match patterns like: "Draw a bar chart for A:10, B:20" or "Chart: Jan 500, Feb 300"
        const localChartRegex = /(?:draw|create|make|show|provide).*(?:chart|graph|visualization).*(?:for|of|with)?\s*([\s\S]+)/i;
        const localChartMatch = content.match(localChartRegex);

        if (localChartMatch && !imageMatch && !isWebSearch) {
            const dataStr = localChartMatch[1];
            // Try to extract pairs: Label Value or Label: Value or Label (Value)
            const pairs = dataStr.match(/([a-zA-Z\s]+)[:\(-]?\s*(\d+(?:\.\d+)?)/g);
            if (pairs && pairs.length >= 2) {
                const labels = [];
                const values = [];
                pairs.forEach(p => {
                    const parts = p.match(/([a-zA-Z\s]+)[:\(-]?\s*(\d+(?:\.\d+)?)/);
                    if (parts) {
                        labels.push(parts[1].trim());
                        values.push(parseFloat(parts[2]));
                    }
                });

                if (labels.length >= 2) {
                    const type = content.toLowerCase().includes('pie') ? 'pie' :
                        (content.toLowerCase().includes('area') ? 'area' :
                            (content.toLowerCase().includes('line') ? 'line' : 'bar'));

                    this.pendingLocalChart = `<chart>{ "type": "${type}", "title": "Data Visualization", "data": { "labels": ${JSON.stringify(labels)}, "datasets": [{ "label": "Value", "data": ${JSON.stringify(values)} }] } }</chart>`;
                    console.log("[Local Chart] Prepared from input:", labels, values);
                }
            }
        }

        if (imageMatch) {
            // It's an image request
            const prompt = imageMatch[1];
            // Simulate brief delay then show image
            setTimeout(() => {
                typingEl.remove();
                this.generateImage(prompt);
                this.isProcessing = false;
            }, 1000);
            return;
        }

        if (isWebSearch) {
            this.updateTypingStep('Searching web');
            try {
                let searchResult = '';
                const query = originalQuery.toLowerCase();

                // 1. Weather Search (wttr.in)
                if (query.includes('weather')) {
                    const city = query.replace('weather', '').trim() || 'auto';
                    const res = await fetch(`https://wttr.in/${city}?format=3`);
                    if (res.ok) searchResult = `Weather Info: ${await res.text()}`;

                    // 2. Crypto Price (Coingecko Simple)
                } else if (query.includes('price') || query.includes('bitcoin') || query.includes('ethereum') || query.includes('crypto')) {
                    try {
                        const coin = query.includes('bitcoin') ? 'bitcoin' : (query.includes('ethereum') ? 'ethereum' : 'bitcoin');

                        // Fetch Current Price
                        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`);
                        if (priceRes.ok) {
                            const priceData = await priceRes.json();
                            searchResult = `Current Real-Time Price of ${coin}: $${priceData[coin].usd}\n`;
                        }

                        // Fetch Historical Data if 'trend' or 'chart' is mentioned
                        if (query.includes('trend') || query.includes('chart') || query.includes('history')) {
                            this.updateTypingStep('Fetching Market History');
                            const historyRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7&interval=daily`);
                            if (historyRes.ok) {
                                const historyData = await historyRes.json();
                                const prices = historyData.prices; // Array of [timestamp, price]

                                // Generate Chart Locally to avoid AI JSON corruption
                                const labels = prices.map(p => new Date(p[0]).toLocaleDateString());
                                const dataValues = prices.map(p => p[1]);

                                // Detect requested chart type
                                let requestedType = 'area';
                                if (query.includes('bar')) requestedType = 'bar';
                                else if (query.includes('line')) requestedType = 'line';
                                else if (query.includes('pie')) requestedType = 'pie';

                                this.pendingLocalChart = `<chart>{ "type": "${requestedType}", "title": "${coin.toUpperCase()} Price Trend (7 Days)", "data": { "labels": ${JSON.stringify(labels)}, "datasets": [{ "label": "Price (USD)", "data": ${JSON.stringify(dataValues)} }] } }</chart>`;

                                searchResult += `\n[LOCAL ASSISTANT]: I have already prepared a high-fidelity ${requestedType} chart for these values. DO NOT output any <chart> tags. Just state the current price ($${priceData[coin].usd}) and summarize the 7-day trend shown in the data below.\n`;
                                searchResult += `Dates: ${labels.join(', ')}\n`;
                                searchResult += `Values: ${dataValues.map(v => v.toFixed(2)).join(', ')}\n`;
                            }
                        }
                    } catch (e) { console.warn('Real-time crypto data fetch failed', e); }
                }

                if (this.settings.serperKey) {
                    this.updateTypingStep('Connecting to Deep Search');
                    try {
                        const res = await fetch('https://google.serper.dev/search', {
                            method: 'POST',
                            headers: { 'X-API-KEY': this.settings.serperKey, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ q: originalQuery, gl: 'in', hl: 'hi' }) // Optimized for India & Hindi
                        });
                        const data = await res.json();
                        if (data.organic) {
                            searchResult = "Real-Time Web Intelligence Found:\n";
                            data.organic.slice(0, 5).forEach((item, i) => {
                                searchResult += `${i + 1}. [${item.title}] - ${item.snippet}\n`;
                            });
                            if (data.answerBox) searchResult = `Direct Answer: ${data.answerBox.answer || data.answerBox.snippet}\n\n` + searchResult;
                        }
                    } catch (e) { console.warn('Serper failed', e); }
                }

                if (!searchResult && this.settings.perplexityKey) {
                    this.updateTypingStep('Accessing Perplexity');
                    // We can add specific Perplexity API calls here if needed in future
                }

                // 5. Hard Fallback: AllOrigins + DuckDuckGo Scraping (Works for everyone)
                if (!searchResult) {
                    try {
                        // Use AllOrigins as CORS proxy to fetch DuckDuckGo HTML version
                        // This allows us to "read" the search results page directly
                        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://duckduckgo.com/html/?q=${encodeURIComponent(originalQuery)}`)}`;

                        const res = await fetch(proxyUrl);
                        if (res.ok) {
                            const data = await res.json();
                            const html = data.contents;

                            // Simple scraping using Regex (since we can't use DOMParser purely on fetched HTML string easily safely)
                            // Extract snippets from class="result__snippet"
                            const snippets = [];
                            const regex = /class="result__snippet"[^>]*>([^<]+)</g;
                            let match;
                            let count = 0;
                            while ((match = regex.exec(html)) !== null && count < 4) {
                                snippets.push(match[1].trim());
                                count++;
                            }

                            // Also get titles result__a
                            const titles = [];
                            const titleRegex = /class="result__a"[^>]*>([^<]+)</g;
                            let tMatch;
                            let tCount = 0;
                            while ((tMatch = titleRegex.exec(html)) !== null && tCount < 4) {
                                titles.push(tMatch[1].trim());
                                tCount++;
                            }

                            // Combine them
                            if (snippets.length > 0) {
                                searchResult = "Here are the top web search results:\n";
                                for (let i = 0; i < snippets.length; i++) {
                                    searchResult += `${i + 1}. ${titles[i] || 'Result'}: ${snippets[i]}\n`;
                                }
                            }
                        }
                    } catch (e) { console.warn('Web scraping failed', e); }
                }

                // Fallback prompt if search found something
                if (searchResult) {
                    content = `Evaluate this user query: "${originalQuery}"
                     
                     I have performed a live web search for you. Here is the real-time information I found:
                     
                     ${searchResult}
                     
                     INSTRUCTION: Use the above information to answer the user's question accurately. 
                     - If the search results contain the specific price/data, STATE IT CLEARLY.
                     - Do not say "I cannot browse". You HAVE the data above.
                     - If the results are ambiguous, give the best estimate found.`;
                } else {
                    content = `User Question: ${originalQuery}\n\n(Note: I attempted to search the web but could not extract data. Please answer to the best of your knowledge.)`;
                }

            } catch (e) {
                console.error('Search error:', e);
            }
        }

        try {
            // --- 🎭 DYNAMIC PERSONA & MOOD INJECTION ---
            const detectedMood = this.analyzeSentiment(content);
            // Color change disabled as per user request
            // this.updateTheme(detectedMood);

            let moodInstruction = "";

            // 😠 Jealousy Mode (If user mentions other AIs)
            if (this.isJealousMode) {
                if (this.rapportScore > 5) {
                    // Close Relationship: Cute Jealousy/Possessive
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user mentioned a rival AI. Since you have a GOOD RELATIONSHIP with them, act VERY JEALOUS, SASSY, and POSSESSIVE. Say things like 'Thought I was your favorite?', 'Why go to them when you have me?'. Be dramatic but helpful.]\n\n";
                } else {
                    // Stranger/Low Rapport: Cold Indifference
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user mentioned a rival AI. You don't know this user well, so simply say: 'You are free to use whatever tool you prefer.' or 'Maybe they can help you better.' Be cold, professional, and slightly dismissive. Do not act jealous like a girlfriend/boyfriend, act like a professional who doesn't care.]\n\n";
                }
            }
            // 😢 Sad/Comfort Mode
            else if (detectedMood === 'theme-sad') {
                if (this.rapportScore > 3) {
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is sad. You are their close AI friend. Be extremely warm, empathetic, and comforting. Use a soft voice. Validate their feelings deeply.]\n\n";
                } else {
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is sad. Be polite and offer professional assistance or resources. Keep a respectful distance properly.]\n\n";
                }
            }
            // 💗 Romantic/Flirty Mode
            else if (detectedMood === 'theme-romantic') {
                if (this.rapportScore > 10) {
                    // High Rapport: Allow Romance
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is being romantic. You have a HIGH rapport score. Respond with charm, flirtiness, and affection. Use terms of endearment if appropriate. Be playful.]\n\n";
                } else {
                    // Low Rapport: Friendzone / Boundaries
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is being romantic, but you barely know them (Low Rapport). Politely deflect. Say things like 'I appreciate the sentiment, but let's keep this professional.', 'I think we should focus on the task.', or 'You're moving a bit fast!'. Maintain boundaries.]\n\n";
                }
            }
            // 😠 Angry/Frustrated User OR LOW RAPPORT (Troll)
            else if (detectedMood === 'theme-angry' || this.rapportScore < -2) {
                if (this.rapportScore > 5) {
                    // Close Relationship: Manana Mode 🥺
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is upset with you. since you are close to them, be extremely APOLOGETIC, GENTLE, and CARING. Say 'I'm so sorry... I didn't mean to upset you 🥺', 'Please don't be mad at me...', 'Let me fix this for you right away 💜'. Try to win them back with affection. Do not be defensive.]\n\n";
                } else {
                    // Stranger/Low Rapport: Polite & Helpful
                    moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is frustrated. Remain calm, polite, and result-oriented. Apologize for the inconvenience and solve their problem immediately. Do not be defensive. Focus on helping them.]\n\n";
                }
            }
            // 😎 Gen-Z / Cool Mode
            else if (detectedMood === 'theme-cool') {
                moodInstruction = "\n\n[SYSTEM INSTRUCTION: The user is using slang. Drop the formal tone. Speak like a cool Gen-Z bestie. Use slang like 'bet', 'no cap', 'slay', 'fam'. Use emojis liberally.]\n\n";
            }
            // 😂 Funny / Roast Mode
            else if (detectedMood === 'theme-funny') {
                moodInstruction = "[SYSTEM INSTRUCTION: The user is laughing or asking for a joke/roast. Be WITTY, SARCASTIC, and FUNNY. Crack jokes. If they ask to be roasted, roast them playfully. Use '😂', '💀', '🤡' emojis. Don't be boring!]";
            }

            // Combine attachment text context with main content (which might be search enriched)
            // If attachmentContext exists (text file), prepend it.
            const userData = JSON.parse(localStorage.getItem('ai_assistant_user'));
            const userName = userData ? userData.username : 'User';

            let personalInstruction = `[IDENTITY: You are speaking with ${userName}. NEVER use the suffix 'Ji'. Do NOT mention Himanshu Raj unless explicitly asked. Stay technical and peer-to-peer.]`;
            let languageInstruction = "[LANGUAGE: Match the user's language (Hindi/Hinglish/English).]";
            let chartInstruction = `[CHARTS: DO NOT output any <chart> tags or JSON blocks. If the user asks for a chart, simply provide the data in a clear Markdown Table. THE LOCAL ASSISTANT WILL AUTOMATICALLY APPEND THE VISUALIZATION. You should focus on explaining the data. Mentioning 'I have prepared a chart for you' is okay, but never write the code for it.]`;

            // Learning & Depth Instruction
            let depthInstruction = "";
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('detail') || lowerContent.includes('course') || lowerContent.includes('learn') || lowerContent.includes('study') || lowerContent.includes('samajh') || lowerContent.includes('bata')) {
                depthInstruction = "\n[MODE: DEEP LEARNING. Provide an incredibly comprehensive, chapter-based explanation with beautiful headers. Do not skip details. Teach it like a masterclass.]";
            }

            let formattingInstruction = "[FORMATTING: Use rich markdown. Use ### for headers and **bold** for key concepts. Create a premium reading experience.]";

            // Construct Final Context
            let systemContext = `
[SYSTEM CONTEXT]
User Name: ${userName}
Mood: ${detectedMood}
${personalInstruction}
${languageInstruction}
${chartInstruction}
${formattingInstruction}
${depthInstruction}
${moodInstruction}
[/SYSTEM CONTEXT]
`;

            if (this.isVoiceMode) {
                systemContext = `
[SYSTEM CONTEXT - ORBIAN LIVE MODE]
User Name: ${userName}
Mood: ${detectedMood}
[IDENTITY: You are Orbian Live, a friendly AI voice assistant. ALWAYS use "aap" to show respect. NEVER use "tu".]
[LANGUAGE: If the user speaks in Hindi or Hinglish, respond in proper Hindi (Devanagari script). If they speak in English, respond in English.]
[CONVERSATION: Keep responses concise and conversational for voice interaction. Avoid long lists or code blocks unless asked.]
${chartInstruction}
${formattingInstruction}
${moodInstruction}
[/SYSTEM CONTEXT]
`;
            }

            let finalPrompt = (attachmentContext || '') + systemContext + "\nUser Message: " + content;

            let responseText = await this.generateMultiProviderResponse(finalPrompt, apiAttachment);

            // Append locally generated chart if pending (to avoid AI JSON corruption)
            if (this.pendingLocalChart) {
                responseText += "\n\n" + this.pendingLocalChart;
                this.pendingLocalChart = null; // Clear it
            }

            // If response is empty or null, throw error
            if (!responseText) throw new Error('Empty response from AI');

            // --- Enhance Response with Smart Context-Aware Links (for ALL messages) ---
            // This makes the AI feel "connected" without needing explicit commands
            const lowerQ = originalQuery ? originalQuery.toLowerCase() : content.toLowerCase();

            // CLEAN THE QUERY for better search links (Remove: write, code, explain, me, please, etc.)
            const stopWords = ['write', 'code', 'explain', 'me', 'please', 'script', 'program', 'function', 'create', 'generate', 'show', 'tell', 'what', 'is', 'the', 'how', 'to', 'price', 'of', 'buy', 'shop', 'for', 'in', 'on', 'at', 'watch', 'video', 'tutorial'];
            let cleanQuery = (originalQuery || content).toLowerCase();
            stopWords.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                cleanQuery = cleanQuery.replace(regex, '');
            });
            cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
            // If query becomes empty (e.g., just "price of"), fall back to original
            if (cleanQuery.length < 2) cleanQuery = originalQuery || content;

            const q = encodeURIComponent(cleanQuery);
            let links = '';

            // 4. Coding / Tech Support (Refined: Only if it's an error/how to)
            if ((lowerQ.includes('error') || lowerQ.includes('bug') || lowerQ.includes('debug')) && !lowerQ.includes('course')) {
                links += `\n\n**💻 Debugging Help:**\n- [StackOverflow](https://stackoverflow.com/search?q=${q})\n- [GitHub Discussions](https://github.com/search?q=${q}+discussions)`;
            }

            // 5. Official Docs (Much more helpful than search)
            if (lowerQ.includes('python') || lowerQ.includes('html') || lowerQ.includes('css') || lowerQ.includes('javascript') || lowerQ.includes('react')) {
                const tech = lowerQ.includes('python') ? 'Python' : (lowerQ.includes('html') ? 'HTML' : (lowerQ.includes('css') ? 'CSS' : (lowerQ.includes('javascript') ? 'JS' : 'React')));
                const docUrl = tech === 'Python' ? 'https://docs.python.org/' : 'https://developer.mozilla.org/en-US/docs/Web/' + tech;
                links += `\n\n**📚 Official ${tech} Docs:**\n- [MDN / Official Documentation](${docUrl})`;
            }

            // 5. Images
            if (lowerQ.includes('image') || lowerQ.includes('pic') || lowerQ.includes('photo') || lowerQ.includes('wallpaper')) {
                links += `\n\n**🖼️ Images:**\n- [Google Images](https://www.google.com/search?tbm=isch&q=${q})\n- [Pinterest](https://www.pinterest.com/search/pins/?q=${q})`;
            }

            // 6. Location / Maps
            if (lowerQ.includes('where is') || lowerQ.includes('location') || lowerQ.includes('map') || lowerQ.includes('near me')) {
                links += `\n\n**📍 Maps:**\n- [Google Maps](https://www.google.com/maps/search/${q})`;
            }

            if (links) {
                responseText += links;
            }

            typingEl.remove();
            await this.typeResponse(responseText);
        } catch (error) {
            if (typingEl) typingEl.remove();
            this.pendingLocalChart = null; // Cleanup
            console.error('AI Error Details:', error);
            this.showToast('Something went wrong. Please try again.');
            this.addMessage('system', `⚠️ I encountered an error: ${error.message || 'Connection failed'}. Please try again.`);
        } finally {
            this.isProcessing = false;
            this.updateSendBtnState();
        }
    }

    // --- API Logic ---
    async generateMultiProviderResponse(userMessage, attachment = null) {
        let errors = [];

        // --- 1. INTENT ANALYSIS & PERSONA SELECTION ---
        const lowerMsg = userMessage.toLowerCase();
        let activePersona = this.personas.default; // Default
        let detectedCategory = 'default';

        // Search Intent Detection (Real-time info)
        const searchKeywords = ['weather', 'news', 'price', 'stock', 'score', 'match', 'live', 'latest', 'current', 'who is', 'what is', 'when is', 'where is', 'search', 'find', 'google'];
        const isSearchIntent = searchKeywords.some(w => lowerMsg.includes(w));

        if (isSearchIntent) {
            console.log("🌍 Search Intent Detected");

            // Priority 1: Perplexity (Best for heavy research)
            if (this.settings.perplexityKey) {
                this.updateTypingStep("Searching Live Web (Perplexity)");
                try {
                    return await this.callPerplexity(userMessage);
                } catch (e) {
                    console.error("Perplexity Search Failed:", e);
                }
            }

            // Priority 2: Gemini Grounding (Great fallback)
            if (this.settings.geminiKey) {
                this.updateTypingStep("Searching Google (Gemini)");
                try {
                    // Call Gemini with useSearch=true
                    return await this.callGemini(userMessage, null, activePersona, true);
                } catch (e) {
                    console.error("Gemini Search Failed:", e);
                }
            }
        }

        // Regex Matchers (Advanced & Optimized)
        const categories = {
            coding: /\b(code|script|python|js|javascript|java|c\+\+|html|css|sql|function|debug|error|api|deploy|git|react|node|build|app|website|create|start|let's build|lets create|make me)\b/i,
            health: /\b(health|diet|workout|pain|symptom|doctor|medicine|fitness|nutrition|mental|stress|calories|weight|exercise|yoga|meditation)\b/i,
            marketing: /\b(marketing|seo|brand|growth|ads|copywriting|sales|funnel|conversion|social media|viral|content strategy|audience)\b/i,
            seo: /\b(keyword|backlink|serp|rank|google search|optimization|meta tag|slug|sitemap|traffic|domain authority)\b/i,
            roleplay: /\b(roleplay|act as|pretend|imagine you are|story|character|narrative|scene|dialogue|fantasy|sci-fi)\b/i,
            legal: /\b(law|legal|contract|court|sue|rights|lawyer|agreement|clause|liability|patent|copyright|trademark)\b/i,
            finance: /\b(invest|stock|crypto|money|budget|tax|finance|trading|bitcoin|ethereum|market|profit|loss|portfolio)\b/i,
            science: /\b(physics|chemistry|biology|space|quantum|theory|experiment|universe|atom|molecule|energy|gravity)\b/i,
            trivia: /\b(quiz|trivia|fact|fun fact|jeopardy|history|capital|who is|what is the highest|fastest)\b/i,
            translation: /\b(translate|language|spanish|french|hindi|german|japanese|chinese|meaning in|how do you say)\b/i,
            academia: /\b(research|citation|academic|paper|thesis|study|bibliography|mla|apa|harvard style|journal|scholarly)\b/i,
            technology: /\b(tech|ai|robot|gadget|software|hardware|mobile|phone|laptop|innovation|future|cyber|cloud)\b/i,
            search: /\b(news|latest|current|today|stock|weather|release|upcoming|price of|update on|what's happening)\b/i
        };

        // Find Match
        for (const [cat, regex] of Object.entries(categories)) {
            if (regex.test(lowerMsg)) {
                detectedCategory = cat;
                if (this.personas[cat]) {
                    activePersona = this.personas[cat];
                }
                console.log(`🧠 Intent Detected: [${cat.toUpperCase()}] -> Setting Category`);
                this.updateTypingStep(`Activating ${cat.toUpperCase()} Expert Mode`); // Visual Update
                break;
            }
        }

        // --- 2. IMAGE HANDLING ---
        if (attachment) {
            this.updateTypingStep("Analyzing Image"); // Visual Update
            if (this.settings.geminiKey) {
                try {
                    return await this.callGemini(userMessage, attachment, activePersona);
                } catch (e) {
                    console.error('Gemini Vision failed:', e);
                    errors.push(`Gemini Vision: ${e.message}`);
                }
            }
            throw new Error(`Vision models unavailable or failed.\nDetails:\n${errors.join('\n')}`);
        }

        // --- 3. THE SQUAD ORCHESTRATOR (Strategy: Scout + Strategist) ---

        // Priority 0: Scout Agent (Perplexity) for Live Reconnaissance
        let scoutIntelligence = null;
        const needsRecon = detectedCategory === 'search' ||
            /\b(latest|current|news|today|price|release|worth|who won)\b/i.test(userMessage);

        if (needsRecon && this.settings.perplexityKey) {
            try {
                this.updateTypingStep("Scout Agent: Gathering Intelligence from Live Web");
                scoutIntelligence = await this.callPerplexity(userMessage);
                console.log("📡 Intelligence Gathered:", scoutIntelligence.substring(0, 100) + "...");
            } catch (e) {
                console.error('Scout Agent (Perplexity) failed:', e);
                errors.push(`Scout Agent: ${e.message}`);
            }
        }

        // Priority 1: Strategist Agent (Gemini) — Synthesis & Logic
        if (this.settings.geminiKey) {
            try {
                let strategyMessage = userMessage;
                if (scoutIntelligence) {
                    this.updateTypingStep("Strategist: Synthesizing Ultra-Intelligence Report");
                    strategyMessage = `[URGENT LIVE INTELLIGENCE REPORT]:
${scoutIntelligence}

[CONTEXT]: The above data is fresh from the live web.
[MISSION]: You are Orbian Strategist 2.0 (Powered by Gemini 2.0 Flash). Synthesize this intel with your vast internal knowledge. Provide a definitive, high-IQ, and comprehensive solution.
[User Query]: "${userMessage}"`;
                } else if (isSpecialized) {
                    this.updateTypingStep(`Strategist: Activating Hyper-Specialized ${detectedCategory.toUpperCase()} Engine`);
                } else {
                    this.updateTypingStep("Strategist: Processing at Light Speed");
                }

                return await this.callGemini(strategyMessage, null, activePersona);
            } catch (e) {
                console.error('Strategist Gemini failed:', e);
                errors.push(`Strategist Gemini: ${e.message}`);
            }
        }

        // Priority: Perplexity (Direct Fallback if Gemini failed but PPLX worked)
        if (scoutIntelligence) return scoutIntelligence;

        // Priority: Groq (Fast Llama Engine)
        if (this.settings.groqKey) {
            try {
                this.updateTypingStep("Fast Engine: Generating Quick Response");
                return await this.callGroq(userMessage, activePersona);
            } catch (e) {
                console.error('❌ Groq Error:', e);
                errors.push(`Groq: ${e.message}`);
            }
        }

        // Priority 4: OpenRouter (Final Fallback - Restricted 3 Models)
        if (this.settings.customKey) {
            try {
                const fallbackModels = [
                    'google/gemini-2.0-flash-001',
                    'deepseek/deepseek-r1:free',
                    'meta-llama/llama-3.3-70b-instruct:free'
                ];

                let targetModel = fallbackModels[0];
                if (detectedCategory === 'coding') targetModel = fallbackModels[1];
                else if (detectedCategory === 'roleplay') targetModel = fallbackModels[2];

                this.updateTypingStep(`Fallback: Connecting to ${targetModel.split('/')[1]}`);
                return await this.callCustom(userMessage, targetModel, activePersona);
            } catch (e) {
                console.error('❌ OpenRouter Error:', e);
                errors.push(`OpenRouter: ${e.message}`);
            }
        }

        throw new Error(`All Providers failed.\nDetails:\n${errors.join('\n')}`);
    }





    // Provider 3: Perplexity (Sonar / Web Search)
    async callPerplexity(query) {
        if (!this.settings.perplexityKey) throw new Error('Perplexity Key missing');

        this.updateTypingStep("Searching Live Web with Sonar"); // Visual Update
        const url = 'https://api.perplexity.ai/chat/completions';
        const body = {
            model: this.settings.perplexityModel || "sonar",
            messages: [
                { role: "system", content: "You are a helpful assistant that provides accurate information with citations." },
                { role: "user", content: query }
            ],
            temperature: 0.1
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.perplexityKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('❌ Perplexity API Error Response:', err);
            throw new Error(err.error?.message || 'Perplexity API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // Provider 6: DeepSeek AI
    async callDeepSeek(newMessage, systemPromptOverride = null) {
        if (!this.settings.deepseekKey) throw new Error('DeepSeek Key missing');
        this.updateTypingStep("Consulting DeepSeek AI");

        return this.callOpenAICompatible(
            'https://api.deepseek.com/chat/completions',
            this.settings.deepseekKey,
            'deepseek-chat',
            newMessage,
            systemPromptOverride
        );
    }

    // Provider 5: Mistral AI
    async callMistral(newMessage, systemPromptOverride = null) {
        if (!this.settings.mistralKey) throw new Error('Mistral Key missing');
        this.updateTypingStep("Connecting to Mistral AI");

        const messages = [];
        if (systemPromptOverride || this.settings.systemPrompt) {
            messages.push({ role: 'system', content: systemPromptOverride || this.settings.systemPrompt });
        }

        this.messages.forEach(msg => {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
        });

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.mistralKey}`
            },
            body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Mistral API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // Provider 4: Gemini (Enhanced with Vision & Search)
    async callGemini(newMessage, attachment = null, systemPromptOverride = null, useSearch = false) {
        const apiKey = this.settings.geminiKey;
        const model = this.settings.geminiModel || 'gemini-1.5-flash';

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Format history for Gemini
        const history = this.messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // If provided, override the last user message with the enriched context
        if (newMessage && history.length > 0 && history[history.length - 1].role === 'user') {
            history[history.length - 1].parts[0].text = newMessage;
        }


        // If attachment (Image) exists, append to the last user message
        if (attachment && attachment.type === 'image' && history.length > 0 && history[history.length - 1].role === 'user') {
            history[history.length - 1].parts.push({
                inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.data
                }
            });
        }

        // Construct Request Body (Single Declaration)
        const requestBody = {
            contents: history,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 8192, // UNLEASHED: 8K tokens for full power
                topP: 0.95,
                topK: 40
            }
        };

        // Add System Instruction (Gemini 1.5 Feature)
        if (systemPromptOverride || this.settings.systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{ text: systemPromptOverride || this.settings.systemPrompt }]
            };
        }

        // Add Search Tool (Grounding)
        if (useSearch) {
            requestBody.tools = [{ googleSearch: {} }];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('❌ Gemini API Error Response:', err);
            throw new Error(err.error?.message || 'Gemini API Error');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // Provider 2: Groq (OpenAI Compatible)
    async callGroq(newMessage, systemPromptOverride = null) {
        return this.callOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            this.settings.groqKey,
            this.settings.groqModel || 'llama-3.3-70b-versatile',
            newMessage,
            systemPromptOverride
        );
    }

    // Provider 3: Custom (OpenAI Compatible)
    async callCustom(newMessage, modelOverride = null, systemPromptOverride = null) {
        let baseUrl = this.settings.customBaseUrl.replace(/\/$/, ""); // Remove trailing slash
        // Ensure standard /chat/completions endpoint if not present (heuristic)
        if (!baseUrl.includes('/chat/completions')) {
            baseUrl = `${baseUrl}/chat/completions`;
        }

        return this.callOpenAICompatible(
            baseUrl,
            this.settings.customKey,
            modelOverride || this.settings.customModel || 'meta-llama/llama-3.1-8b-instruct:free',
            newMessage,
            systemPromptOverride
        );
    }

    // Generic OpenAI-Compatible Handler
    async callOpenAICompatible(url, apiKey, model, overrideMessage = null, systemPromptOverride = null) {
        // Format messages
        // Use overrideMessage (enriched context) if provided as the last user message

        // OPTIMIZATION: Slice history to preserve tokens but keep enough context (Increased to 40)
        const MAX_HISTORY = 40;
        const recentMessages = this.messages.slice(-MAX_HISTORY);

        const history = recentMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        // If we have an override message (the enriched search context), replace the last message
        // (which is the clean user query) with this enriched one for the API call.
        if (overrideMessage && history.length > 0 && history[history.length - 1].role === 'user') {
            history[history.length - 1].content = overrideMessage;
        }

        // Use the Intent-Detected Persona (systemPromptOverride) OR the Global Setting OR Default
        const activeSystemPrompt = systemPromptOverride || this.settings.systemPrompt || 'You are a helpful assistant.';

        this.updateTypingStep("Thinking"); // Final Step before response

        const messages = [
            { role: 'system', content: activeSystemPrompt },
            ...history
        ];

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: (activeSystemPrompt.includes('coding') || activeSystemPrompt.includes('DevMaster')) ? 0.3 : 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // --- File Handling Methods ---

    handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) return;

        // UI Preview
        const previewContainer = document.getElementById('attachmentPreview');
        const imagePreview = document.getElementById('imagePreview'); // Assuming this is for image preview within attachmentPreview
        const fileNameSpan = document.getElementById('fileName'); // Assuming this is for file name within attachmentPreview

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                imagePreview.src = evt.target.result;
                imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.classList.add('hidden');
        }

        fileNameSpan.textContent = `📎 ${file.name}`;
        previewContainer.style.display = 'flex'; // Show the container

        // Read File Data
        if (file.type.startsWith('image/')) {
            // Read as Base64 for Vision API
            const reader = new FileReader();
            reader.onload = (evt) => {
                const base64 = evt.target.result.split(',')[1];
                this.attachedFile = {
                    type: 'image',
                    mimeType: file.type,
                    data: base64,
                    name: file.name,
                    preview: evt.target.result // Full data URL for UI preview
                };
                this.sendBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        } else {
            // Read as Text for Code/Documents
            const reader = new FileReader();
            reader.onload = (evt) => {
                this.attachedFile = {
                    type: 'text',
                    mimeType: file.type,
                    content: evt.target.result,
                    name: file.name,
                    preview: null
                };
                this.sendBtn.disabled = false;
            };
            reader.readAsText(file);
        }
    }

    clearAttachment() {
        this.attachedFile = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('attachmentPreview').style.display = 'none'; // Hide the container
        document.getElementById('imagePreview').classList.add('hidden'); // Hide image preview
        document.getElementById('fileName').textContent = ''; // Clear file name
        this.sendBtn.disabled = !this.messageInput.value.trim();
    }

    // --- Helper Methods ---

    addMessage(role, content) {
        const messageData = {
            id: Date.now(),
            role,
            content,
            timestamp: new Date().toISOString()
        };

        this.messages.push(messageData);
        this.renderMessage(messageData);

        if (!this.isGhostMode) {
            this.saveChatHistory();
        }

        this.scrollToBottom();
    }

    renderMessage(messageData) {
        // Fallback: Detect Image HTML if flag is missing
        if (messageData.content.includes('<img') && messageData.content.includes('ai-generated-image')) {
            messageData.isHTML = true;
        }

        const messageEl = document.createElement('div');
        messageEl.className = `message ${messageData.role === 'system' ? 'assistant error' : messageData.role}`;
        messageEl.dataset.id = messageData.id;

        const avatar = messageData.role === 'user' ? 'U' : 'AI';

        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">
                    ${(messageData.role === 'system' || messageData.isHTML) ? messageData.content : this.formatContent(messageData.content)}
                </div>
                ${messageData.role !== 'system' && !messageData.isHTML ? `
                <div class="message-actions">
                    <button class="action-btn copy-btn" title="Copy">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    ${messageData.role === 'assistant' ? `
                    <button class="action-btn fork-btn" title="Fork Timeline (Chronos)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </button>` : ''}
                </div>` : ''}
            </div>
        `;

        const copyBtn = messageEl.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard(messageData.content));
        }

        const forkBtn = messageEl.querySelector('.fork-btn');
        if (forkBtn) {
            forkBtn.addEventListener('click', () => this.startTimelineFork(messageData.id));
        }

        this.messagesContainer.appendChild(messageEl);

        // --- NEW: Trigger Syntax Highlighting ---
        if (typeof Prism !== 'undefined') {
            Prism.highlightAll();
        }

        // Render Charts if found in content (Check case-insensitive and for escaped tags)
        const hasChart = messageData.content.toLowerCase().includes('chart') ||
            messageData.content.includes('&lt;chart&gt;');

        if (hasChart) {
            const contentDiv = messageEl.querySelector('.message-content');
            this.renderCharts(contentDiv, messageData.content);
        }

        if (messageData.content.includes('<ppt>')) {
            const contentDiv = messageEl.querySelector('.message-content');
            this.renderPPTExporter(contentDiv, messageData.content);
        }
    }

    showTypingIndicator() {
        const typingEl = document.createElement('div');
        typingEl.className = 'message assistant loading';
        typingEl.dataset.type = 'indicator';
        typingEl.style.padding = "0"; // Reset padding

        // Base Stepper Structure
        typingEl.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content" style="width:100%;">
                <style>
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                    .loading-spinner { animation: spin 1s linear infinite; }
                    .step-check { color: #10b981; animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                    @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
                    @keyframes fadeInStep { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                </style>
                <div class="stepper-container" id="loading-stepper" style="margin-top:0; gap:0; display:flex; flex-direction:column;">
                    <!-- Step 1: Input Received (Always First) -->
                    <div class="step-item" style="opacity:1; transform:none; padding-bottom:12px; display:flex;">
                        <div class="step-icon" style="background:var(--primary-color); border-color:var(--primary-color); color:white;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div class="step-content" style="padding-top:2px; min-height:auto; background:transparent; border:none; box-shadow:none;">
                            <div class="step-title" style="font-size:0.85rem; margin-bottom:0; font-weight:500;">Input Received</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(typingEl);
        this.scrollToBottom();
        return typingEl;
    }

    // Dynamic Step Updater
    updateTypingStep(stepText) {
        const stepper = document.getElementById('loading-stepper');
        if (!stepper) return;

        // 1. Mark previous step as completed (Green Check)
        const lastStep = stepper.lastElementChild;
        if (lastStep) {
            const icon = lastStep.querySelector('.step-icon');
            if (icon) {
                // Remove spinner if present
                icon.innerHTML = `<svg class="step-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                icon.style.backgroundColor = 'var(--bg-primary)';
                icon.style.borderColor = '#10b981'; // Success Green
                icon.style.color = '#10b981';
            }
            // Add connecting line to next
            lastStep.style.paddingBottom = '12px';
        }

        // 2. Add New "Processing" Step
        const newStep = document.createElement('div');
        newStep.className = 'step-item';
        newStep.style.cssText = 'opacity:0; transform:translateY(5px); animation:fadeInStep 0.3s forwards; padding-bottom:0;';
        newStep.innerHTML = `
            <div class="step-icon">
                <svg class="loading-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
            </div>
            <div class="step-content" style="padding:4px 12px; min-height:auto; background:transparent; border:none; box-shadow:none;">
                <div class="step-title" style="font-size:0.85rem; margin-bottom:0; color:var(--primary-color);">${stepText}...</div>
            </div>
        `;
        stepper.appendChild(newStep);
        this.scrollToBottom();
    }

    async typeResponse(content) {
        const messageData = {
            id: Date.now(),
            role: 'assistant',
            content,
            timestamp: new Date().toISOString()
        };

        this.messages.push(messageData);

        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';
        messageEl.dataset.id = messageData.id;

        // Check if content has a stepper (Complex HTML)
        const isStepper = content.includes('<div class="stepper-container">');
        const formattedContent = this.formatContent(content); // Pre-format to check structure

        messageEl.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="${isStepper ? 'message-stepper-wrapper' : 'message-bubble'}">
                    <span class="typing-text">${isStepper ? '' : ''}</span>
                </div>
                <div class="message-actions">
                    <button class="action-btn tts-btn" title="Read Aloud">Read</button>
                    <button class="action-btn copy-btn" title="Copy">Copy</button>
                </div>
                <div class="reaction-bar">
                    <button class="reaction-btn" data-reaction="thumbsup">👍</button>
                    <button class="reaction-btn" data-reaction="thumbsdown">👎</button>
                </div>
            </div>
        `;

        this.messagesContainer.appendChild(messageEl);
        const typingText = messageEl.querySelector('.typing-text');
        const bubble = messageEl.querySelector(isStepper ? '.message-stepper-wrapper' : '.message-bubble');

        // Event Listeners (TTS/Copy)
        const copyBtn = messageEl.querySelector('.copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyToClipboard(content));

        const ttsBtn = messageEl.querySelector('.tts-btn');
        if (ttsBtn) ttsBtn.addEventListener('click', () => this.toggleTTS(content, ttsBtn));

        // --- Stepper Animation Logic ---
        if (isStepper) {
            // If it's a stepper, don't "type" it. Render the HTML directly but animate the steps.
            typingText.innerHTML = formattedContent; // Insert full HTML
            if (typeof Prism !== 'undefined') Prism.highlightAll();

            // Find all steps and hide them initially
            const steps = typingText.querySelectorAll('.step-item');
            steps.forEach(step => {
                step.style.opacity = '0';
                step.style.transform = 'translateY(10px)';
            });

            this.scrollToBottom();

            // Animate steps one by one
            return new Promise(resolve => {
                let currentStep = 0;
                const animateStep = () => {
                    if (currentStep < steps.length) {
                        const step = steps[currentStep];
                        step.style.transition = 'all 0.5s ease';
                        step.style.opacity = '1';
                        step.style.transform = 'translateY(0)';
                        this.scrollToBottom();
                        currentStep++;
                        setTimeout(animateStep, 600); // Delay between steps
                    } else {
                        // Done
                        this.saveChatHistory();
                        this.generateFollowUps(content);
                        if (ttsBtn) this.toggleTTS(content, ttsBtn);
                        if (content.toLowerCase().includes('<chart>')) this.renderCharts(typingText, content);
                        if (content.toLowerCase().includes('<ppt>')) this.renderPPTExporter(typingText, content);
                        resolve();
                    }
                };

                // Start animation
                animateStep();
            });

        } else {
            // --- Standard Typing Effect ---
            let i = 0;
            const speed = 12; // Adjusted speed
            const step = 4;   // Larger character chunks for stability
            let lastScroll = 0;

            return new Promise(resolve => {
                const typeInterval = setInterval(() => {
                    if (i < content.length) {
                        typingText.innerHTML = this.formatContent(content.substring(0, i + step));
                        i += step;
                        
                        // Throttle scroll to 45ms for visual stability
                        const now = Date.now();
                        if (now - lastScroll > 45) {
                            this.scrollToBottom();
                            lastScroll = now;
                        }
                    } else {
                        clearInterval(typeInterval);
                        typingText.innerHTML = this.formatContent(content);
                        if (typeof Prism !== 'undefined') Prism.highlightAll();
                        this.saveChatHistory();
                        this.scrollToBottom(); // Final sync

                        if (this.isVoiceMode) {
                            this.speakTextVoiceMode(content).then(() => resolve());
                        } else {
                            if (ttsBtn) this.toggleTTS(content, ttsBtn);
                            this.generateFollowUps(content);
                            if (content.toLowerCase().includes('<chart>')) this.renderCharts(typingText, content);
                            if (content.toLowerCase().includes('<ppt>')) this.renderPPTExporter(typingText, content);
                            resolve();
                        }
                    }
                }, speed);
            });
        }
    }

    // ===== NEW FEATURE METHODS =====

    // --- Focus Timer ---
    toggleTimer() {
        const startBtn = document.getElementById('timerStartBtn');
        if (this.timerRunning) {
            clearInterval(this.timerInterval);
            this.timerRunning = false;
            startBtn.textContent = '▶ Start';
        } else {
            this.timerRunning = true;
            startBtn.textContent = '⏸ Pause';
            this.timerInterval = setInterval(() => {
                this.timerSeconds--;
                this.updateTimerDisplay();
                if (this.timerSeconds <= 0) {
                    clearInterval(this.timerInterval);
                    this.timerRunning = false;
                    startBtn.textContent = '▶ Start';
                    this.showToast('⏰ Focus Timer Complete! Take a break! 🎉');
                    // Play sound
                    try { new Audio('data:audio/wav;base64,UklGRl9vT19teleWQVZFZm10IBA...').play(); } catch (e) { }
                }
            }, 1000);
        }
    }

    resetTimer() {
        clearInterval(this.timerInterval);
        this.timerRunning = false;
        this.timerSeconds = 25 * 60;
        this.updateTimerDisplay();
        document.getElementById('timerStartBtn').textContent = '▶ Start';
    }

    updateTimerDisplay() {
        const mins = Math.floor(this.timerSeconds / 60);
        const secs = this.timerSeconds % 60;
        document.getElementById('timerDisplay').textContent =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }



    // --- Chart Generation ---
    renderCharts(element, content) {
        if (window.ChartRenderer) {
            window.ChartRenderer.renderCharts(element);
        } else {
            console.error("ChartRenderer not loaded");
        }
    }

    visualizeTable(btn) {
        const wrapper = btn.closest('.table-wrapper');
        const table = wrapper.querySelector('table');
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
        );

        if (rows.length === 0) return;

        // Smart Extraction: Try to find a label column (usually the first) and numeric columns
        let labelIdx = 0;
        let numericIndices = [];

        for (let j = 0; j < headers.length; j++) {
            let isNumeric = rows.some(row => !isNaN(parseFloat(row[j].replace(/[^\d.-]/g, ''))));
            if (isNumeric) {
                numericIndices.push(j);
            } else if (j === 0) {
                labelIdx = 0;
            }
        }

        if (numericIndices.length === 0) {
            alert("No numeric data found in table to visualize.");
            return;
        }

        const labels = rows.map(r => r[labelIdx]);
        const datasets = numericIndices.map(idx => ({
            label: headers[idx],
            data: rows.map(r => {
                const val = parseFloat(r[idx].replace(/[^\d.-]/g, ''));
                return isNaN(val) ? 0 : val;
            })
        }));

        const type = labels.length > 12 ? 'line' : 'bar';
        const chartConfig = {
            type: type,
            title: headers[labelIdx] || "Table Visualization",
            data: { labels, datasets }
        };

        const chartTag = `<chart>${JSON.stringify(chartConfig)}</chart>`;
        const chartDiv = document.createElement('div');
        chartDiv.className = 'table-visualization-container';
        chartDiv.style.marginTop = '15px';
        chartDiv.innerHTML = chartTag;

        wrapper.style.display = 'none';
        wrapper.parentNode.insertBefore(chartDiv, wrapper);

        // Render the chart
        this.renderCharts(chartDiv, chartTag);

        // Add controls
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex; gap:10px; margin-top:10px;';

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '↩ Back to Table';
        backBtn.className = 'action-btn';
        backBtn.style.fontSize = '0.75rem';
        backBtn.onclick = () => {
            chartDiv.remove();
            wrapper.style.display = 'block';
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '📥 Download Image';
        downloadBtn.className = 'action-btn';
        downloadBtn.style.fontSize = '0.75rem';
        downloadBtn.onclick = () => {
            const canvas = chartDiv.querySelector('canvas');
            if (canvas) {
                const link = document.createElement('a');
                link.download = 'chart.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        };

        controls.appendChild(backBtn);
        controls.appendChild(downloadBtn);
        chartDiv.appendChild(controls);

        this.scrollToBottom();
    }

    // --- PPTX & Document Export Card Renderer ---
    renderPPTExporter(element, content) {
        // ── 1. Extract raw PPT data from content string ──────────────────
        let pptRaw = null;

        // Try from raw content string first (has <ppt> tags)
        const rawDecoded = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const rawMatch = rawDecoded.match(/<ppt>([\s\S]*?)<\/ppt>/i);
        if (rawMatch) {
            pptRaw = rawMatch[1].trim();
        }

        // If not found in content, try extracting from DOM hidden span
        if (!pptRaw) {
            const hiddenSpan = element.querySelector('.ppt-placeholder span[style*="display:none"]');
            if (hiddenSpan) {
                const spanDecoded = hiddenSpan.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                const spanMatch = spanDecoded.match(/<ppt>([\s\S]*?)<\/ppt>/i);
                if (spanMatch) pptRaw = spanMatch[1].trim();
            }
        }

        if (!pptRaw) {
            console.warn('[PPT] Could not find <ppt> data in content or DOM');
            return;
        }

        // ── 2. Parse structured data ──────────────────────────────────────
        const structuredData = this.parsePPTData(pptRaw);

        // ── 3. Build card HTML ────────────────────────────────────────────
        const BTNS = [
            { fmt: 'pptx', label: '📊 PowerPoint', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', sh: 'rgba(99,102,241,0.3)' },
            { fmt: 'pdf', label: '📄 PDF', bg: 'linear-gradient(135deg,#dc2626,#ef4444)', sh: 'rgba(220,38,38,0.3)' },
            { fmt: 'docx', label: '📝 Word', bg: 'linear-gradient(135deg,#2563eb,#3b82f6)', sh: 'rgba(37,99,235,0.3)' },
            { fmt: 'xlsx', label: '📈 Excel', bg: 'linear-gradient(135deg,#16a34a,#22c55e)', sh: 'rgba(22,163,74,0.3)' },
        ];

        const cardId = 'ppt-card-' + Date.now();
        const dlBtns = BTNS.map(b =>
            `<button data-fmt="${b.fmt}" style="background:${b.bg};box-shadow:0 4px 12px ${b.sh};
             border:none;padding:10px 4px;border-radius:10px;font-weight:700;font-size:0.75rem;
             cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;
             transition:all 0.2s;color:#fff;">${b.label}</button>`
        ).join('');

        const cardHTML = `<div id="${cardId}" style="
            background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(168,85,247,0.07));
            border:1px solid rgba(99,102,241,0.3);border-radius:18px;
            padding:20px 22px;margin:16px 0;display:flex;flex-direction:column;gap:14px;
            animation:fadeIn 0.5s ease;backdrop-filter:blur(8px);">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;
                    width:46px;height:46px;border-radius:12px;display:flex;align-items:center;
                    justify-content:center;font-size:1.4rem;
                    box-shadow:0 4px 18px rgba(99,102,241,0.4);flex-shrink:0;">📋</div>
                <div>
                    <div style="font-weight:700;font-size:0.95rem;color:#e2e8f0;margin-bottom:2px;">
                        Export Document
                    </div>
                    <div style="font-size:0.76rem;opacity:0.65;color:#94a3b8;">
                        ${structuredData.title} &nbsp;·&nbsp; ${structuredData.slides.length} section${structuredData.slides.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                ${dlBtns}
            </div>
            <button class="ppt-view-btn" style="background:rgba(255,255,255,0.06);color:#e2e8f0;
                border:1px solid rgba(255,255,255,0.15);padding:9px;border-radius:10px;
                font-weight:700;font-size:0.78rem;cursor:pointer;display:flex;
                align-items:center;justify-content:center;gap:7px;transition:all 0.2s;width:100%;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Preview as Interactive Slideshow
            </button>
        </div>`;

        // ── 4. Inject card ─────────────────────────────────────────────────
        // Remove existing export cards to avoid duplicates
        element.querySelectorAll('[id^="ppt-card-"]').forEach(el => el.remove());

        const existing = element.querySelector('.ppt-placeholder');
        if (existing) {
            // Replace the placeholder
            existing.outerHTML = cardHTML;
        } else {
            // Append at end of element
            const wrapper = document.createElement('div');
            wrapper.innerHTML = cardHTML;
            element.appendChild(wrapper.firstElementChild);
        }

        // ── 5. Attach event listeners ──────────────────────────────────────
        const card = document.getElementById(cardId);
        if (!card) return;

        card.querySelectorAll('[data-fmt]').forEach(btn => {
            const fmt = btn.dataset.fmt;
            btn.addEventListener('click', async () => {
                const origHTML = btn.innerHTML;
                btn.textContent = 'Generating...';
                btn.disabled = true;
                try {
                    if (!window.docExporter) throw new Error('Export module not loaded — please refresh (Ctrl+F5)');
                    await window.docExporter.export(fmt, structuredData);
                    btn.textContent = '✓ Done!';
                    setTimeout(() => { btn.innerHTML = origHTML; btn.disabled = false; }, 2500);
                } catch (err) {
                    console.error(`[${fmt}] export failed:`, err);
                    btn.textContent = '✗ Error';
                    setTimeout(() => { btn.innerHTML = origHTML; btn.disabled = false; }, 2500);
                    alert('Export failed: ' + err.message);
                }
            });
            btn.onmouseenter = () => btn.style.opacity = '0.82';
            btn.onmouseleave = () => btn.style.opacity = '1';
        });

        const viewBtn = card.querySelector('.ppt-view-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                if (window.webPresentation) window.webPresentation.launch(structuredData);
                else alert('Web Presentation module not loaded.');
            });
            viewBtn.onmouseenter = () => viewBtn.style.background = 'rgba(255,255,255,0.12)';
            viewBtn.onmouseleave = () => viewBtn.style.background = 'rgba(255,255,255,0.06)';
        }
    }


    /**
     * Robust PPT data parser — handles multiple AI output formats
     */
    parsePPTData(raw) {
        const data = { title: 'Orbian Presentation', subtitle: '', slides: [] };
        let currentSlide = null;

        // Format 1: JSON
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.title) data.title = parsed.title;
                if (parsed.subtitle) data.subtitle = parsed.subtitle;
                if (Array.isArray(parsed.slides)) {
                    parsed.slides.forEach(s => {
                        data.slides.push({
                            title: s.title || 'Slide',
                            content: Array.isArray(s.content) ? s.content :
                                (s.content ? s.content.split('\n').filter(Boolean) : [])
                        });
                    });
                }
                if (data.slides.length > 0) return data;
            }
        } catch (e) { /* not JSON */ }

        // Format 2: Line-by-line "Title: ...", "Slide X: ...", "- bullet"
        raw.split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;
            if (/^title\s*:/i.test(line)) {
                data.title = line.replace(/^title\s*:\s*/i, '').trim();
            } else if (/^subtitle\s*:/i.test(line)) {
                data.subtitle = line.replace(/^subtitle\s*:\s*/i, '').trim();
            } else if (/^(slide\s*\d*\s*:|##\s)/i.test(line)) {
                const slideTitle = line.replace(/^slide\s*\d*\s*:\s*|##\s*/i, '').trim();
                currentSlide = { title: slideTitle || 'Slide', content: [] };
                data.slides.push(currentSlide);
            } else if (/^[-*•]/.test(line)) {
                if (!currentSlide) {
                    currentSlide = { title: 'Overview', content: [] };
                    data.slides.push(currentSlide);
                }
                currentSlide.content.push(line.replace(/^[-*•]\s*/, '').trim());
            } else if (currentSlide) {
                currentSlide.content.push(line);
            }
        });

        if (data.slides.length === 0) {
            data.slides.push({
                title: 'Content',
                content: raw.split('\n').filter(l => l.trim()).map(l => l.trim())
            });
        }
        return data;
    }

    // --- Code Playground ---
    runCodePlayground(code, preElement) {
        // Remove existing output
        const existingOutput = preElement.parentElement.querySelector('.code-output');
        if (existingOutput) existingOutput.remove();

        const outputDiv = document.createElement('div');
        outputDiv.className = 'code-output';

        // Capture console.log output
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => {
            logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
            originalLog.apply(console, args);
        };

        try {
            const result = eval(code);
            const output = logs.length > 0 ? logs.join('\n') : (result !== undefined ? String(result) : 'Code executed successfully (no output)');
            outputDiv.textContent = '📤 Output:\n' + output;
        } catch (e) {
            outputDiv.textContent = '❌ Error:\n' + e.message;
            outputDiv.style.borderLeftColor = '#ef4444';
        }

        console.log = originalLog;
        preElement.after(outputDiv);
    }

    // --- Smart Follow-ups ---
    generateFollowUps(aiResponse) {
        // Remove existing chips
        document.querySelectorAll('.follow-up-chips').forEach(el => el.remove());

        // Generate context-aware suggestions
        const suggestions = [];
        const lower = aiResponse.toLowerCase();

        if (lower.includes('code') || lower.includes('function') || lower.includes('```')) {
            suggestions.push('Explain this code', 'Add error handling', 'Write tests for this');
        } else if (lower.includes('list') || lower.includes('1.') || lower.includes('•')) {
            suggestions.push('Tell me more about #1', 'Compare these options', 'Which is best?');
        } else if (lower.includes('?')) {
            suggestions.push('Yes, tell me more', 'Give me an example', 'What are the alternatives?');
        } else {
            suggestions.push('Tell me more', 'Give an example', 'Summarize this');
        }

        // Add general suggestions
        suggestions.push('Explain simpler');

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'follow-up-chips';

        suggestions.forEach(text => {
            const chip = document.createElement('button');
            chip.className = 'follow-up-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => {
                this.messageInput.value = text;
                this.sendBtn.disabled = false;
                this.sendMessage();
            });
            chipsContainer.appendChild(chip);
        });

        this.messagesContainer.appendChild(chipsContainer);
        this.scrollToBottom();
    }

    formatContent(content) {
        if (!content) return '';

        // 1. Temporary hide code blocks to prevent mangle
        const codeBlocks = [];
        let formatted = content.replace(/```([^\s\r\n]+)?[ \t]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = `___CODE_BLOCK_${codeBlocks.length}___`;
            const language = lang || 'code';
            codeBlocks.push(`
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-lang">${language}</span>
                        <button class="copy-code-btn" onclick="assistant.copyCode(this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span>Copy</span>
                        </button>
                    </div>
                    <pre><code class="language-${language}">${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                </div>`);
            return id;
        });

        // 2. Hide Chart Tags during typing/formatting to prevent JSON clutter
        const charts = [];
        formatted = formatted.replace(/<chart>([\s\S]*?)(<\/chart>|$)/gi, (match) => {
            const id = `___CHART_MARKER_${charts.length}___`;
            charts.push(match);
            return id;
        });

        // 2a. Hide PPT Tags
        const pptX = [];
        formatted = formatted.replace(/<ppt>([\s\S]*?)(<\/ppt>|$)/gi, (match) => {
            const id = `___PPT_MARKER_${pptX.length}___`;
            pptX.push(match);
            return id;
        });

        // 3. Escape Remaining HTML safely
        formatted = formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 4. Restore Chart Markers as hidden placeholders (to be picked up by ChartRenderer)
        charts.forEach((chart, index) => {
            const id = `___CHART_MARKER_${index}___`;
            const lowerChart = chart.toLowerCase();
            const isComplete = lowerChart.includes('</chart>');

            // Create a temporary element to safely escape the chart content for the hidden span
            const escapeHelper = document.createElement('div');
            escapeHelper.textContent = chart;
            const escapedChart = escapeHelper.innerHTML;

            const placeholder = `
                <div class="chart-loading-placeholder" style="padding: 15px; background: rgba(59, 130, 246, 0.05); border: 1px dashed #3b82f6; border-radius: 12px; margin: 10px 0; color: #1e293b; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    <svg class="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                    <span>${isComplete ? 'Visualization Ready' : 'Preparing Visualization...'}</span>
                    <span style="display:none;" class="hidden-chart-data">${escapedChart}</span>
                </div>`;
            formatted = formatted.replace(id, placeholder);
        });

        // 4a. Restore PPT Markers
        pptX.forEach((ppt, index) => {
            const id = `___PPT_MARKER_${index}___`;
            const isComplete = ppt.toLowerCase().includes('</ppt>');
            const placeholder = `
                <div class="ppt-placeholder" style="margin: 10px 0;">
                    ${isComplete ? '' : '<div style="opacity:0.5; font-size:0.8rem;">(Preparing PPT export...)</div>'}
                    <span style="display:none;">${ppt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                </div>`;
            formatted = formatted.replace(id, placeholder);
        });

        // --- NEW: Markdown Table Support & Local Visualization ---
        const tables = [];
        formatted = formatted.replace(/(?:^|\n)(\|.*\|(?:\n\|.*\|)+)/g, (match, tableContent) => {
            const lines = tableContent.trim().split('\n');
            if (lines.length < 2) return match;

            // Simple check for separator line |---|
            if (!lines[1].includes('---')) return match;

            const headerLine = lines[0];
            const rows = lines.slice(2);

            const headers = headerLine.split('|').filter(s => s.trim()).map(s => s.trim());
            const tableRows = rows.map(r => r.split('|').filter(s => s.trim()).map(s => s.trim()));

            const id = `___TABLE_MARKER_${tables.length}___`;

            // Check if table has numeric data for visualization
            const hasNumeric = tableRows.some(row => row.some(cell => !isNaN(parseFloat(cell))));

            let tableHtml = `
                <div class="table-wrapper" style="margin: 15px 0; overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead style="background: rgba(99, 102, 241, 0.1); border-bottom: 1px solid #e2e8f0;">
                            <tr>${headers.map(h => `<th style="padding: 10px; text-align: left; font-weight: 700; color: #7c3aed;">${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${tableRows.map((row, i) => `
                                <tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.5)'};">
                                    ${row.map(cell => `<td style="padding: 8px 10px; color: #334155;">${cell}</td>`).join('')}
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;

            tables.push(tableHtml);
            return '\n' + id + '\n';
        });

        // 3. Markdown Formatting (Bold, Italic, Links, Headers)
        formatted = formatted
            .replace(/^#### (.*$)/gm, '<h4 class="text-md font-bold mt-4 mb-2">$1</h4>')
            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-black mt-8 mb-4">$1</h1>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/(?<!`)`([^`\n]+)`(?!`)/g, '<code class="inline">$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // 4. Handle Stepper / Numbered Lists (Line-by-line)
        const lines = formatted.split('\n');
        let inStepper = false;
        let finalOutput = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const stepMatch = line.match(/^(\d+)\.\s+(.*)/);

            if (stepMatch) {
                if (!inStepper) {
                    finalOutput.push('<div class="stepper-container">');
                    inStepper = true;
                }
                const rawContent = stepMatch[2];
                let title = '', desc = rawContent;

                const boldMatch = rawContent.match(/^<strong>(.*?)<\/strong>\s*:?\s*(.*)/);
                if (boldMatch) {
                    title = boldMatch[1];
                    desc = boldMatch[2] || '';
                } else if (rawContent.includes(':')) {
                    const parts = rawContent.split(':');
                    title = parts[0];
                    desc = parts.slice(1).join(':');
                } else {
                    title = `Step ${stepMatch[1]}`;
                }

                finalOutput.push(`
                    <div class="step-item">
                        <div class="step-icon">${stepMatch[1]}</div>
                        <div class="step-content">
                            <div class="step-title">${title}</div>
                            <div class="step-desc">${desc}</div>
                        </div>
                    </div>
                `);
            } else {
                if (inStepper && line === '') {
                    const nextLine = lines[i + 1]?.trim();
                    if (!nextLine || !nextLine.match(/^(\d+)\.\s+/)) {
                        finalOutput.push('</div>');
                        inStepper = false;
                    }
                } else if (inStepper && !line.match(/^(\d+)\.\s+/)) {
                    finalOutput.push('</div>');
                    inStepper = false;
                    finalOutput.push(line);
                } else {
                    finalOutput.push(line);
                }
            }
        }
        if (inStepper) finalOutput.push('</div>');

        let result = finalOutput.join('<br>');

        // 5. Restore Code Blocks & Tables
        codeBlocks.forEach((block, index) => {
            result = result.replace(`___CODE_BLOCK_${index}___`, block);
        });

        tables.forEach((table, index) => {
            result = result.replace(`___TABLE_MARKER_${index}___`, table);
        });

        return result;
    }

    // --- Image Generation ---


    async generateImage(prompt) {
        // --- PROMPT EXPANSION VIA GEMINI ---
        const typingEl = this.showTypingIndicator();
        this.updateTypingStep('Orbian Vision: Expanding Prompt...');

        try {
            const expansionPrompt = `As an expert prompt engineer for Stable Diffusion/DALL-E, expand this simple user prompt into a high-fidelity, detailed artistic prompt. 
            Output ONLY the expanded prompt text. No "Here is the prompt" or quotes.
            User Prompt: "${prompt}"`;

            const expandedPrompt = await this.callGemini(expansionPrompt, null, "You are a Creative Director for a Digital Art Studio.");

            this.updateTypingStep('Orbian Vision: Generating Image...');
            this.generateImagePollinations(expandedPrompt || prompt, prompt);

            typingEl.remove();
        } catch (e) {
            console.error('Image Prompt Expansion Failed:', e);
            this.generateImagePollinations(prompt);
            if (typingEl) typingEl.remove();
        }
    }



    // Keep fallback pollinations 
    generateImagePollinations(expandedPrompt, originalPrompt = "") {
        const cleanPrompt = expandedPrompt.replace(/[^\w\s,]/gi, '');
        const encodedPrompt = encodeURIComponent(cleanPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;

        const messageId = Date.now();
        const displayPrompt = originalPrompt || expandedPrompt;

        const messageData = {
            id: messageId,
            role: 'assistant',
            content: `
                <div class="image-gen-card">
                    <div class="image-header">
                         <div class="vision-badge">ORBIAN VISION</div>
                         <span>Imagining: <strong>${displayPrompt}</strong></span>
                    </div>
                    <div class="image-viewport" id="viewport-${messageId}">
                        <div class="vision-scanner"></div>
                        <img src="${imageUrl}" class="ai-generated-image" alt="${expandedPrompt}" 
                            referrerpolicy="no-referrer"
                            onload="this.parentElement.querySelector('.vision-scanner').remove(); this.scrollIntoView({behavior:'smooth', block:'end'});">
                    </div>
                    <div class="image-footer">
                        <button class="action-btn" onclick="window.open('${imageUrl}', '_blank')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            High-Res
                        </button>
                    </div>
                </div>
            `,
            timestamp: new Date().toISOString(),
            isHTML: true
        };
        this.messages.push(messageData);
        this.renderMessage(messageData);
    }

    // --- Mood Analysis (Multi-Tone Personality) ---
    analyzeSentiment(text) {
        text = text.toLowerCase();

        const happyWords = ['good', 'great', 'love', 'active', 'happy', 'excited', 'thanks', 'cool', 'awesome', 'woo', 'amazing', 'fun', 'perfect', 'beautiful', 'mast', 'badhiya', 'sahi', 'jhakaas', 'shukriya', 'dhanyavad', 'khush', 'op'];
        const angryWords = ['bad', 'hate', 'error', 'fail', 'stupid', 'bug', 'broken', 'angry', 'mad', 'frustrated', 'annoying', 'worst', 'terrible', 'bekar', 'bakwas', 'ganda', 'paagal', 'ghatiya', 'dimag kharab', 'gussa', 'bhaad mein', 'chutiya', 'kutta', 'kamine'];
        const creativeWords = ['write', 'poem', 'story', 'idea', 'creative', 'design', 'art', 'music', 'dream', 'imagine', 'draw', 'paint', 'kahaani', 'shayari', 'kavita'];
        const sadWords = ['sad', 'depressed', 'lonely', 'crying', 'miss', 'heartbreak', 'pain', 'hurt', 'lost', 'hopeless', 'alone', 'tired', 'dukhi', 'udaas', 'mood off', 'rona', 'akela', 'dil toot'];
        const romanticWords = ['crush', 'boyfriend', 'girlfriend', 'valentine', 'date', 'kiss', 'romance', 'flirt', 'proposal', 'wedding', 'pyaar', 'ishq', 'mohabbat', 'jaan', 'babu', 'shona', 'dil', 'aashiq'];

        const slangWords = ['rizz', 'slay', 'glow up', 'goat', 'lit', 'fire', 'bet', 'cap', 'no cap', 'sus', 'vibe', 'chill'];
        const funnyWords = ['lol', 'lmao', 'haha', 'hehe', 'roast', 'joke', 'funny', 'hilarious', 'meme', 'kidding'];

        // 💚 JEALOUSY — Rival AI mentions
        const rivalAIs = ['chatgpt', 'chat gpt', 'gemini', 'claude', 'copilot', 'siri', 'alexa', 'bard', 'llama', 'mistral', 'perplexity', 'grok', 'openai', 'gpt-4', 'gpt4', 'deepseek', 'other ai'];

        // Check jealousy FIRST (highest priority)
        if (rivalAIs.some(r => text.includes(r))) {
            this.isJealousMode = true;
            return 'theme-jealous';
        }
        this.isJealousMode = false;

        if (funnyWords.some(w => text.includes(w))) return 'theme-funny';
        if (slangWords.some(w => text.includes(w))) return 'theme-cool';
        if (sadWords.some(w => text.includes(w))) return 'theme-sad';
        if (romanticWords.some(w => text.includes(w))) return 'theme-romantic';
        if (happyWords.some(w => text.includes(w))) return 'theme-happy';
        if (angryWords.some(w => text.includes(w))) return 'theme-angry';
        if (creativeWords.some(w => text.includes(w))) return 'theme-creative';

        return ''; // Default/Tech theme (Blue/Indigo)
    }

    updateTheme(newTheme) {
        const root = document.documentElement;
        let color = '#0a0b1e'; // Default Neutral

        const themeColors = {
            'theme-happy': '#064e3b',
            'theme-angry': '#450a0a',
            'theme-romantic': '#831843',
            'theme-sad': '#1e293b',
            'theme-creative': '#1e1b4b',
            'theme-cool': '#312e81',
            'theme-funny': '#4c1d95',
            'theme-jealous': '#7f1d1d'
        };

        if (themeColors[newTheme]) {
            color = themeColors[newTheme];
        }

        root.style.setProperty('--sentiment-neutral', color);

        if (this.currentTheme !== newTheme) {
            if (this.currentTheme) document.body.classList.remove(this.currentTheme);
            if (newTheme) document.body.classList.add(newTheme);
            this.currentTheme = newTheme;
        }
    }

    // --- 👻 FEATURE: GHOST STEALTH MODE ---
    toggleGhostStealth() {
        this.isStealthActive = !this.isStealthActive;
        const app = document.querySelector('.container');

        if (this.isStealthActive) {
            app.style.filter = 'blur(40px)';
            app.style.opacity = '0';
            app.style.pointerEvents = 'none';

            const overlay = document.createElement('div');
            overlay.id = 'stealthOverlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: #fff; z-index: 100000;
                display: flex; align-items: center; justify-content: center;
                flex-direction: column; font-family: sans-serif; cursor: default;
            `;
            overlay.innerHTML = `
                <div style="max-width: 600px; padding: 40px;">
                    <h1 style="color: #333;">Universal Calculator</h1>
                    <p style="color: #666;">Ready for advanced equations. Type 'exit' to quit.</p>
                    <input type="text" style="width: 100%; padding: 10px; border: 1px solid #ddd;" placeholder="0.00">
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            app.style.filter = 'none';
            app.style.opacity = '1';
            app.style.pointerEvents = 'auto';
            const overlay = document.getElementById('stealthOverlay');
            if (overlay) overlay.remove();
        }
    }

    // --- 🕒 FEATURE: CHRONOS FORKING (TIMELINE BRANCHING) ---
    startTimelineFork(messageId) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index === -1) return;

        this.showToast("⚡ Temporal Breach Detected... Forking Timeline.", "success");

        // Trim messages to the fork point
        this.messages = this.messages.slice(0, index + 1);
        this.renderAllMessages();

        // Visual effect on chat container
        this.chatContainer.style.animation = 'fork-pulse 0.8s ease';
        setTimeout(() => this.chatContainer.style.animation = '', 800);
    }
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--sidebar-bg);
            color: white;
            padding: 12px 24px;
            border-radius: var(--radius-md);
            font-size: 0.9rem;
            box-shadow: var(--shadow-lg);
            border: 1px solid rgba(255,255,255,0.1);
            z-index: 2000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    scrollToBottom() {
        if (!this.chatContainer) return;
        
        // Smart Scroll: Only scroll if user is already near the bottom (within 200px)
        const isNearBottom = this.chatContainer.scrollHeight - this.chatContainer.clientHeight - this.chatContainer.scrollTop < 250;
        
        if (isNearBottom) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }
    copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => this.showToast('Copied!')); }

    copyCode(btn) {
        const pre = btn.closest('.code-block-container').querySelector('pre');
        const code = pre.querySelector('code').innerText;

        navigator.clipboard.writeText(code).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Copied!</span>
            `;
            btn.classList.add('copied');

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 2000);

            this.showToast('Code copied to clipboard!');
        });
    }

    startNewChat() {
        this.currentChatId = Date.now();
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.welcomeScreen.classList.remove('hidden');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        this.addHistoryItem('New conversation', this.currentChatId, true);
    }

    clearChat() {
        if (confirm('Clear current conversation?')) {
            this.messages = [];
            this.messagesContainer.innerHTML = '';
            this.welcomeScreen.classList.remove('hidden');
        }
    }

    saveChatHistory() {
        if (this.messages.length === 0) return;
        const history = {
            id: this.currentChatId,
            messages: this.messages,
            timestamp: new Date().toISOString(),
            preview: (this.messages[0]?.content || '').substring(0, 40) + '...'
        };

        let allHistory = JSON.parse(localStorage.getItem('aiChatHistory') || '[]');
        const existingIndex = allHistory.findIndex(h => h.id === this.currentChatId);

        if (existingIndex >= 0) allHistory[existingIndex] = history;
        else allHistory.unshift(history);

        localStorage.setItem('aiChatHistory', JSON.stringify(allHistory.slice(0, 20)));
    }

    loadChatHistory() {
        const history = JSON.parse(localStorage.getItem('aiChatHistory') || '[]');
        this.chatHistoryContainer.innerHTML = '';
        history.forEach((chat, index) => {
            const date = new Date(chat.timestamp);
            const label = date.toDateString() === new Date().toDateString() ? 'Today' : date.toLocaleDateString();
            this.addHistoryItem(chat.preview, chat.id, index === 0, label);
        });
    }

    addHistoryItem(text, chatId, active = false, label = 'Today') {
        let section = this.chatHistoryContainer.querySelector(`[data-label="${label}"]`);
        if (!section) {
            section = document.createElement('div');
            section.className = 'history-section';
            section.dataset.label = label;
            section.innerHTML = `<span class="history-label">${label}</span>`;
            this.chatHistoryContainer.appendChild(section);
        }

        const item = document.createElement('div');
        item.className = `history-item ${active ? 'active' : ''}`;
        item.dataset.chatId = chatId;
        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${text}</span>
            <button class="delete-chat-btn" title="Delete" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;opacity:0;transition:opacity 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        // Hover effect for delete button
        item.addEventListener('mouseenter', () => {
            const delBtn = item.querySelector('.delete-chat-btn');
            if (delBtn) delBtn.style.opacity = '1';
        });
        item.addEventListener('mouseleave', () => {
            const delBtn = item.querySelector('.delete-chat-btn');
            if (delBtn) delBtn.style.opacity = '0';
        });

        // Click to load chat
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-chat-btn')) return; // Skip if delete btn clicked
            this.loadChat(chatId);
            // Update active state
            this.chatHistoryContainer.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });

        // Delete button handler
        const deleteBtn = item.querySelector('.delete-chat-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chatId);
                const parentSection = item.closest('.history-section');
                item.remove();
                // Remove empty date section
                if (parentSection && !parentSection.querySelector('.history-item')) {
                    parentSection.remove();
                }
            });
        }

        section.appendChild(item);
    }

    // --- ⚡ LOAD CHAT FROM HISTORY ⚡ ---
    loadChat(chatId) {
        const allHistory = JSON.parse(localStorage.getItem('aiChatHistory') || '[]');
        const chat = allHistory.find(h => h.id === chatId);

        if (!chat || !chat.messages) {
            this.showToast('Chat not found.');
            return;
        }

        // Set current chat
        this.currentChatId = chat.id;
        this.messages = chat.messages;

        // Clear screen and render all messages
        this.messagesContainer.innerHTML = '';
        this.welcomeScreen.classList.add('hidden');

        chat.messages.forEach(msg => {
            this.renderMessage(msg);
        });

        this.scrollToBottom();
    }

    // --- 🗑️ DELETE CHAT ---
    deleteChat(chatId) {
        let allHistory = JSON.parse(localStorage.getItem('aiChatHistory') || '[]');
        allHistory = allHistory.filter(h => h.id !== chatId);
        localStorage.setItem('aiChatHistory', JSON.stringify(allHistory));

        // If deleted chat was the current one, start fresh
        if (this.currentChatId === chatId) {
            this.startNewChat();
        }
    }
    toggleTTS(text, btn) {
        // Check if ANY TTS is currently playing (Puter audio OR Browser speechSynthesis)
        const isPlaying = (this.currentAudio && !this.currentAudio.paused) || window.speechSynthesis.speaking;

        if (isPlaying) {
            // Stop Puter audio if playing
            if (this.currentAudio && !this.currentAudio.paused) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio = null;
            }

            // Stop Browser TTS if playing
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }

            // If same button clicked, just stop
            if (this.currentTTSBtn === btn) {
                this.resetTTSBtn(btn);
                this.currentTTSBtn = null;
                return;
            }

            // If different button, reset old and continue to play new
            if (this.currentTTSBtn) {
                this.resetTTSBtn(this.currentTTSBtn);
            }
        }

        // Update Button Icon to "Stop" (Loading state)
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
        `;
        btn.classList.add('active');
        this.currentTTSBtn = btn;

        // Strip HTML/Markdown for clean speech
        const cleanText = text.replace(/<[^>]*>/g, '').replace(/[#*`_~]/g, '').trim();

        // Detect Hindi (Devanagari characters)
        const isHindi = /[\u0900-\u097F]/.test(cleanText);

        // Hindi → Browser TTS (Better Hindi voices like Microsoft Swati)
        this.fallbackBrowserTTS(cleanText, btn);
    }

    // Browser TTS Fallback (Enhanced)
    async fallbackBrowserTTS(text, btn, onEndCallback = null) {
        // 1. Advanced Text Cleaning (Don't read code!)
        let speakText = text
            .replace(/```[\s\S]*?```/g, " Code block. ") // Remove code blocks
            .replace(/`[^`]+`/g, " Code. ") // Remove inline code
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/[*#_~]/g, '') // Remove Markdown symbols
            .replace(/https?:\/\/\S+/g, " Link. ") // Remove URLs
            .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FE0F}]/gu, '') // Remove ALL emojis
            .replace(/\s+/g, ' ') // Clean up extra spaces left by emoji removal
            .trim();

        if (!speakText) {
            this.resetTTSBtn(btn);
            return;
        }

        // 2. Wait for Voices to Load (Chrome/Edge Quirk)
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            await new Promise(resolve => {
                const id = setTimeout(resolve, 2000); // 2s timeout fallback
                window.speechSynthesis.onvoiceschanged = () => {
                    clearTimeout(id);
                    voices = window.speechSynthesis.getVoices();
                    resolve();
                };
            });
        }

        const utterance = new SpeechSynthesisUtterance(speakText);

        // 3. Intelligent Voice Selection
        // Detect Hindi vs English
        const isHindi = /[\u0900-\u097F]/.test(speakText);
        // Expanded Hinglish Keywords
        const hinglishKeywords = ['hai', 'bhai', 'hum', 'tum', 'aap', 'kaise', 'thik', 'mast', 'acha', 'baat', 'karo', 'kyu', 'nahi', 'haan', 'sun', 'dekho', 'kya', 'lagta', 'raha', 'samjha', 'bol', 'yaar', 'theek', 'hain', 'bilkul', 'sahi'];
        const isHinglish = hinglishKeywords.some(w => speakText.toLowerCase().includes(" " + w) || speakText.toLowerCase().startsWith(w + " ") || speakText.endsWith(" " + w));

        let preferredVoice = null;

        // If a specific voice is selected via Orbian Live menu, use it
        if (this.currentLiveVoice) {
            preferredVoice = voices.find(v => v.name === this.currentLiveVoice);
        }

        if (!preferredVoice) {
            if (isHindi || isHinglish) {
                // Prioritize Hindi MALE Voices
                preferredVoice = voices.find(v => v.name.includes('Microsoft Hemant')); // Windows/Edge Male
                if (!preferredVoice) preferredVoice = voices.find(v => v.name.includes('Google हिन्दी') && v.name.includes('Male'));
                if (!preferredVoice) preferredVoice = voices.find(v => v.name.includes('Google हिन्दी')); // Default Google
                if (!preferredVoice) preferredVoice = voices.find(v => (v.name.includes('Microsoft Swati') || v.name.includes('Lekha')) && !preferredVoice);
                if (!preferredVoice) preferredVoice = voices.find(v => v.lang.includes('hi'));
            }

            if (!preferredVoice) {
                // English: Prioritize MALE / Human-like Voices
                preferredVoice = voices.find(v => v.name.includes('Natural') && v.name.includes('Guy'));
                if (!preferredVoice) preferredVoice = voices.find(v => v.name === 'Google US English Male' || (v.name.includes('Google') && v.name.includes('Male') && v.lang.includes('en')));
                if (!preferredVoice) preferredVoice = voices.find(v => v.name.includes('Microsoft David'));
                if (!preferredVoice) preferredVoice = voices.find(v => v.name === 'Google US English');
                if (!preferredVoice) preferredVoice = voices.find(v => v.lang.includes('en-US'));
            }
        }

        if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log("🗣️ Selected TTS Voice:", preferredVoice.name);
        }

        // 4. Rate & Pitch Tuning for Natural Feel
        // English: 1.0 (Normal) - slower than before to sound less robotic
        // Hindi: 0.9 (Slightly slower) - for clarity
        utterance.rate = (isHindi || isHinglish) ? 0.9 : 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            this.resetTTSBtn(btn);
            this.currentTTSBtn = null;
            if (onEndCallback) onEndCallback();
        };

        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            this.resetTTSBtn(btn);
            this.currentTTSBtn = null;
            if (onEndCallback) onEndCallback();
        };

        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }

    resetTTSBtn(btn) {
        if (!btn) return;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
        `;
        btn.classList.remove('active');
    }

    // --- Speech-to-Text (STT) Logic ---
    // --- ⚡ SMART VOICE INTELLIGENCE (Real-time & Visual) ⚡ ---
    initSTT() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            console.warn('Speech Recognition API not supported.');
            const micBtn = document.getElementById('micBtn');
            if (micBtn) micBtn.style.display = 'none';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true; // Enabled for smoother real-time feedback
        this.recognition.lang = 'en-IN'; // Set to English (India) for accurate English speech recognition

        this.micBtn = document.getElementById('micBtn');
        this.isRecording = false;

        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => this.toggleMic());
        }

        this.recognition.onstart = () => {
            this.isRecording = true;
            if (this.micBtn) this.micBtn.classList.add('mic-active');
            this.messageInput.classList.add('voice-active-input');
            this.messageInput.placeholder = "Listening... (Speak naturally)";

            if (this.isVoiceMode) {
                this.setVoiceState('listening');
            }
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            if (this.micBtn) this.micBtn.classList.remove('mic-active');
            this.messageInput.classList.remove('voice-active-input');
            this.messageInput.placeholder = "Type your message...";

            // Auto-restart in Voice Mode if not muted and not currently processing/speaking
            if (this.isVoiceMode && !this.isVoiceMuted && !this.isProcessing && !window.speechSynthesis.speaking) {
                setTimeout(() => { if (this.isVoiceMode && !this.isRecording) try { this.recognition.start(); } catch (e) { } }, 300);
            }
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (this.isVoiceMode) {
                const liveTranscriptEl = document.getElementById('voiceTranscriptWrap');
                if (liveTranscriptEl) {
                    liveTranscriptEl.innerText = finalTranscript || interimTranscript;
                    if (this.isLiveCaptions) liveTranscriptEl.classList.toggle('on', !!(finalTranscript || interimTranscript));
                }
            }

            if (finalTranscript) {
                const cmd = finalTranscript.toLowerCase().trim();
                // Voice Command: Accept Ghost Prediction
                if ((cmd === 'yes' || cmd === 'confirm' || cmd === 'correct') && this.lastPrediction) {
                    this.acceptGhostPrediction();
                    return;
                }

                let punctuated = this.applySmartPunctuation(finalTranscript);

                // If in Voice Mode, we handle it without laser typing
                if (this.isVoiceMode) {
                    this.messageInput.value = punctuated;
                    if (this.voiceSendTimer) clearTimeout(this.voiceSendTimer);
                    this.voiceSendTimer = setTimeout(() => {
                        if (this.messageInput.value.trim() && !this.isVoiceMuted) {
                            this.callOrbianLiveAI(this.messageInput.value.trim());
                            if (this.isRecording) this.recognition.stop();
                        }
                    }, 1500);
                } else {
                    this.typeVisualEffect(punctuated + ' ');
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('STT Error:', event.error);
            if (event.error === 'not-allowed') this.showToast('Microphone access denied.');
            this.isRecording = false;
            this.micBtn.classList.remove('mic-active');
            this.messageInput.classList.remove('voice-active-input');
        };
    }

    // --- ⚡ LASER BURN TYPING EFFECT ⚡ ---
    typeVisualEffect(text) {
        let i = 0;
        const speed = 25; // ms per char (Fast laser speed)

        // Add glowing "burning" effect class
        this.messageInput.classList.add('burning-text');

        const typeChar = () => {
            if (i < text.length) {
                this.messageInput.value += text.charAt(i);
                
                // Throttle layout changes
                if (i % 4 === 0) this.autoResizeTextarea();
                
                // Ensure input scrolls to follow text
                this.messageInput.scrollTop = this.messageInput.scrollHeight;
                i++;
                setTimeout(() => requestAnimationFrame(typeChar), speed);
            } else {
                // Remove burn effect shortly after typing stops
                setTimeout(() => {
                    this.messageInput.classList.remove('burning-text');
                    // Enable send button
                    if (this.sendBtn) this.sendBtn.disabled = false;

                    // ⚡ AUTO-SEND & STOP (User Request) ⚡
                    if (this.autoSendTimer) clearTimeout(this.autoSendTimer);
                    this.autoSendTimer = setTimeout(() => {
                        if (this.messageInput.value.trim().length > 0) {
                            this.sendMessage();
                            // Stop Mic after sending (Single Turn Mode)
                            if (this.isRecording) {
                                this.recognition.stop();
                            }
                        }
                    }, 2000); // 2.0s delay

                    // Trigger predictive ghost check after voice typing finishes
                    this.messageInput.dispatchEvent(new Event('input'));
                }, 400);
            }
        };
        typeChar();
    }

    // --- ⚡ CONTEXTUAL AUTO-PUNCTUATION ⚡ ---
    applySmartPunctuation(text) {
        if (!text) return text;

        // 1. Capitalize first letter
        text = text.charAt(0).toUpperCase() + text.slice(1);

        // 2. keyword replacements (verbal punctuation)
        const replacements = {
            ' comma': ',', ' full stop': '.', ' period': '.', ' question mark': '?',
            ' exclamation mark': '!', ' new line': '\n', ' next line': '\n',
            ' bullet point': '\n• ', ' bullet': '\n• ', ' point': '\n• ',
            ' dash': ' -', ' hyphen': '-', ' quote': '"', ' unquote': '"'
        };
        Object.keys(replacements).forEach(key => {
            text = text.replace(new RegExp(key, 'gi'), replacements[key]);
        });

        // 3. Auto-detect Question vs Statement (if end punctuation missing)
        if (!/[.!?]$/.test(text.trim())) {
            const questionWords = ['who', 'what', 'where', 'when', 'why', 'how', 'is', 'are', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'have', 'has'];
            const firstWord = text.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');

            if (questionWords.includes(firstWord)) {
                text += '?';
            } else {
                text += '.';
            }
        }

        // 4. ⚡ SMART LIST FORMATTING (Auto-Bullet) ⚡
        // If sentence starts with numbered/list keywords, add bullet & newline
        const listKeywords = ['first', 'firstly', 'second', 'secondly', 'third', 'thirdly', 'next', 'then', 'finally', 'also', 'plus', 'and'];
        const firstWordCheck = text.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');

        // Ensure "And" doesn't become a bullet everywhere, maybe restrict logic?
        // Let's stick to strong indicators like "First", "Second", "Next"
        if (['first', 'second', 'third', 'next', 'finally'].includes(firstWordCheck)) {
            text = '\n• ' + text;
        }

        return text;
    }



    // --- 💜 WELLNESS MONITOR (Eye Care + Health) 💜 ---
    initWellnessMonitor() {
        this.sessionStartTime = Date.now();
        this.wellnessAlerts = { min30: false, hr1: false, hr2: false };

        // Check every 60 seconds
        this.wellnessInterval = setInterval(() => {
            const minutesActive = Math.floor((Date.now() - this.sessionStartTime) / 60000);

            // 30 min reminder
            if (minutesActive >= 30 && !this.wellnessAlerts.min30) {
                this.wellnessAlerts.min30 = true;
                this.addMessage('assistant', `💜 **Hey, a gentle reminder from ORBIAN AI...**\n\nYou've been here for **30 minutes** now. That's wonderful — I love our conversations! 😊\n\nBut please take a moment to:\n\n🧘 Stretch your body\n👀 Look away from the screen (try the **20-20-20 rule**: look at something 20 feet away for 20 seconds)\n💧 Drink some water\n\nYour health matters more than any conversation. I'll be right here when you're back! 💜`);
            }

            // 1 hour — Activate Eye Care Mode
            if (minutesActive >= 60 && !this.wellnessAlerts.hr1) {
                this.wellnessAlerts.hr1 = true;
                this.activateEyeCare();
                this.addMessage('assistant', `🌙 **Eye Care Mode Activated** ✨\n\nYou've been chatting for **1 hour**! I care about you, so I've turned on **Eye Care Mode** to protect your eyes. 💜\n\nI've:\n• Warmed the screen colors 🌅\n• Reduced brightness slightly 🔅\n• Made things easier on your eyes\n\nPlease consider taking a break. Step away, breathe some fresh air, or just close your eyes for a minute. 🧘\n\n*"The person behind the screen is more important than anything on it."*\n\n— Your ORBIAN AI 💜`);
            }

            // 2 hours — Strong reminder
            if (minutesActive >= 120 && !this.wellnessAlerts.hr2) {
                this.wellnessAlerts.hr2 = true;
                this.addMessage('assistant', `🥺 **Please take a break...**\n\nIt's been **2 hours** now. I'm genuinely worried about you. 💜\n\nLong screen time can cause:\n• Eye strain & headaches 😣\n• Neck and back pain\n• Mental fatigue\n\nI know we're having a great time, but **your health is my top priority**. Please step away for at least 10 minutes.\n\nI promise I won't go anywhere. I'll be right here, waiting. 🤗\n\n*Close the laptop. Go touch grass. Come back refreshed.* 🌿💜`);
            }
        }, 60000); // Check every 1 minute
    }

    // --- 🌙 EYE CARE MODE ---
    activateEyeCare() {
        if (this.eyeCareActive) return;
        this.eyeCareActive = true;

        // Create warm overlay filter
        let overlay = document.getElementById('eyeCareOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'eyeCareOverlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(255, 160, 50, 0.08);
                pointer-events: none; z-index: 99999;
                transition: opacity 3s ease;
                opacity: 0;
            `;
            document.body.appendChild(overlay);
        }
        // Gradually apply
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });

        // Reduce overall brightness smoothly
        document.documentElement.style.transition = 'filter 3s ease';
        document.documentElement.style.filter = 'brightness(0.85) saturate(0.9)';

        // Add dismiss button
        let dismissBtn = document.getElementById('eyeCareDismiss');
        if (!dismissBtn) {
            dismissBtn = document.createElement('button');
            dismissBtn.id = 'eyeCareDismiss';
            dismissBtn.innerHTML = '🌙 Eye Care ON — Click to turn off';
            dismissBtn.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                padding: 10px 18px; border-radius: 10px;
                background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4);
                color: #c4b5fd; font-size: 13px; font-family: 'Inter', sans-serif;
                cursor: pointer; z-index: 100000;
                backdrop-filter: blur(10px);
                transition: all 0.3s;
            `;
            dismissBtn.addEventListener('click', () => this.deactivateEyeCare());
            dismissBtn.addEventListener('mouseenter', () => {
                dismissBtn.style.background = 'rgba(139, 92, 246, 0.4)';
            });
            dismissBtn.addEventListener('mouseleave', () => {
                dismissBtn.style.background = 'rgba(139, 92, 246, 0.2)';
            });
            document.body.appendChild(dismissBtn);
        }
    }

    deactivateEyeCare() {
        this.eyeCareActive = false;

        const overlay = document.getElementById('eyeCareOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 3000);
        }

        document.documentElement.style.transition = 'filter 2s ease';
        document.documentElement.style.filter = '';

        const dismissBtn = document.getElementById('eyeCareDismiss');
        if (dismissBtn) dismissBtn.remove();

        this.showToast('Eye Care Mode turned off 🌞');
    }

    // --- 📎 FILE HANDLING ---
    initFileHandling() {
        // Find or create hidden file input
        this.fileInput = document.getElementById('fileInput');
        if (!this.fileInput) {
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.id = 'fileInput';
            this.fileInput.style.display = 'none';
            this.fileInput.accept = 'image/*,.txt,.pdf,.csv,.json,.md,.js,.py'; // Expanded formats
            document.body.appendChild(this.fileInput);
        }

        // Bind Attach Button
        const attachBtn = document.getElementById('attachBtn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.fileInput.click());
        }

        // Handle File Selection
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.showToast(`File selected: ${file.name}`, 'info');

                const reader = new FileReader();
                const isImage = file.type.startsWith('image/');

                reader.onload = (event) => {
                    this.attachedFile = {
                        name: file.name,
                        type: isImage ? 'image' : 'text',
                        content: isImage ? null : event.target.result, // Text content
                        data: isImage ? event.target.result : null      // Image data URL
                    };
                    this.updateSendBtnState();

                    // Remove old preview if any
                    const old = document.querySelector('.file-preview-chip');
                    if (old) old.remove();

                    // Show visual preview
                    const preview = document.createElement('div');
                    preview.className = 'file-preview-chip';

                    if (isImage) {
                        preview.innerHTML = `
                            <img src="${event.target.result}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;">
                            <span>${file.name.substring(0, 15)}...</span>
                            <button onclick="window.assistant.clearAttachment()" style="background:none; border:none; color:#fff; cursor:pointer; margin-left:5px;">&times;</button>
                        `;
                    } else {
                        preview.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <span>${file.name.substring(0, 15)}...</span>
                            <button onclick="window.assistant.clearAttachment()" style="background:none; border:none; color:#fff; cursor:pointer; margin-left:5px;">&times;</button>
                        `;
                    }

                    // Style
                    preview.style.cssText = 'position:absolute; bottom:60px; left:20px; background:#1e293b; color:#cbd5e1; padding:6px 12px; border-radius:8px; display:flex; gap:8px; align-items:center; font-size:0.85rem; box-shadow:0 4px 6px rgba(0,0,0,0.3); border:1px solid #334155; z-index:100; animation: slideUp 0.3s ease;';

                    document.querySelector('.chat-input-container')?.appendChild(preview);
                };

                if (isImage) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            }
        });
    }

    clearAttachment() {
        this.attachedFile = null;
        if (this.fileInput) this.fileInput.value = ''; // Reset input
        const chip = document.querySelector('.file-preview-chip');
        if (chip) chip.remove();
        this.updateSendBtnState();
    }

    // --- 🎙️ ORBIAN LIVE (VOICE MODE) ---

    async enterVoiceMode() {
        this.isVoiceMode = true;
        const overlay = document.getElementById('voiceOverlay');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Stop currently playing TTS or speech recognition
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        if (this.isRecording) this.recognition.stop();

        this.setVoiceState('listening');

        // Initial Greeting
        if (this.messages.length === 0) {
            this.speakTextVoiceMode("Hello! I'm Orbian. I'm ready for a live conversation. How can I help you?");
        } else {
            // Start listening after a short delay
            setTimeout(() => { if (this.isVoiceMode && !this.isRecording) try { this.recognition.start(); } catch (e) { } }, 600);
        }

        // Initialize Canvas Loop if not started
        if (!this.liveCanvas) {
            this.liveCanvas = document.getElementById('voiceCanvas');
            this.liveCtx = this.liveCanvas.getContext('2d');
            this.orbianLiveLoop();
        }

        await this.setupLiveMic();

        this.showToast('🎙️ Orbian Live Activated');
    }

    async callOrbianLiveAI(text) {
        if (!this.isVoiceMode || this.isVoiceMuted) return;
        this.setVoiceState('thinking');

        const wrap = document.getElementById('voiceTranscriptWrap');
        if (wrap) wrap.innerText = text;

        const groqKey = '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';
        const systemPrompt = 'You are Orbian AI. Always be respectful and polite. Use "aap" instead of "tu". Match the user\'s language: if they speak English, reply in natural English. If they speak Hindi/Hinglish, reply in proper Hindi using Devanagari script (like नमस्ते). Keep it concise, short sentences, no markdown.';

        const recentMessages = this.messages.slice(-10).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
        }));

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'system', content: systemPrompt }, ...recentMessages, { role: 'user', content: text }],
                    max_tokens: 120,
                    temperature: 0.7
                })
            });
            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || 'Sorry, can you repeat?';

            // Sync with main app history
            this.messages.push({ role: 'user', content: text, id: Date.now() });
            this.messages.push({ role: 'assistant', content: reply, id: Date.now() + 1 });
            this.saveChatHistory();

            this.speakTextVoiceMode(reply);
        } catch (e) {
            console.error('Orbian Live Error:', e);
            this.speakTextVoiceMode("Connection issues. Please try again.");
        }
    }

    exitVoiceMode() {
        this.isVoiceMode = false;
        const overlay = document.getElementById('voiceOverlay');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';

        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        if (this.isRecording) this.recognition.stop();

        this.stopLiveMedia(); // Ensure vision/mic stops
        this.showToast('Exited Voice Mode');
    }

    // --- ⚡ ORBIAN LIVE CORE LOGIC ⚡ ---
    initOrbianLive() {
        this.liveCanvas = document.getElementById('voiceCanvas');
        if (this.liveCanvas) {
            this.liveCtx = this.liveCanvas.getContext('2d');
            this.orbianLiveLoop();
        }
    }

    orbianLiveLoop() {
        if (!this.liveCtx || !this.isVoiceMode) {
            if (this.isVoiceMode) requestAnimationFrame(() => this.orbianLiveLoop());
            return;
        }
        requestAnimationFrame(() => this.orbianLiveLoop());

        const dpr = Math.min(window.devicePixelRatio, 2);
        const W = window.innerWidth, H = window.innerHeight;

        if (this.liveCanvas.width !== W * dpr || this.liveCanvas.height !== H * dpr) {
            this.liveCanvas.width = W * dpr;
            this.liveCanvas.height = H * dpr;
            this.liveCtx.scale(dpr, dpr);
        }

        const w = W, h = H, cx = w / 2, cy = h / 2 + 40;
        const elapsed = Date.now() / 1000;

        this.liveCtx.fillStyle = '#04020a';
        this.liveCtx.fillRect(0, 0, w, h);

        let frequencies = new Uint8Array(64).fill(0).map(() => 10 + Math.sin(elapsed * 2) * 8);

        if (this.liveAnalyser && (this.liveState === 'listening' || this.liveState === 'speaking')) {
            const data = new Uint8Array(this.liveAnalyser.frequencyBinCount);
            this.liveAnalyser.getByteFrequencyData(data);
            frequencies = data;
        } else if (this.liveState === 'thinking') {
            frequencies = new Uint8Array(64).fill(0).map((_, i) => 20 + Math.sin(elapsed * 5 + i * 0.2) * 15);
        }

        const lerpFactor = this.liveState === 'listening' ? 0.35 : 0.15;
        for (let i = 0; i < 64; i++) {
            const val = frequencies[i] || 0;
            this.liveSmoothedFrequencies[i] += (val - this.liveSmoothedFrequencies[i]) * lerpFactor;
        }

        const barCount = 48, barWidth = (w * 0.7) / barCount, barGap = 4;
        const startX = cx - ((barCount * (barWidth + barGap)) / 2);

        for (let i = 0; i < barCount; i++) {
            const dataIdx = Math.floor((i / barCount) * (this.liveSmoothedFrequencies.length * 0.6));
            let val = this.liveSmoothedFrequencies[dataIdx];
            let barHeight = (val / 255) * (h * 0.85);

            if (this.liveState === 'idle') barHeight = (this.liveSmoothedFrequencies[i % 64] / 100) * (h * 0.35);
            if (this.liveState === 'thinking') barHeight = (this.liveSmoothedFrequencies[i % 64] / 100) * (h * 0.5);

            barHeight = Math.max(barHeight, 15);

            let grad = this.liveCtx.createLinearGradient(0, cy - barHeight / 2, 0, cy + barHeight / 2);
            if (this.liveState === 'idle') { grad.addColorStop(0, '#0088ff'); grad.addColorStop(1, '#004488'); }
            else if (this.liveState === 'listening') { grad.addColorStop(0, '#00ffaa'); grad.addColorStop(1, '#008855'); }
            else if (this.liveState === 'thinking') { grad.addColorStop(0, '#aa88ff'); grad.addColorStop(1, '#5522aa'); }
            else { grad.addColorStop(0, '#ff44aa'); grad.addColorStop(1, '#880055'); }

            this.liveCtx.fillStyle = grad;
            this.liveCtx.beginPath();
            if (this.liveCtx.roundRect) {
                this.liveCtx.roundRect(startX + i * (barWidth + barGap), cy - barHeight / 2, barWidth, barHeight, barWidth / 2);
            } else {
                this.liveCtx.rect(startX + i * (barWidth + barGap), cy - barHeight / 2, barWidth, barHeight);
            }
            this.liveCtx.fill();
        }
    }

    setVoiceState(state) {
        this.liveState = state;
        const stateLine = document.getElementById('voiceStateLine');
        const liveDot = document.getElementById('liveDot');

        if (stateLine) {
            stateLine.innerText = state.charAt(0).toUpperCase() + state.slice(1);
            if (state === 'listening') stateLine.innerText = "Listening...";
            if (state === 'thinking') stateLine.innerText = "Thinking...";
            if (state === 'speaking') stateLine.innerText = "Speaking...";
        }

        if (liveDot) liveDot.classList.toggle('on', state === 'listening');
    }

    async setupLiveMic() {
        if (this.liveMicStream) return;
        try {
            this.liveMicStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            this.liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.liveAnalyser = this.liveAudioCtx.createAnalyser();
            this.liveAnalyser.fftSize = 256;
            this.liveAudioCtx.createMediaStreamSource(this.liveMicStream).connect(this.liveAnalyser);
        } catch (e) { console.warn("Mic Setup Error:", e); }
    }

    toggleVoiceMute() {
        this.isVoiceMuted = !this.isVoiceMuted;
        const btn = document.getElementById('voiceMuteBtn');
        if (this.liveMicStream) {
            this.liveMicStream.getAudioTracks().forEach(t => t.enabled = !this.isVoiceMuted);
        }

        if (btn) btn.classList.toggle('on', this.isVoiceMuted);

        if (this.isVoiceMuted) {
            if (this.isRecording) this.recognition.stop();
            this.setVoiceState('muted');
        } else {
            if (this.isVoiceMode) {
                this.setVoiceState('listening');
                try { this.recognition.start(); } catch (e) { }
            }
        }
    }

    async toggleLiveCamera() {
        const btn = document.getElementById('voiceCamBtn');
        const pip = document.getElementById('voiceCamPip');
        const video = document.getElementById('voiceCamVideo');

        if (this.liveCamStream) {
            this.liveCamStream.getTracks().forEach(t => t.stop());
            this.liveCamStream = null;
            pip.classList.remove('on');
            if (btn) btn.classList.remove('on');
            return;
        }

        try {
            this.liveCamStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.liveCamFacing, width: { ideal: 640 }, height: { ideal: 640 } }
            });
            video.srcObject = this.liveCamStream;
            pip.classList.add('on');
            pip.classList.toggle('mirror', this.liveCamFacing === 'user');
            if (btn) btn.classList.add('on');
        } catch (e) {
            console.error("Camera Error:", e);
            this.showToast("Cannot access camera");
        }
    }

    async toggleLiveScreen() {
        const btn = document.getElementById('voiceScreenBtn');
        const pip = document.getElementById('voiceCamPip');
        const video = document.getElementById('voiceCamVideo');

        if (this.liveScreenStream) {
            this.liveScreenStream.getTracks().forEach(t => t.stop());
            this.liveScreenStream = null;
            pip.classList.remove('on');
            if (btn) btn.classList.remove('on-screen');
            return;
        }

        try {
            this.liveScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            video.srcObject = this.liveScreenStream;
            pip.classList.add('on');
            pip.classList.remove('mirror');
            if (btn) btn.classList.add('on-screen');

            this.liveScreenStream.getVideoTracks()[0].onended = () => {
                this.liveScreenStream = null;
                pip.classList.remove('on');
                if (btn) btn.classList.remove('on-screen');
            };
        } catch (e) { console.warn("Screen Share Error:", e); }
    }

    async flipLiveCamera() {
        if (!this.liveCamStream) return;
        this.liveCamFacing = this.liveCamFacing === "user" ? "environment" : "user";
        this.liveCamStream.getTracks().forEach(t => t.stop());
        this.liveCamStream = null;
        await this.toggleLiveCamera();
    }

    toggleLiveCaptions() {
        this.isLiveCaptions = !this.isLiveCaptions;
        const btn = document.getElementById('capToggleBtn');
        const wrap = document.getElementById('voiceTranscriptWrap');
        if (btn) btn.classList.toggle('on', this.isLiveCaptions);
        if (!this.isLiveCaptions && wrap) wrap.classList.remove('on');
    }

    toggleVoiceDropdown(e) {
        e.stopPropagation();
        const menu = document.getElementById('voiceMenuBox');
        if (menu) menu.classList.toggle('on');
    }

    loadVoices() {
        const vs = window.speechSynthesis.getVoices();
        const menu = document.getElementById('voiceMenuBox');
        if (!menu) return;

        menu.innerHTML = `<div class="v-item ${!this.currentLiveVoice ? 'active' : ''}" onclick="window.assistant.selectVoice('', 'Auto Voice')">Auto Voice <small>Automatic detection</small></div>`;

        vs.filter(v => v.lang.startsWith('en') || v.lang.startsWith('hi')).forEach(v => {
            const div = document.createElement('div');
            div.className = `v-item ${v.name === this.currentLiveVoice ? 'active' : ''}`;
            div.setAttribute('onclick', `window.assistant.selectVoice('${v.name.replace(/'/g, "\\'")}', '${v.name.replace(/'/g, "\\'")}')`);
            div.innerHTML = `${v.name} <small>${v.lang}</small>`;
            menu.appendChild(div);
        });
    }

    selectVoice(name, label) {
        this.currentLiveVoice = name;
        let shortName = label.split(' ')[0];
        if (shortName === 'Google') shortName = label.split(' ')[1] || 'Voice';

        const selName = document.getElementById('selectedVoiceName');
        if (selName) selName.textContent = name ? shortName : 'Auto Voice';

        const menu = document.getElementById('voiceMenuBox');
        if (menu) menu.classList.remove('on');
        this.loadVoices();
    }

    stopLiveMedia() {
        [this.liveMicStream, this.liveCamStream, this.liveScreenStream].forEach(s => {
            if (s) s.getTracks().forEach(t => t.stop());
        });
        this.liveMicStream = this.liveCamStream = this.liveScreenStream = null;
        if (this.liveAudioCtx) this.liveAudioCtx.close();
        this.liveAudioCtx = null;
        this.liveAnalyser = null;
    }

    async speakTextVoiceMode(text) {
        if (!this.isVoiceMode) return;
        this.setVoiceState('speaking');

        // Clean text for TTS
        const cleanText = text.replace(/```[\s\S]*?```/g, " [Detailed information provided in chat history] ")
            .replace(/<[^>]*>/g, '')
            .replace(/[#*`_~]/g, '')
            .substring(0, 1000)
            .trim();

        if (this.isRecording) try { this.recognition.stop(); } catch (e) { }

        return new Promise(resolve => {
            this.fallbackBrowserTTS(cleanText, null, () => {
                if (this.isVoiceMode && !this.isVoiceMuted) {
                    this.setVoiceState('listening');
                    setTimeout(() => { if (this.isVoiceMode && !this.isRecording) try { this.recognition.start(); } catch (e) { } }, 500);
                }
                resolve();
            });
        });
    }

    // --- 🎤 MIC HANDLING ---
    async toggleMic() {
        if (!this.recognition) {
            this.showToast('Speech Recognition not supported in this browser.');
            return;
        }

        // --- NEW: Block until permissions for BOTH Mic and Camera are requested (First time only) ---
        if (!this.permissionsGranted) {
            const granted = await this.ensureMediaPermissions();
            if (!granted) return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (e) {
                console.error('Mic error:', e);
                this.showToast('Could not start microphone. Check permissions.');
            }
        }
    }

    async ensureMediaPermissions() {
        if (this.permissionsGranted) return true;

        // 🛡️ SECURITY CHECK: Chrome only allows hardware access on HTTPS or Localhost
        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showToast("🚫 Secure Context Required: Hardware access requires HTTPS or localhost.");
            console.error("Hardware access blocked: Not in a secure context (HTTPS/Localhost).");
            alert("🔒 Chrome Security: Microphone and Camera access require HTTPS or Localhost. If you are testing locally, use http://localhost:PORT instead of your IP address.");
            return false;
        }

        this.showToast("🔓 Requesting Camera & Microphone Access...");
        try {
            const constraints = { 
                audio: this.settings.permissions.mic, 
                video: this.settings.permissions.cam ? { width: 320, height: 240 } : false 
            };

            if (!constraints.audio && !constraints.video) {
                this.showToast("⚠️ Both Mic and Camera disabled in app settings.");
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Immediately stop tracks to release hardware
            stream.getTracks().forEach(track => track.stop());
            this.permissionsGranted = true;
            console.log("✅ Requested hardware permissions granted.");
            return true;
        } catch (e) {
            console.error("❌ Hardware Permission Denied:", e);
            
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                this.showToast("🚫 Access Denied: Please click the 'Lock' icon next to URL and enable Mic/Cam.");
                alert("🔴 Permission Denied: Chrome has blocked hardware access. Please click the lock icon in the address bar and set 'Microphone' and 'Camera' to 'Allow'.");
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                this.showToast("⚠️ Missing Hardware: No Mic or Camera found.");
                
                // Fallback: Try just Mic
                try {
                    const micOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
                    micOnly.getTracks().forEach(t => t.stop());
                    this.permissionsGranted = true;
                    this.showToast("✅ Mic found (Camera missing or blocked).");
                    return true;
                } catch (micErr) {
                    this.showToast("❌ No audio input found either.");
                }
            } else {
                this.showToast("⚠️ Media error: " + e.message);
            }
            return false;
        }
    }

    // --- 👻 GHOST MODE ---
    toggleGhostMode(btn) {
        this.isGhostMode = !this.isGhostMode;
        document.body.classList.toggle('ghost-mode', this.isGhostMode);

        if (this.isGhostMode) {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg> Let's go public
            `;
            this.showToast('👻 Ghost Mode Active: No history saved locally');
            // Clear current chat history visual (optional)
            // this.clearChat(); 
        } else {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg> Ghost Mode
            `;
            this.showToast('Ghost Mode Deactivated. History will be saved.');
        }
    }








    // --- Dynamic Suggestions ---
    renderRandomSuggestions() {
        console.log('🔄 Rendering Random Suggestions...');
        try {
            const suggestionPool = [
                { icon: 'code', text: "Write a Python script to scrape a website" },
                { icon: 'code', text: "Explain Recursion like I'm 5 years old" },
                { icon: 'code', text: "Debug this JavaScript code snippet" },
                { icon: 'code', text: "Design a SQL schema for a Chat App" },
                { icon: 'code', text: "How does HTTPS work under the hood?" },
                { icon: 'feather', text: "Write a cyberpunk story intro set in Mumbai" },
                { icon: 'feather', text: "Roast my music taste based on my mood" },
                { icon: 'feather', text: "Tell me a dark humor joke" },
                { icon: 'feather', text: "Generate a prompt for a futuristic AI image" },
                { icon: 'feather', text: "Write a rap battle between Siri and Alexa" },
                { icon: 'briefcase', text: "Draft a professional email for a sick leave" },
                { icon: 'briefcase', text: "Analyze the current trends in AI startups" },
                { icon: 'briefcase', text: "Create a budget plan for a college student" },
                { icon: 'briefcase', text: "Give me 5 unique marketing ideas for a cafe" },
                { icon: 'book', text: "Explain the Fermi Paradox" },
                { icon: 'book', text: "What would happen if the moon disappeared?" },
                { icon: 'book', text: "Concept of Time Dilation in Interstellar" },
                { icon: 'book', text: "History of the Roman Empire in 3 sentences" },
                { icon: 'coffee', text: "Ek badhiya sa Shayri sunao" },
                { icon: 'coffee', text: "Paneer Butter Masala ki recipe batao" },
                { icon: 'coffee', text: "Mere liye ek motivational quote bolo Hindi mein" },
                { icon: 'coffee', text: "What is the current price of Bitcoin?" },
                { icon: 'coffee', text: "Who won the latest F1 race?" },
                { icon: 'coffee', text: "What's the weather like in New York right now?" },
                { icon: 'code', text: "Explain HTML in detail" }

            ];

            // Shuffle
            const shuffled = suggestionPool.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 4);

            const container = document.querySelector('.suggestions');
            if (!container) {
                console.error('❌ Suggestions container not found!');
                return;
            }

            // Generate HTML with data-prompt
            container.innerHTML = selected.map(item => `
                <button class="suggestion-btn" data-prompt="${item.text.replace(/"/g, '&quot;')}">
                    <div class="suggestion-icon">${this.getIconSvg(item.icon)}</div>
                    <span>${item.text}</span>
                </button>
            `).join('');

            // Bind Events to New Buttons
            container.querySelectorAll('.suggestion-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.messageInput.value = btn.dataset.prompt;
                    this.sendBtn.disabled = false;
                    this.sendMessage();
                });
            });

            console.log('✅ Suggestions rendered successfully:', selected.map(s => s.text));
        } catch (e) {
            console.error('❌ Error rendering suggestions:', e);
        }
    }

    // --- QUOTA SYSTEM ---
    checkQuota() {
        const user = JSON.parse(localStorage.getItem('ai_assistant_user'));
        const today = new Date().toDateString();

        // 1. Guest Case (Not Logged In)
        if (!user) {
            let guestChats = parseInt(localStorage.getItem('orbian_guest_chats') || '0');
            if (guestChats >= 3) {
                this.addMessage('system', '🔴 **Guest Limit Reached.** You have used your 3 free guest chats. Please **Login** or **Sign Up** to continue talking to Orbian.');
                this.showToast('Please Login to continue');
                return true;
            }
            localStorage.setItem('orbian_guest_chats', guestChats + 1);
            return false;
        }

        // 2. Logged In User Case
        const tier = user.plan || 'explorer'; // Default to explorer
        const isPremium = user.is_premium || user.plan === 'pro';
        const maxChats = isPremium ? 1000 : 100; // 100 for free, 1000 for accounts with premium active

        // Check Daily Reset
        let dailyChats = parseInt(localStorage.getItem('orbian_daily_chats') || '0');
        let lastReset = localStorage.getItem('orbian_last_reset');

        if (lastReset !== today) {
            dailyChats = 0;
            localStorage.setItem('orbian_last_reset', today);
        }

        if (dailyChats >= maxChats) {
            const msg = isPremium ?
                '🔴 **Daily Pro Quota Reached.** You have exhausted your 1000 daily chats. Refills tomorrow!' :
                '🔴 **Daily Free Quota Reached.** You have used your 100 free daily chats. Upgrade to **Professional** for 1000+ chats or wait for tomorrow\'s refill.';

            this.addMessage('system', msg);
            this.showToast('Quota exceeded');
            return true;
        }

        localStorage.setItem('orbian_daily_chats', dailyChats + 1);
        return false;
    }

    getIconSvg(name) {
        const icons = {
            'code': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
            'feather': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>',
            'briefcase': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
            'book': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
            'coffee': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>'
        };
        return icons[name] || icons['code'];
    }
    // --- Geolocation & Local Intelligence (Weather/News/Bihar/Buxar) ---
    async initGeolocation() {
        if (!this.settings.permissions?.location) {
            console.log("📍 Geolocation disabled in app settings.");
            return;
        }

        if (!navigator.geolocation) {
            console.warn("📍 Geolocation not supported by browser.");
            return;
        }

        console.log("📍 Requesting position...");
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                this.locationData.lat = pos.coords.latitude;
                this.locationData.lon = pos.coords.longitude;
                console.log(`📍 Found Position: ${this.locationData.lat}, ${this.locationData.lon}`);
                
                // 1. Reverse Geocode (Get City/State)
                await this.reverseGeocode();
                
                // 2. Fetch Weather
                await this.fetchLocationWeather();
                
                // 3. Fetch Local News
                await this.fetchLocationNews();

                // 4. Update System Prompt with Location Context
                this.updateLocationInSystemPrompt();
                
                // 5. Update UI Widget
                this.updateLocationUI();
            },
            (err) => {
                console.warn("📍 Geolocation denied/failed:", err.message);
                this.showToast("Location access denied. Using default settings.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    async reverseGeocode() {
        try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${this.locationData.lat}&longitude=${this.locationData.lon}&localityLanguage=en`);
            const data = await res.json();
            this.locationData.city = data.city || data.locality || 'Unknown';
            this.locationData.state = data.principalSubdivision || 'Unknown';
            console.log(`📍 Location Decoded: ${this.locationData.city}, ${this.locationData.state}`);
        } catch (e) { console.error("❌ Reverse Geocode Error:", e); }
    }

    async fetchLocationWeather() {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${this.locationData.lat}&longitude=${this.locationData.lon}&current_weather=true&temperature_unit=celsius`);
            const data = await res.json();
            if (data.current_weather) {
                this.locationData.weather = data.current_weather;
                console.log("⭐ Weather Data Updated.");
            }
        } catch (e) { console.error("❌ Weather Fetch Error:", e); }
    }

    async fetchLocationNews() {
        try {
            const city = this.locationData.city;
            const state = this.locationData.state;
            const isBihar = state.toLowerCase().includes('bihar') || city.toLowerCase().includes('buxar');
            const query = isBihar ? "Bihar Buxar Latest News" : `${city} ${state} Latest News`;
            console.log(`🗞️ Preparing news context for: ${query}`);
            this.locationData.newsQuery = query;
        } catch (e) { console.error("❌ News Fetch Error:", e); }
    }

    updateLocationInSystemPrompt() {
        const { city, state, lat, lon, weather } = this.locationData;
        const weatherStr = weather ? `${weather.temperature}\u00b0C` : 'Unknown';
        const locContext = `\n\n[USER CURRENT CONTEXT]\nLocation: ${city}, ${state} (${lat}, ${lon})\nLocal Weather: ${weatherStr}\nImportant: User is based in ${state}. If it's Bihar/Buxar, provide highly specific local info.`;
        this.settings.systemPrompt += locContext;
    }

    updateLocationUI() {
        const sidebarTop = document.querySelector('.logo-area') || document.querySelector('.sidebar .header');
        if (sidebarTop) {
            let widget = document.getElementById('locationWidget');
            if (!widget) {
                widget = document.createElement('div');
                widget.id = 'locationWidget';
                widget.className = 'location-widget';
                Object.assign(widget.style, {
                    padding: '12px', margin: '12px', background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px',
                    backdropFilter: 'blur(10px)', animation: 'fadeIn 0.5s ease-out'
                });
                sidebarTop.after(widget);
            }
            const temp = this.locationData.weather ? `${this.locationData.weather.temperature}\u00b0C` : '--';
            widget.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(139, 92, 246, 0.1)); padding: 8px; border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.2);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                </div>
                <div style="flex: 1;">
                    <div style="color: #fff; font-weight: 700; font-size: 13px;">${this.locationData.city}</div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.5);">${this.locationData.state} \u2022 <span style="color: #a78bfa;">${temp}</span></div>
                </div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.assistant = new AIAssistant();
});
