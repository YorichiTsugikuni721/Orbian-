/**
 * ORBIAN - Universal Document Exporter (Python-Powered)
 * Supports: PPTX, PDF, DOCX, XLSX via server.py API
 */
class DocumentExporter {
    constructor() {
        this.endpoints = {
            pptx: '/api/generate-ppt',
            pdf: '/api/generate-pdf',
            docx: '/api/generate-docx',
            xlsx: '/api/generate-xlsx',
        };
    }

    async export(format, data) {
        const endpoint = this.endpoints[format];
        if (!endpoint) throw new Error(`Unknown format: ${format}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            let errText = 'Server error';
            try { const j = await response.json(); errText = j.error || errText; } catch (_) { }
            throw new Error(`[${response.status}] ${errText}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        let filename = `Orbian_${(data.title || 'Document').replace(/[^a-z0-9_\-]/gi, '_')}.${format}`;
        const disp = response.headers.get('Content-Disposition');
        if (disp) { const m = disp.match(/filename="?([^";\s]+)/i); if (m) filename = m[1]; }

        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return filename;
    }
}

// Keep backward compat alias
window.docExporter = new DocumentExporter();
window.pptExporter = { export: (data) => window.docExporter.export('pptx', data) };
