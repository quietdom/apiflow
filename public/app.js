let collections = [];
let currentCollection = null;
let history = [];
let params = [];
let headers = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCollections();
    loadHistory();
    setupEventListeners();
    addParamRow();
    addHeaderRow();
    setupResizeHandle();
});

function setupEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', sendRequest);
    document.getElementById('saveBtn').addEventListener('click', openSaveModal);
    document.getElementById('newCollectionBtn').addEventListener('click', createCollection);
    document.getElementById('addParamBtn').addEventListener('click', addParamRow);
    document.getElementById('addHeaderBtn').addEventListener('click', addHeaderRow);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('pasteBtn').addEventListener('click', pasteFromClipboard);
    document.getElementById('copyResponseBtn').addEventListener('click', copyResponse);
    document.getElementById('downloadResponseBtn').addEventListener('click', downloadResponse);
    document.getElementById('formatBodyBtn').addEventListener('click', formatBody);
    document.getElementById('confirmSave').addEventListener('click', confirmSaveRequest);
    document.getElementById('importBtn').addEventListener('click', importCollection);
    document.getElementById('exportBtn').addEventListener('click', exportCollection);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.querySelectorAll('.response-tab').forEach(tab => {
        tab.addEventListener('click', () => switchResponseTab(tab.dataset.responseTab));
    });

    document.getElementById('authTypeSelect').addEventListener('change', updateAuthFields);
    document.getElementById('responseFormat').addEventListener('change', updateResponseView);

    document.querySelectorAll('input[name="bodyType"]').forEach(radio => {
        radio.addEventListener('change', updateBodyType);
    });

    document.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendRequest();
    });

    document.getElementById('requestTitle')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendRequest();
    });

    document.querySelector('.modal-close')?.addEventListener('click', closeSaveModal);
    document.querySelector('.btn-cancel')?.addEventListener('click', closeSaveModal);
}

function setupResizeHandle() {
    const handle = document.getElementById('resizeHandle');
    const requestSection = document.querySelector('.request-section');
    const responseSection = document.querySelector('.response-section');
    let isResizing = false;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const container = document.querySelector('.content');
        const rect = container.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        const totalHeight = rect.height;
        const requestHeight = Math.max(150, Math.min(offset, totalHeight - 150));
        requestSection.style.flex = 'none';
        requestSection.style.height = requestHeight + 'px';
        responseSection.style.flex = '1';
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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

function loadHistory() {
    try {
        const saved = localStorage.getItem('apiflow_history');
        if (saved) history = JSON.parse(saved);
        renderHistory();
    } catch (e) {
        history = [];
    }
}

function saveHistory() {
    localStorage.setItem('apiflow_history', JSON.stringify(history.slice(0, 50)));
}

function addToHistory(req, res) {
    history.unshift({
        method: req.method,
        url: req.url,
        status: res.status,
        latency: res.latency,
        timestamp: Date.now(),
    });
    history = history.slice(0, 50);
    saveHistory();
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    history.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="method-badge ${item.method}">${item.method}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.url)}</span>
        `;
        div.addEventListener('click', () => {
            document.getElementById('methodSelect').value = item.method;
            document.getElementById('urlInput').value = item.url;
        });
        list.appendChild(div);
    });
}

function clearHistory() {
    history = [];
    localStorage.removeItem('apiflow_history');
    renderHistory();
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('urlInput').value = text;
    } catch (e) {
        console.log('Clipboard access denied');
    }
}

function renderCollections() {
    const list = document.getElementById('collectionsList');
    list.innerHTML = '';

    collections.forEach(col => {
        const div = document.createElement('div');
        div.className = `collection-item ${currentCollection?.id === col.id ? 'active' : ''}`;
        div.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span style="flex:1">${escapeHtml(col.name)}</span>
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
            reqsDiv.className = 'request-children';
            col.requests.forEach(req => {
                const reqDiv = document.createElement('div');
                reqDiv.className = 'saved-request';
                reqDiv.innerHTML = `
                    <span class="method-badge ${req.method}">${req.method}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(req.name || req.url)}</span>
                    <button class="delete-btn" data-id="${req.id}">&times;</button>
                `;
                reqDiv.querySelector('span:nth-child(2)').addEventListener('click', () => loadRequest(req));
                reqDiv.querySelector('.delete-btn').addEventListener('click', (e) => {
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
        document.getElementById('urlInput').focus();
        return;
    }

    btn.disabled = true;
    btn.classList.add('loading');

    const method = document.getElementById('methodSelect').value;
    const reqHeaders = getKvData('headersEditor');
    const reqParams = getKvData('paramsEditor');
    const body = document.getElementById('bodyEditor').value;

    // add auth header
    const authType = document.getElementById('authTypeSelect').value;
    if (authType === 'bearer') {
        const token = document.getElementById('authToken')?.value;
        if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'basic') {
        const user = document.getElementById('authUser')?.value;
        const pass = document.getElementById('authPass')?.value;
        if (user) reqHeaders['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
    } else if (authType === 'apikey') {
        const key = document.getElementById('authKeyName')?.value;
        const value = document.getElementById('authKeyValue')?.value;
        if (key) reqHeaders[key] = value;
    }

    // build url with params
    let fullUrl = url;
    const paramString = reqParams
        .filter(p => p.key)
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');
    if (paramString) {
        fullUrl += (url.includes('?') ? '&' : '?') + paramString;
    }

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, url: fullUrl, headers: reqHeaders, body }),
        });
        const data = await res.json();
        displayResponse(data);
        addToHistory({ method, url: fullUrl }, data);
    } catch (e) {
        displayResponse({ error: e.message });
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

function getKvData(editorId) {
    const data = {};
    const rows = document.querySelectorAll(`#${editorId} .kv-row`);
    rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) return;
        const inputs = row.querySelectorAll('input[type="text"]');
        const key = inputs[0]?.value.trim();
        const value = inputs[1]?.value.trim();
        if (key) data[key] = value;
    });
    return data;
}

