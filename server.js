/**
 * Instruction Studio — Node.js Backend & Custom AI API Generator Server
 * Allows users to create Custom AI API endpoints with hidden System Instructions & Keys.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5000;
const PUBLIC_DIR = __dirname;
const DB_FILE = path.join(__dirname, 'custom-apis.json');

// Ensure DB file exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Helper: Read/Write Custom APIs DB
function readCustomAPIs() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch {
        return [];
    }
}

function writeCustomAPIs(apis) {
    fs.writeFileSync(DB_FILE, JSON.stringify(apis, null, 2), 'utf-8');
}

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Create HTTP Server
const server = http.createServer((req, res) => {
    // Enable CORS for API requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Custom-API-Key');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // -------------------------------------------------------------
    // ROUTE 1: PUBLIC CUSTOM AI RUNNER (/api/v1/custom/run)
    // Anyone with customApiKey can call this! No instruction or Gemini key required!
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/custom/run') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', async () => {
            try {
                const body = JSON.parse(bodyStr || '{}');
                const authHeader = req.headers['authorization'] || '';
                const headerKey = authHeader.replace(/^Bearer\s+/i, '').trim();
                const customApiKey = body.customApiKey || req.headers['x-custom-api-key'] || headerKey;
                const prompt = body.prompt;

                if (!customApiKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '발급받은 Custom API Key가 필요합니다. Header (Authorization: Bearer sk-inst-...) 또는 body.customApiKey를 제공하세요.' }));
                    return;
                }

                if (!prompt || !prompt.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'prompt 항목을 입력해 주세요.' }));
                    return;
                }

                // Look up Custom API definition
                const apis = readCustomAPIs();
                const targetApi = apis.find(a => a.customApiKey === customApiKey || a.id === customApiKey);

                if (!targetApi) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '유효하지 않은 Custom API Key입니다.' }));
                    return;
                }

                // Execute Gemini call using HIDDEN System Instruction & HIDDEN Gemini Key
                const geminiKey = targetApi.geminiKey || process.env.GEMINI_API_KEY;
                let responseText = '';
                let modelUsed = targetApi.model || 'gemini-flash-lite-latest';

                if (geminiKey && geminiKey !== 'DEMO_KEY') {
                    try {
                        const result = await callGeminiProxy(geminiKey, targetApi.model, targetApi.systemInstruction, prompt);
                        responseText = result.text;
                        modelUsed = result.model;
                    } catch (e) {
                        console.warn(`[Proxy Fallback to Demo Output] ${e.message}`);
                        responseText = `[시뮬레이션 응답] Custom API '${targetApi.name}'이(가) 숨겨진 인스트럭션을 사용하여 성공적으로 응답했습니다:\n\n프롬프트: ${prompt}`;
                    }
                } else {
                    responseText = `[데모 시뮬레이션 응답] Custom API '${targetApi.name}'이(가) 숨겨진 인스트럭션을 사용하여 성공적으로 응답했습니다:\n\n프롬프트: ${prompt}`;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    apiName: targetApi.name,
                    result: responseText,
                    modelUsed
                }));

            } catch (err) {
                console.error('[Custom API Run Error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Custom API 실행 중 오류가 발생했습니다.' }));
            }
        });
        return;
    }

    // -------------------------------------------------------------
    // ROUTE 2: CREATE CUSTOM AI ENDPOINT (/api/v1/custom/create)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/custom/create') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const body = JSON.parse(bodyStr || '{}');
                const { name, systemInstruction, model = 'gemini-flash-lite-latest', apiKey } = body;

                if (!name || !name.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Custom API 이름을 입력해 주세요.' }));
                    return;
                }

                if (!systemInstruction || !systemInstruction.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '내장할 System Instruction을 입력해 주세요.' }));
                    return;
                }

                const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY || 'DEMO_KEY';

                // Generate Secret Custom API Key
                const randomHash = crypto.randomBytes(8).toString('hex');
                const customApiKey = `sk-inst-${randomHash}`;
                const apiId = `api_${randomHash.slice(0, 6)}`;

                const newApiItem = {
                    id: apiId,
                    name: name.trim(),
                    customApiKey,
                    systemInstruction: systemInstruction.trim(),
                    model,
                    geminiKey: effectiveGeminiKey,
                    createdAt: new Date().toISOString()
                };

                const apis = readCustomAPIs();
                apis.unshift(newApiItem);
                writeCustomAPIs(apis);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    api: newApiItem,
                    endpoint: `http://localhost:${PORT}/api/v1/custom/run`
                }));

            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // -------------------------------------------------------------
    // ROUTE 3: LIST CUSTOM APIS (/api/v1/custom/list)
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/v1/custom/list') {
        const apis = readCustomAPIs();
        // Mask Gemini API Key for security in response
        const safeApis = apis.map(a => ({
            id: a.id,
            name: a.name,
            customApiKey: a.customApiKey,
            systemInstructionSnippet: a.systemInstruction.slice(0, 100) + '...',
            model: a.model,
            createdAt: a.createdAt
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, apis: safeApis }));
        return;
    }

    // -------------------------------------------------------------
    // ROUTE 4: DELETE CUSTOM API (/api/v1/custom/delete)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/custom/delete') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const { id } = JSON.parse(bodyStr || '{}');
                let apis = readCustomAPIs();
                apis = apis.filter(a => a.id !== id && a.customApiKey !== id);
                writeCustomAPIs(apis);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // -------------------------------------------------------------
    // ROUTE 5: STANDARD GENERATE PROXY (/api/generate)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/generate') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', async () => {
            try {
                const body = JSON.parse(bodyStr || '{}');
                const { prompt, systemInstruction, model = 'gemini-flash-lite-latest', apiKey } = body;
                const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

                if (!effectiveApiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Gemini API 키를 먼저 입력해 주세요.' }));
                    return;
                }

                if (!prompt || !prompt.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '프롬프트를 입력해 주세요.' }));
                    return;
                }

                const result = await callGeminiProxy(effectiveApiKey, model, systemInstruction, prompt);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));

            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Static File Server
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

/**
 * Call Gemini API with model fallback handling
 */
