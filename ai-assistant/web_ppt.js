/**
 * ORBIAN - Premium Web Presentation Viewer
 * Professional full-screen slideshow with glassmorphism UI.
 */
class WebPresentation {
    constructor() {
        this.overlayId = 'orbian-presentation-overlay';
        this.deck = null;
    }

    /**
     * Launch in full-screen premium mode 
     */
    async launch(data) {
        if (typeof Reveal === 'undefined') {
            console.error("Reveal.js not found!");
            return;
        }

        // Remove old overlay if any
        const old = document.getElementById(this.overlayId);
        if (old) old.remove();

        // 1. Create Overlay Body
        const overlay = document.createElement('div');
        overlay.id = this.overlayId;
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: radial-gradient(circle at center, #1e293b, #0f172a);
            z-index: 10000; display: flex; flex-direction: column; overflow: hidden;
            animation: fadeIn 0.4s ease-out;
            font-family: 'Inter', sans-serif;
        `;

        // 2. Add Header (Navigation/Actions)
        const header = document.createElement('div');
        header.style.cssText = `
            height: 60px; padding: 0 30px; display: flex; align-items: center;
            justify-content: space-between; background: rgba(0,0,0,0.3);
            border-bottom: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px);
            z-index: 10001;
        `;
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="logo.png?v=6" height="30">
                <span style="font-weight:700; color:#fff; letter-spacing:1px; font-size:0.9rem;">ORBIAN PRESENTATION STUDIO</span>
            </div>
            <div style="display:flex; gap:15px; align-items:center;">
                <span style="color:#94a3b8; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); padding:4px 10px; border-radius:100px;">
                    Use Arrow Keys to Navigate
                </span>
                <button id="close-web-ppt" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem;">
                    Exit
                </button>
            </div>
        `;
        overlay.appendChild(header);

        // 3. Slides Container
        const slidesDiv = document.createElement('div');
        slidesDiv.className = 'reveal';
        slidesDiv.style.flex = "1";

        let slidesBody = `
            <div class="slides">
                <!-- Cover -->
                <section data-background-gradient="linear-gradient(to right, #6366f1, #a855f7)">
                    <h1 style="color:#fff; font-size:3.5rem; text-transform:uppercase; font-weight:900;">${data.title}</h1>
                    <div style="width:100px; height:4px; background:#fff; margin:20px auto;"></div>
                    <p style="color:rgba(255,255,255,0.8); font-size:1.4rem;">${data.subtitle || "An Orbian Intelligence Output"}</p>
                </section>
        `;

        // Content
        data.slides.forEach(s => {
            slidesBody += `
                <section data-background-color="#0f172a" 
                         data-transition="convex"
                         style="text-align:left;">
                    <div style="border-left:5px solid #6366f1; padding-left:25px; margin-bottom:40px;">
                        <h2 style="color:#fff; font-size:2.8rem; margin:0;">${s.title}</h2>
                        <span style="color:#6366f1; font-weight:600; text-transform:uppercase; font-size:0.8rem;">Orbian Insight Module</span>
                    </div>
                    <div style="color:rgba(255,255,255,0.8); font-size:1.3rem; line-height:1.6;">
                        ${Array.isArray(s.content)
                    ? `<ul style="margin-left:20px;">${s.content.map(li => `<li style="margin-bottom:15px;">${li}</li>`).join('')}</ul>`
                    : `<p>${s.content}</p>`
                }
                    </div>
                </section>
            `;
        });

        slidesBody += `</div>`;
        slidesDiv.innerHTML = slidesBody;
        overlay.appendChild(slidesDiv);
        document.body.appendChild(overlay);

        // 4. Initialization
        this.deck = new Reveal(slidesDiv, {
            embedded: true,
            controls: true,
            progress: true,
            center: true,
            hash: false,
            transition: 'convex',
            keyboard: true,
            touch: true,
            width: 1200,
            height: 800,
            margin: 0.05
        });

        await this.deck.initialize();

        // Listeners
        document.getElementById('close-web-ppt').onclick = () => this.destroy();

        // Keydown for Escape
        this._escListener = (e) => { if (e.key === 'Escape') this.destroy(); };
        window.addEventListener('keydown', this._escListener);
    }

    destroy() {
        const overlay = document.getElementById(this.overlayId);
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
        }
        window.removeEventListener('keydown', this._escListener);
        this.deck = null;
    }
}

window.webPresentation = new WebPresentation();
