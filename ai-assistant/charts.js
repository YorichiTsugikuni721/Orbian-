// Chart Rendering Logic
// Handles Chart.js and React/Recharts implementations

const ChartRenderer = {
    // Main Entry Point: Scans HTML content for <chart> tags and renders them
    renderCharts(element) {
        // 1. Detect and flatten professional placeholders (Safest way to get data)
        const placeholders = element.querySelectorAll('.chart-loading-placeholder');
        placeholders.forEach(ph => {
            const hiddenSpan = ph.querySelector('.hidden-chart-data');
            if (hiddenSpan) {
                // Use textContent to get the RAW chart tag without browser HTML mangling
                const tagContent = hiddenSpan.textContent;
                if (tagContent.toLowerCase().includes('</chart>')) {
                    ph.insertAdjacentText('afterend', tagContent);
                    ph.remove();
                }
            }
        });

        let html = element.innerHTML;
        // Regex for both escaped and unescaped tags
        const regex = /&lt;chart&gt;([\s\S]*?)&lt;\/chart&gt;|<chart>([\s\S]*?)<\/chart>/gi;

        const chartsToRender = [];

        // 2. Find all matches and replace with containers
        html = html.replace(regex, (match, p1, p2) => {
            const jsonStr = p1 || p2;
            const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            chartsToRender.push({ id: chartId, json: jsonStr });
            return `
                <div class="chart-container" style="position: relative; height:320px; width:100%; margin:20px 0; background: #ffffff; border: 1px solid #edf2f7; border-radius: 16px; overflow: hidden; padding: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); color: #1e293b;">
                    <div style="position: absolute; top:0; left:0; right:0; height:3px; background: #3b82f6; opacity: 0.8;"></div>
                    <canvas id="${chartId}"></canvas>
                </div>`;
        });

        element.innerHTML = html;

        // 2. Render charts
        chartsToRender.forEach(item => {
            try {
                // 1. Decode HTML entities multiple times (handles double-encoded stuff)
                const decode = (s) => {
                    const txt = document.createElement('textarea');
                    txt.innerHTML = s;
                    let v = txt.value;
                    if (v.includes('&') && v !== s) return decode(v);
                    return v;
                };

                let cleanJson = decode(item.json);

                // 2. Strip ALL HTML tags that might have crept in from formatContent
                cleanJson = cleanJson.replace(/<\/?[^>]+(>|$)/g, " ");

                // 3. Robust Markdown Cleaning
                cleanJson = cleanJson.replace(/```(json|text|javascript|js)?/gi, '')
                    .replace(/```/g, '')
                    .trim();

                // 4. Strict Envelope Finding (Handle case where AI puts text around JSON)
                const firstCurly = cleanJson.indexOf('{');
                const lastCurly = cleanJson.lastIndexOf('}');

                if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
                    cleanJson = cleanJson.substring(firstCurly, lastCurly + 1);
                } else {
                    throw new Error("No valid JSON object found in payload");
                }

                // 5. Global Fixes for Python/JS syntax (Common AI hallucinations)
                cleanJson = cleanJson.replace(/\bTrue\b/g, 'true')
                    .replace(/\bFalse\b/g, 'false')
                    .replace(/\bNone\b/g, 'null');

                // 6. Deep Repair: Fix structural JSON errors (multiple commas, leading commas, etc.)
                let repaired = cleanJson
                    .replace(/,+/g, ',')              // Fix multiple commas (,, -> ,)
                    .replace(/\{,/g, '{')            // Fix leading comma in object ({, -> {)
                    .replace(/\[,/g, '[')            // Fix leading comma in array ([, -> [)
                    .replace(/,\s*([\]}])/g, '$1')   // Fix trailing commas
                    .replace(/,\s*([\]}])/g, '$1');   // Double pass for nested trailing commas

                let config;
                try {
                    config = JSON.parse(repaired);
                } catch (parseError) {
                    console.warn("JSON.parse failed, attempting JS-Style evaluation...", parseError);

                    // 7. Advanced Technical Repair: Quote unquoted keys, fix single quotes
                    repaired = repaired
                        .replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":') // Unquoted keys
                        .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')  // Single quoted keys
                        .replace(/:\s*'([^']+?)'/g, ': "$1"');           // Single quoted values

                    try {
                        config = JSON.parse(repaired);
                    } catch (retryError) {
                        try {
                            // 8. Last Resort: Loose JS Eval (Safe check for browser globals)
                            if (/window|document|alert|fetch|eval|Function|localStorage|sessionStorage|cookie/i.test(repaired)) {
                                throw new Error("Unsafe chart data rejected");
                            }
                            const looseParser = new Function("return " + repaired);
                            config = looseParser();
                            console.log("Chart parsed via loose JS evaluation");
                        } catch (evalError) {
                            console.error("All JSON Repair attempts failed", retryError, evalError);
                            throw evalError; // Bubbles up to outer catch for UI error display
                        }
                    }
                }

                if (!config || !config.data) {
                    throw new Error("Chart configuration is missing required 'data' property.");
                }

                // FEATURE SWITCH: Use React/Recharts for 'Area' charts
                if (config.type && config.type.toLowerCase() === 'area') {
                    if (window.React && window.Recharts) {
                        this.renderReactAreaChart(item.id, config);
                        return;
                    } else {
                        console.warn("Recharts/React not found for Area chart. Falling back to Chart.js.");
                    }
                }

                // Fallback / Standard Chart.js
                const canvas = document.getElementById(item.id);
                if (!canvas) throw new Error("Canvas element not found");
                const ctx = canvas.getContext('2d');

                if (!config.type) config.type = 'bar';
                let type = config.type.toLowerCase();
                if (type === 'area') type = 'line';

                const options = {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { color: '#64748b', font: { weight: '600', size: 11 } } },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#1e293b',
                            bodyColor: '#475569',
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            usePointStyle: true
                        }
                    },
                    scales: (type !== 'pie' && type !== 'doughnut') ? {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 } }, beginAtZero: true }
                    } : {}
                };

                const chartInstance = new Chart(ctx, {
                    type: type,
                    data: config.data,
                    options: options
                });

                // Apply Gradients & Styling (Fixed structure for all chart types)
                const toRgba = (c, a) => {
                    if (!c) return `rgba(99, 102, 241, ${a})`;
                    if (c.startsWith('#')) {
                        let r, g, b;
                        if (c.length === 4) {
                            r = parseInt(c[1] + c[1], 16);
                            g = parseInt(c[2] + c[2], 16);
                            b = parseInt(c[3] + c[3], 16);
                        } else {
                            r = parseInt(c.slice(1, 3), 16);
                            g = parseInt(c.slice(3, 5), 16);
                            b = parseInt(c.slice(5, 7), 16);
                        }
                        return `rgba(${r}, ${g}, ${b}, ${a})`;
                    }
                    if (c.startsWith('rgb(')) return c.replace(')', `, ${a})`).replace('rgb', 'rgba');
                    return c;
                };

                const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

                chartInstance.data.datasets.forEach((dataset, i) => {
                    let color = (dataset.borderColor && typeof dataset.borderColor === 'string') ? dataset.borderColor : defaultColors[i % defaultColors.length];

                    if (type === 'line') {
                        const isAreaFallback = config.type && config.type.toLowerCase() === 'area';
                        if (isAreaFallback) {
                            try {
                                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                                gradient.addColorStop(0, toRgba(color, 0.6));
                                gradient.addColorStop(0.6, toRgba(color, 0.2));
                                gradient.addColorStop(1, toRgba(color, 0.05));
                                dataset.backgroundColor = gradient;
                                dataset.fill = true;
                            } catch (e) {
                                console.warn("Area filling failed:", e);
                            }
                        } else {
                            dataset.fill = false;
                            dataset.backgroundColor = 'transparent';
                        }
                        dataset.borderColor = color;
                        dataset.borderWidth = 3;
                        dataset.tension = 0.4;
                        dataset.pointRadius = 0;
                    } else if (type === 'pie' || type === 'doughnut') {
                        dataset.backgroundColor = defaultColors.map(c => toRgba(c, 0.85));
                        dataset.borderColor = '#ffffff';
                        dataset.borderWidth = 2;
                    } else {
                        dataset.backgroundColor = toRgba(color, 0.7);
                        dataset.borderColor = color;
                        dataset.borderWidth = 1;
                        dataset.borderRadius = 6;
                    }
                });

                chartInstance.update();

            } catch (e) {
                console.error('Chart Render Error:', e);
                const errDiv = `<div style="padding: 12px; border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-top: 10px; color: #fca5a5; font-size: 0.9rem;">
                    <strong>❌ Chart Error:</strong> Invalid Data Format.<br>
                    <span style="font-size: 0.75rem; opacity: 0.8;">${e.message}</span>
                </div>`;
                const container = document.getElementById(item.id)?.parentElement;
                if (container) container.innerHTML = errDiv;
            }
        });
    },

    // React-based Area Chart Renderer (Subframe Style)
    renderReactAreaChart(canvasId, config) {
        const chartData = config.data;
        const container = document.getElementById(canvasId).parentElement;
        container.innerHTML = '';

        const reactRoot = document.createElement('div');
        Object.assign(reactRoot.style, {
            width: '100%',
            height: '320px',
            padding: '20px 10px 10px 10px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            border: '1px solid #edf2f7'
        });

        container.appendChild(reactRoot);

        const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = window.Recharts;
        const { createElement } = window.React;

        const transformedData = chartData.labels.map((label, idx) => {
            const point = { name: label };
            chartData.datasets.forEach(ds => {
                point[ds.label] = ds.data[idx];
            });
            return point;
        });

        const categories = chartData.datasets.map(ds => ds.label);
        // Re-refined blue palette: Biology (Vibrant Blue), Business (Light Blue), Psychology (Deep Blue)
        const colors = ['#3b82f6', '#93c5fd', '#1d4ed8', '#60a5fa'];

        const ChartComponent = () => {
            // Create defs separately to ensure they are first children
            const gradients = categories.map((cat, i) => {
                const color = colors[i % colors.length];
                const gradId = `grad-${canvasId}-${i}`;
                return createElement('linearGradient', { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1", key: gradId }, [
                    createElement('stop', { offset: "0%", stopColor: color, stopOpacity: 0.6, key: "start" }),
                    createElement('stop', { offset: "60%", stopColor: color, stopOpacity: 0.2, key: "mid" }),
                    createElement('stop', { offset: "100%", stopColor: color, stopOpacity: 0.05, key: "end" })
                ]);
            });

            const areas = categories.map((cat, i) => {
                const color = colors[i % colors.length];
                const gradId = `grad-${canvasId}-${i}`;
                return createElement(Area, {
                    type: "monotone",
                    dataKey: cat,
                    stroke: color,
                    strokeWidth: 4,
                    fillOpacity: 1,
                    fill: `url(#${gradId})`,
                    key: `area-${cat}`
                });
            });

            return createElement(ResponsiveContainer, { width: "100%", height: "100%" },
                createElement(AreaChart, { data: transformedData, margin: { top: 10, right: 30, left: 0, bottom: 0 } }, [
                    createElement('defs', { key: "defs" }, gradients),
                    createElement(CartesianGrid, { strokeDasharray: "0", vertical: false, stroke: "#f0f0f0", key: "grid" }),
                    createElement(XAxis, {
                        dataKey: "name",
                        axisLine: false,
                        tickLine: false,
                        tick: { fill: '#334155', fontSize: 12, fontWeight: '500' },
                        dy: 10,
                        key: "xaxis"
                    }),
                    createElement(YAxis, {
                        axisLine: false,
                        tickLine: false,
                        tick: { fill: '#334155', fontSize: 12, fontWeight: '500' },
                        key: "yaxis"
                    }),
                    createElement(Tooltip, {
                        contentStyle: { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                        key: "tooltip"
                    }),
                    createElement(Legend, {
                        verticalAlign: "top",
                        align: "right",
                        iconType: "circle",
                        wrapperStyle: { paddingBottom: "20px", fontSize: '13px', fontWeight: '600' },
                        key: "legend"
                    }),
                    ...areas
                ])
            );
        };

        const root = window.ReactDOM.createRoot(reactRoot);
        root.render(createElement(ChartComponent));
    }
};

window.ChartRenderer = ChartRenderer;
