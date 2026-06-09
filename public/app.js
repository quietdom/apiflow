let collections = [];
let currentCollection = null;
let headers = [{ key: '', value: '' }];

document.addEventListener('DOMContentLoaded', () => {
    loadCollections();
    setupEventListeners();
    addHeaderRow();
});

function setupEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', sendRequest);
    document.getElementById('saveBtn').addEventListener('click', saveRequest);
    document.getElementById('newCollectionBtn').addEventListener('click', createCollection);
    document.getElementById('addHeaderBtn').addEventListener('click', addHeaderRow);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.querySelectorAll('input[name="authType"]').forEach(radio => {
        radio.addEventListener('change', updateAuthFields);
    });

    document.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendRequest();
    });
}

async function loadCollections() {
    try {
        const res = await fetch('/api/collections');
        collections = await res.json();
        renderCollections();
    } catch (e) {
        console.error('Failed to load collections:', e);
    }
}

function renderCollections() {
    const list = document.getElementById('collectionsList');
    list.innerHTML = '';

    collections.forEach(col => {
        const div = document.createElement('div');
        div.className = `collection-item ${currentCollection?.id === col.id ? 'active' : ''}`;
        div.innerHTML = `
            <span>${escapeHtml(col.name)}</span>
            <button class="delete-btn" data-id="${col.id}">&times;</button>
        `;
        div.querySelector('span').addEventListener('click', () => selectCollection(col));
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCollection(col.id);
        });
        list.appendChild(div);

        if (col.requests && col.requests.length > 0) {
            const reqsDiv = document.createElement('div');
            reqsDiv.className = 'saved-requests';
            col.requests.forEach(req => {
                const reqDiv = document.createElement('div');
                reqDiv.className = 'saved-request';
                reqDiv.innerHTML = `
                    <span class="method ${req.method}">${req.method}</span>
                    <span class="name">${escapeHtml(req.name || req.url)}</span>
                    <button class="delete-req" data-id="${req.id}">&times;</button>
                `;
                reqDiv.querySelector('.name').addEventListener('click', () => loadRequest(req));
                reqDiv.querySelector('.delete-req').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteRequest(col.id, req.id);
                });
                reqsDiv.appendChild(reqDiv);
            });
            list.appendChild(reqsDiv);
        }
    });
}

async function createCollection() {
    const name = prompt('Collection name:');
    if (!name) return;

    try {
        const res = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const col = await res.json();
        collections.push(col);
        renderCollections();
    } catch (e) {
        alert('Failed to create collection');
    }
}

async function deleteCollection(id) {
    if (!confirm('Delete this collection?')) return;

    try {
        await fetch(`/api/collections/${id}`, { method: 'DELETE' });
        collections = collections.filter(c => c.id !== id);
        if (currentCollection?.id === id) currentCollection = null;
        renderCollections();
    } catch (e) {
        alert('Failed to delete collection');
    }
}

function selectCollection(col) {
    currentCollection = col;
    renderCollections();
}

async function deleteRequest(collectionId, requestId) {
    try {
        await fetch(`/api/collections/${collectionId}/requests/${requestId}`, {
            method: 'DELETE',
        });
        const col = collections.find(c => c.id === collectionId);
        if (col) {
            col.requests = col.requests.filter(r => r.id !== requestId);
        }
        renderCollections();
    } catch (e) {
        alert('Failed to delete request');
    }
}

function loadRequest(req) {
    document.getElementById('methodSelect').value = req.method;
    document.getElementById('urlInput').value = req.url;
    document.getElementById('bodyEditor').value = req.body || '';

    if (req.headers && req.headers.length > 0) {
        headers = [...req.headers];
        renderHeaders();
    }
}

