let collections = [];
let currentCollection = null;
let history = [];
let lastResponseData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCollections();
    loadHistory();
    setupEventListeners();
    addParamRow();
    addHeaderRow();
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

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.querySelectorAll('.response-tab').forEach(tab => {
        tab.addEventListener('click', () => switchResponseTab(tab.dataset.responseTab));
    });

    document.getElementById('authTypeSelect').addEventListener('change', updateAuthFields);

    document.querySelectorAll('input[name="bodyType"]').forEach(radio => {
        radio.addEventListener('change', updateBodyType);
    });

    document.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendRequest();
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
    history.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="method-badge ${item.method}">${item.method}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${escapeHtml(item.url)}</span>
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
        div.className = 'collection-item' + (currentCollection?.id === col.id ? ' active' : '');
        div.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span style="flex:1">${escapeHtml(col.name)}</span>
            <button class="delete-btn">&times;</button>
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
                    <button class="delete-btn">&times;</button>
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
        await fetch('/api/collections/' + id, { method: 'DELETE' });
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
        await fetch('/api/collections/' + collectionId + '/requests/' + requestId, {
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
        const editor = document.getElementById('headersEditor');
        editor.innerHTML = '';
        req.headers.forEach(h => addHeaderRowWith(h.key || '', h.value || ''));
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
    btn.innerHTML = '<span class="loading"></span> Sending...';

    const method = document.getElementById('methodSelect').value;
    const reqHeaders = getKvData('headersEditor');
    const reqParams = getKvData('paramsEditor');
    const body = document.getElementById('bodyEditor').value;

    const authType = document.getElementById('authTypeSelect').value;
    if (authType === 'bearer') {
        const token = document.getElementById('authToken')?.value;
        if (token) reqHeaders['Authorization'] = 'Bearer ' + token;
    } else if (authType === 'basic') {
        const user = document.getElementById('authUser')?.value;
        const pass = document.getElementById('authPass')?.value;
        if (user) reqHeaders['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (authType === 'apikey') {
        const key = document.getElementById('authKeyName')?.value;
        const value = document.getElementById('authKeyValue')?.value;
        if (key) reqHeaders[key] = value;
    }

    let fullUrl = url;
    const paramString = reqParams
        .filter(p => p.key)
        .map(p => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value))
        .join('&');
    if (paramString) {
        fullUrl += (url.includes('?') ? '&' : '?') + paramString;
    }

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: method, url: fullUrl, headers: reqHeaders, body: body }),
        });
        const data = await res.json();
        lastResponseData = data;
        displayResponse(data);
        addToHistory({ method: method, url: fullUrl }, data);
    } catch (e) {
        displayResponse({ error: e.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send';
    }
}

function getKvData(editorId) {
    const data = {};
    const rows = document.querySelectorAll('#' + editorId + ' .kv-row');
    rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) return;
        const inputs = row.querySelectorAll('input[type="text"]');
        const key = inputs[0] ? inputs[0].value.trim() : '';
        const value = inputs[1] ? inputs[1].value.trim() : '';
        if (key) data[key] = value;
    });
    return data;
}

function addParamRow() {
    const editor = document.getElementById('paramsEditor');
    editor.appendChild(createKvRow('', '', ''));
}

function addHeaderRow() {
    addHeaderRowWith('', '', '');
}

function addHeaderRowWith(key, value, desc) {
    const editor = document.getElementById('headersEditor');
    editor.appendChild(createKvRow(key || '', value || '', desc || ''));
    updateHeaderBadge();
}

function createKvRow(key, value, desc) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = '<input type="checkbox" checked><input type="text" placeholder="Key" value="' + escapeHtml(key) + '"><input type="text" placeholder="Value" value="' + escapeHtml(value) + '"><input type="text" placeholder="Description" value="' + escapeHtml(desc) + '"><button class="remove-btn">&times;</button>';
    row.querySelector('.remove-btn').addEventListener('click', function() {
        row.remove();
        updateHeaderBadge();
    });
    return row;
}

function updateHeaderBadge() {
    const rows = document.querySelectorAll('#headersEditor .kv-row');
    let filled = 0;
    rows.forEach(function(row) {
        var inputs = row.querySelectorAll('input[type="text"]');
        if (inputs[0] && inputs[0].value.trim()) filled++;
    });
    document.getElementById('headersBadge').textContent = filled;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.add('hidden'); });
    document.getElementById(tabName + 'Panel').classList.remove('hidden');
}