function callGeminiProxy(apiKey, rawTargetModel, systemInstruction, promptText) {
    const validTargetModel = (typeof rawTargetModel === 'string' && rawTargetModel) ? rawTargetModel : 'gemini-flash-lite-latest';
    return new Promise((resolve, reject) => {
        const candidateModels = [validTargetModel, 'gemini-flash-lite-latest', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-pro'];
        const uniqueModels = [...new Set(candidateModels.filter(m => typeof m === 'string'))];

        tryNextModel(0);

        function tryNextModel(index) {
            if (index >= uniqueModels.length) {
                return reject(new Error('Gemini API 연동 실패: 유효한 API Key 및 쿼터를 확인하세요.'));
            }

            const currentModel = uniqueModels[index];
            const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

            const payload = {
                contents: [
                    {
                        parts: [{ text: promptText }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95
                }
            };

            if (systemInstruction && systemInstruction.trim()) {
                payload.systemInstruction = {
                    parts: [{ text: systemInstruction.trim() }]
                };
            }

            const payloadData = JSON.stringify(payload);

            const req = https.request(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadData)
                }
            }, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData || '{}');

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '응답이 비어있습니다.';
                            return resolve({
                                success: true,
                                text,
                                model: currentModel,
                                raw: parsed
                            });
                        }

                        const errMsg = parsed.error?.message || `HTTP ${res.statusCode}`;

                        if (index + 1 < uniqueModels.length) {
                            tryNextModel(index + 1);
                        } else {
                            reject(new Error(errMsg));
                        }

                    } catch (e) {
                        reject(new Error(`JSON Parse Error: ${e.message}`));
                    }
                });
            });

            req.on('error', (e) => {
                if (index + 1 < uniqueModels.length) {
                    tryNextModel(index + 1);
                } else {
                    reject(e);
                }
            });

            req.write(payloadData);
            req.end();
        }
    });
}

// Start Server
server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Custom AI API Generator Server Running on Port ${PORT}`);
    console.log(`🌐 Web Studio: http://localhost:${PORT}`);
    console.log(`📡 Custom API Runner: POST http://localhost:${PORT}/api/v1/custom/run`);
    console.log(`====================================================`);
});