function addParamRow() {
    const editor = document.getElementById('paramsEditor');
    const row = createKvRow();
    editor.appendChild(row);
}

function addHeaderRow() {
    const editor = document.getElementById('headersEditor');
    const row = createKvRow();
    editor.appendChild(row);
    updateHeaderBadge();
}

function createKvRow(key = '', value = '', desc = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="checkbox" checked>
        <input type="text" placeholder="Key" value="${escapeHtml(key)}">
        <input type="text" placeholder="Value" value="${escapeHtml(value)}">
        <input type="text" placeholder="Description" value="${escapeHtml(desc)}">
        <button class="remove-btn">&times;</button>
    `;
    row.querySelector('.remove-btn').addEventListener('click', () => {
        row.remove();
        updateHeaderBadge();
    });
    row.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', updateHeaderBadge);
    });
    return row;
}

function renderHeaders() {
    const editor = document.getElementById('headersEditor');
    editor.innerHTML = '';
    headers.forEach(h => {
        editor.appendChild(createKvRow(h.key || '', h.value || '', h.description || ''));
    });
    updateHeaderBadge();
}

function updateHeaderBadge() {
    const rows = document.querySelectorAll('#headersEditor .kv-row');
    const filled = Array.from(rows).filter(row => {
        const inputs = row.querySelectorAll('input[type="text"]');
        return inputs[0]?.value.trim();
    }).length;
    document.getElementById('headersBadge').textContent = filled;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${tabName}Panel`).classList.remove('hidden');
}

