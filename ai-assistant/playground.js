// Orbian Forge Playground Logic

class ForgePlayground {
    constructor() {
        this.messages = [];
        this.isProcessing = false;

        // Load Settings (Sync with Main App)
        this.settings = JSON.parse(localStorage.getItem('aiAssistantSettings')) || {
            customBaseUrl: 'https://openrouter.ai/api/v1',
            customKey: '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',
            customModel: 'arcee-ai/trinity-large-preview:free',
            models: {
                coding: ['qwen/qwen3-coder:free', 'meta-llama/llama-3.3-70b-instruct:free'],
                allRounder: ['arcee-ai/trinity-large-preview:free']
            }
        };

        // DOM
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.previewFrame = document.getElementById('preview-frame');
        this.loader = document.getElementById('forge-loader');

        this.init();
    }

    init() {
        this.sendBtn.addEventListener('click', () => this.handleSend());
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    }

    async handleSend() {
        const query = this.userInput.value.trim();
        if (!query || this.isProcessing) return;

        this.addMessage('user', query);
        this.userInput.value = '';
        this.isProcessing = true;
        this.loader.style.display = 'flex';

        try {
            this.showTypingIndicator();
            // Intelligent Prompting for the Playground
            const playgroundPrompt = `
                USER REQUEST: "${query}"
                INSTRUCTION: You are a Lead Frontend Architect. 
                1. Write a COMPLETE, single-file HTML (including CSS and JS) that fulfills the user's request.
                2. Use modern, premium aesthetics (gradients, glassmorphism, animations).
                3. Wrap the code in \`\`\`html code \`\`\` blocks.
                4. Be intelligent, avoid basic or childish designs.
            `;

            const response = await this.generateMultiModelResponse(playgroundPrompt);
            this.hideTypingIndicator();
            this.addMessage('ai', response);
            this.updatePreview(response);
        } catch (error) {
            console.error('Forge Error:', error);
            this.hideTypingIndicator();
            this.addMessage('ai', "⚠️ Forge Error: " + error.message);
        } finally {
            this.isProcessing = false;
            this.loader.style.display = 'none';
        }
    }

    showTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'msg ai loading-dots';
        div.id = 'forge-typing';
        div.innerHTML = `<span></span><span></span><span></span>`;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const el = document.getElementById('forge-typing');
        if (el) el.remove();
    }

    async generateMultiModelResponse(prompt) {
        const providers = [
            { id: this.settings.models.coding[0], type: 'OpenRouter' },
            { id: this.settings.models.allRounder[0], type: 'OpenRouter' },
            { id: 'meta-llama/llama-3.3-70b-instruct:free', type: 'OpenRouter' }
        ];

        let lastError = '';
        for (const provider of providers) {
            try {
                console.log(`🔨 Forging with: ${provider.id}`);
                return await this.callOpenRouter(prompt, provider.id);
            } catch (e) {
                console.warn(`${provider.id} failed, trying fallback...`, e);
                lastError = e.message;
            }
        }
        throw new Error("All Forge engines failed. Error: " + lastError);
    }

    async callOpenRouter(prompt, model) {
        const response = await fetch(`${this.settings.customBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.customKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a master of web technologies. Always return full workable HTML code for any UI request.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.6
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `msg ${role}`;

        // Simple Markdown highlighting for code
        if (role === 'ai') {
            const codeMatch = text.match(/```html\n?([\s\S]*?)```/i) || text.match(/```\n?([\s\S]*?)```/i);
            if (codeMatch) {
                const cleanText = text.replace(/```[\s\S]*?```/g, '*(Code injected into preview)*');
                div.innerHTML = cleanText.replace(/\n/g, '<br>');
            } else {
                div.innerText = text;
            }
        } else {
            div.innerText = text;
        }

        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updatePreview(aiResponse) {
        // Extract HTML from markdown
        const match = aiResponse.match(/```html\n?([\s\S]*?)```/i) || aiResponse.match(/```\n?([\s\S]*?)```/i);
        if (match) {
            const code = match[1];
            const blob = new Blob([code], { type: 'text/html' });
            this.previewFrame.src = URL.createObjectURL(blob);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.forge = new ForgePlayground();
});