async function sendRequest() {
    const btn = document.getElementById('sendBtn');
    const url = document.getElementById('urlInput').value;

    if (!url) {
        alert('Please enter a URL');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>';

    const method = document.getElementById('methodSelect').value;
    const reqHeaders = getHeadersFromEditor();
    const body = document.getElementById('bodyEditor').value;

    // add auth header if needed
    const authType = document.querySelector('input[name="authType"]:checked').value;
    if (authType === 'bearer') {
        const token = document.getElementById('bearerToken')?.value;
        if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'basic') {
        const user = document.getElementById('basicUser')?.value;
        const pass = document.getElementById('basicPass')?.value;
        if (user) reqHeaders['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
    }

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, url, headers: reqHeaders, body }),
        });
        const data = await res.json();
        displayResponse(data);
    } catch (e) {
        displayResponse({ error: e.message });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send';
    }
}

function getHeadersFromEditor() {
    const h = {};
    const rows = document.querySelectorAll('#headersEditor .kv-row:not(.kv-header)');
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const key = inputs[0]?.value.trim();
        const value = inputs[1]?.value.trim();
        if (key) h[key] = value;
    });
    return h;
}

function addHeaderRow() {
    const editor = document.getElementById('headersEditor');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" placeholder="Key">
        <input type="text" placeholder="Value">
        <button class="remove-btn">&times;</button>
    `;
    row.querySelector('.remove-btn').addEventListener('click', () => {
        row.remove();
    });
    editor.appendChild(row);
}

function renderHeaders() {
    const editor = document.getElementById('headersEditor');
    editor.innerHTML = `
        <div class="kv-row kv-header">
            <span>Key</span>
            <span>Value</span>
            <span></span>
        </div>
    `;
    headers.forEach(h => {
        const row = document.createElement('div');
        row.className = 'kv-row';
        row.innerHTML = `
            <input type="text" placeholder="Key" value="${escapeHtml(h.key || '')}">
            <input type="text" placeholder="Value" value="${escapeHtml(h.value || '')}">
            <button class="remove-btn">&times;</button>
        `;
        row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
        editor.appendChild(row);
    });
}

async function saveRequest() {
    if (!currentCollection) {
        alert('Select a collection first');
        return;
    }

    const url = document.getElementById('urlInput').value;
    if (!url) {
        alert('Enter a URL first');
        return;
    }

    const name = prompt('Request name:', url.split('/').pop() || url);
    if (!name) return;

    const req = {
        name,
        method: document.getElementById('methodSelect').value,
        url,
        headers: getHeadersFromEditor(),
        body: document.getElementById('bodyEditor').value,
    };

    try {
        const res = await fetch(`/api/collections/${currentCollection.id}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        const saved = await res.json();
        currentCollection.requests.push(saved);
        renderCollections();
    } catch (e) {
        alert('Failed to save request');
    }
}

function displayResponse(data) {
    const area = document.getElementById('responseArea');
    const meta = document.getElementById('responseMeta');

    if (data.error) {
        area.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
        meta.innerHTML = '';
        return;
    }

    const statusClass = data.status < 400 ? 'success' : 'error';
    meta.innerHTML = `
        <span class="status ${statusClass}">${data.status} ${data.statusText}</span>
        <span>${data.latency}ms</span>
        <span>${formatSize(data.size)}</span>
    `;

    if (typeof data.body === 'object') {
        area.innerHTML = syntaxHighlight(JSON.stringify(data.body, null, 2));
    } else {
        area.textContent = data.body;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');
}

function updateAuthFields() {
    const type = document.querySelector('input[name="authType"]:checked').value;
    const fields = document.getElementById('authFields');

    if (type === 'none') {
        fields.innerHTML = '';
    } else if (type === 'bearer') {
        fields.innerHTML = `
            <input type="text" id="bearerToken" placeholder="Token">
        `;
    } else if (type === 'basic') {
        fields.innerHTML = `
            <input type="text" id="basicUser" placeholder="Username">
            <input type="password" id="basicPass" placeholder="Password">
        `;
    }
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
