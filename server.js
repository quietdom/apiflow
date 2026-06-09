const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const COLLECTIONS_FILE = path.join(__dirname, 'collections.json');

function loadCollections() {
    try {
        if (fs.existsSync(COLLECTIONS_FILE)) {
            return JSON.parse(fs.readFileSync(COLLECTIONS_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Error loading collections:', e.message);
    }
    return [];
}

function saveCollections(collections) {
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2));
}

let collections = loadCollections();

app.post('/api/send', async (req, res) => {
    const { method, url, headers, body } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const startTime = Date.now();

    try {
        const options = {
            method: method || 'GET',
            headers: headers || {},
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const endTime = Date.now();
        const latency = endTime - startTime;

        let responseText;
        try {
            responseText = await response.text();
        } catch (e) {
            responseText = '[Could not read response body]';
        }

        let responseBody;
        try {
            responseBody = JSON.parse(responseText);
        } catch (e) {
            responseBody = responseText;
        }

        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            latency,
            size: responseText.length,
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            latency: Date.now() - startTime,
        });
    }
});

app.get('/api/collections', (req, res) => {
    res.json(collections);
});

app.post('/api/collections', (req, res) => {
    const { name } = req.body;
    const collection = {
        id: uuidv4(),
        name: name || 'New Collection',
        requests: [],
        createdAt: new Date().toISOString(),
    };
    collections.push(collection);
    saveCollections(collections);
    res.json(collection);
});

app.delete('/api/collections/:id', (req, res) => {
    const { id } = req.params;
    collections = collections.filter(c => c.id !== id);
    saveCollections(collections);
    res.json({ success: true });
});

app.post('/api/collections/:id/requests', (req, res) => {
    const { id } = req.params;
    const collection = collections.find(c => c.id === id);
    if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
    }

    const request = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date().toISOString(),
    };

    collection.requests.push(request);
    saveCollections(collections);
    res.json(request);
});

app.delete('/api/collections/:collectionId/requests/:requestId', (req, res) => {
    const { collectionId, requestId } = req.params;
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
    }

    collection.requests = collection.requests.filter(r => r.id !== requestId);
    saveCollections(collections);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`\n  Apiflow is running at http://localhost:${PORT}\n`);
});