function switchResponseTab(tabName) {
    document.querySelectorAll('.response-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-response-tab="' + tabName + '"]').classList.add('active');
}

function updateAuthFields() {
    var type = document.getElementById('authTypeSelect').value;
    var fields = document.getElementById('authFields');

    if (type === 'none') {
        fields.innerHTML = '';
    } else if (type === 'bearer') {
        fields.innerHTML = '<div class="auth-field"><label>Token</label><input type="text" id="authToken" placeholder="Enter bearer token"></div>';
    } else if (type === 'basic') {
        fields.innerHTML = '<div class="auth-field"><label>Username</label><input type="text" id="authUser" placeholder="Username"></div><div class="auth-field"><label>Password</label><input type="password" id="authPass" placeholder="Password"></div>';
    } else if (type === 'apikey') {
        fields.innerHTML = '<div class="auth-field"><label>Key Name</label><input type="text" id="authKeyName" placeholder="X-API-Key"></div><div class="auth-field"><label>Value</label><input type="text" id="authKeyValue" placeholder="Your API key"></div>';
    }
}

function updateBodyType() {
    var type = document.querySelector('input[name="bodyType"]:checked').value;
    var editor = document.getElementById('bodyEditor');
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
    var editor = document.getElementById('bodyEditor');
    try {
        var parsed = JSON.parse(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // not valid json
    }
}

function displayResponse(data) {
    var area = document.getElementById('responseArea');
    var statusBadge = document.getElementById('statusBadge');
    var timeBadge = document.getElementById('timeBadge');
    var sizeBadge = document.getElementById('sizeBadge');

    if (data.error) {
        area.innerHTML = '<div class="error-box">' + escapeHtml(data.error) + '</div>';
        statusBadge.textContent = 'Error';
        statusBadge.className = 'meta-item error';
        timeBadge.textContent = data.latency ? data.latency + 'ms' : '';
        sizeBadge.textContent = '';
        return;
    }

    var statusClass = data.status < 400 ? 'success' : 'error';
    statusBadge.textContent = data.status + ' ' + data.statusText;
    statusBadge.className = 'meta-item ' + statusClass;
    timeBadge.textContent = data.latency + 'ms';
    sizeBadge.textContent = formatSize(data.size);

    var format = document.getElementById('responseFormat').value;
    if (format === 'pretty' && typeof data.body === 'object') {
        area.innerHTML = syntaxHighlight(JSON.stringify(data.body, null, 2));
    } else if (format === 'raw') {
        area.textContent = typeof data.body === 'object' ? JSON.stringify(data.body) : data.body;
    } else {
        area.textContent = typeof data.body === 'string' ? data.body : JSON.stringify(data.body);
    }

    document.querySelectorAll('.response-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-response-tab="body"]').classList.add('active');
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function(match) {
        var cls = 'json-number';
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
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyResponse() {
    var area = document.getElementById('responseArea');
    navigator.clipboard.writeText(area.textContent).catch(function() {});
}

function downloadResponse() {
    var area = document.getElementById('responseArea');
    var blob = new Blob([area.textContent], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
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
    var modal = document.getElementById('saveModal');
    var select = document.getElementById('saveToCollection');
    select.innerHTML = collections.map(function(c) {
        return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');
    document.getElementById('requestName').value = document.getElementById('urlInput').value.split('/').pop() || '';
    modal.classList.remove('hidden');
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.add('hidden');
}

async function confirmSaveRequest() {
    var name = document.getElementById('requestName').value;
    var collectionId = document.getElementById('saveToCollection').value;
    var col = collections.find(function(c) { return c.id === collectionId; });

    if (!col || !name) return;

    var req = {
        name: name,
        method: document.getElementById('methodSelect').value,
        url: document.getElementById('urlInput').value,
        headers: getKvData('headersEditor'),
        params: getKvData('paramsEditor'),
        body: document.getElementById('bodyEditor').value,
    };

    try {
        var res = await fetch('/api/collections/' + col.id + '/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        var saved = await res.json();
        col.requests.push(saved);
        renderCollections();
        closeSaveModal();
    } catch (e) {
        alert('Failed to save request');
    }
}