function switchResponseTab(tabName) {
    document.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-response-tab="${tabName}"]`).classList.add('active');
}

function updateAuthFields() {
    const type = document.getElementById('authTypeSelect').value;
    const fields = document.getElementById('authFields');

    if (type === 'none') {
        fields.innerHTML = '';
    } else if (type === 'bearer') {
        fields.innerHTML = `
            <div class="auth-field">
                <label>Token</label>
                <input type="text" id="authToken" placeholder="Enter bearer token">
            </div>
        `;
    } else if (type === 'basic') {
        fields.innerHTML = `
            <div class="auth-field">
                <label>Username</label>
                <input type="text" id="authUser" placeholder="Username">
            </div>
            <div class="auth-field">
                <label>Password</label>
                <input type="password" id="authPass" placeholder="Password">
            </div>
        `;
    } else if (type === 'apikey') {
        fields.innerHTML = `
            <div class="auth-field">
                <label>Key Name</label>
                <input type="text" id="authKeyName" placeholder="X-API-Key">
            </div>
            <div class="auth-field">
                <label>Value</label>
                <input type="text" id="authKeyValue" placeholder="Your API key">
            </div>
        `;
    }
}

function updateBodyType() {
    const type = document.querySelector('input[name="bodyType"]:checked').value;
    const editor = document.getElementById('bodyEditor');
    if (type === 'none') {
        editor.disabled = true;
        editor.placeholder = 'Body disabled';
    } else {
        editor.disabled = false;
        if (type === 'json') editor.placeholder = '{\n  "key": "value"\n}';
        else if (type === 'xml') editor.placeholder = '<?xml version="1.0"?>\n<root></root>';
        else if (type === 'text') editor.placeholder = 'Enter text body...';
        else if (type === 'form') editor.placeholder = 'key=value&key2=value2';
    }
}

function formatBody() {
    const editor = document.getElementById('bodyEditor');
    try {
        const parsed = JSON.parse(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // not valid json, do nothing
    }
}

function displayResponse(data) {
    const area = document.getElementById('responseArea');
    const statusBadge = document.getElementById('statusBadge');
    const timeBadge = document.getElementById('timeBadge');
    const sizeBadge = document.getElementById('sizeBadge');

    if (data.error) {
        area.innerHTML = `<div class="error-box">${escapeHtml(data.error)}</div>`;
        statusBadge.textContent = 'Error';
        statusBadge.className = 'meta-item error';
        timeBadge.textContent = data.latency ? `${data.latency}ms` : '';
        sizeBadge.textContent = '';
        return;
    }

    const statusClass = data.status < 400 ? 'success' : 'error';
    statusBadge.textContent = `${data.status} ${data.statusText}`;
    statusBadge.className = `meta-item ${statusClass}`;
    timeBadge.textContent = `${data.latency}ms`;
    sizeBadge.textContent = formatSize(data.size);

    const format = document.getElementById('responseFormat').value;
    if (format === 'pretty' && typeof data.body === 'object') {
        area.innerHTML = syntaxHighlight(JSON.stringify(data.body, null, 2));
    } else if (format === 'raw') {
        area.textContent = typeof data.body === 'object' ? JSON.stringify(data.body) : data.body;
    } else {
        area.textContent = typeof data.body === 'string' ? data.body : JSON.stringify(data.body);
    }

    // switch to body tab
    document.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-response-tab="body"]').classList.add('active');
}

function updateResponseView() {
    const lastData = window.lastResponseData;
    if (lastData) displayResponse(lastData);
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
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function copyResponse() {
    const area = document.getElementById('responseArea');
    try {
        await navigator.clipboard.writeText(area.textContent);
    } catch (e) {
        console.log('Copy failed');
    }
}

function downloadResponse() {
    const area = document.getElementById('responseArea');
    const blob = new Blob([area.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'response.json';
    a.click();
    URL.revokeObjectURL(url);
}

function openSaveModal() {
    if (!currentCollection) {
        alert('Create a collection first');
        return;
    }
    const modal = document.getElementById('saveModal');
    const select = document.getElementById('saveToCollection');
    select.innerHTML = collections.map(c =>
        `<option value="${c.id}" ${c.id === currentCollection?.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    document.getElementById('requestName').value = document.getElementById('urlInput').value.split('/').pop() || '';
    modal.classList.remove('hidden');
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.add('hidden');
}

async function confirmSaveRequest() {
    const name = document.getElementById('requestName').value;
    const collectionId = document.getElementById('saveToCollection').value;
    const col = collections.find(c => c.id === collectionId);

    if (!col || !name) return;

    const req = {
        name,
        method: document.getElementById('methodSelect').value,
        url: document.getElementById('urlInput').value,
        headers: getKvData('headersEditor'),
        params: getKvData('paramsEditor'),
        body: document.getElementById('bodyEditor').value,
    };

    try {
        const res = await fetch(`/api/collections/${col.id}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        const saved = await res.json();
        col.requests.push(saved);
        renderCollections();
        closeSaveModal();
    } catch (e) {
        alert('Failed to save request');
    }
}

function importCollection() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            // TODO: import logic
            alert('Import feature coming soon');
        } catch (err) {
            alert('Invalid JSON file');
        }
    };
    input.click();
}

function exportCollection() {
    if (!currentCollection) {
        alert('Select a collection first');
        return;
    }
    const blob = new Blob([JSON.stringify(currentCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCollection.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
