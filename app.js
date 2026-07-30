/**
 * Instruction Studio — Core Application Logic
 * Gemini API Integration, System Instruction Studio, Hidden API Payload Exporter
 */

// Storage Keys
const STORAGE_KEYS = {
    apiKey: "instruction_studio_gemini_api_key",
    model: "instruction_studio_gemini_model",
    systemInstruction: "instruction_studio_system_inst",
    temp: "instruction_studio_temp",
    activePreset: "instruction_studio_preset_id"
};

// Application State
let appState = {
    apiKey: "",
    model: "gemini-2.0-flash",
    systemInstruction: "",
    userPrompt: "",
    temperature: 0.7,
    attachedFileContent: "",
    attachedFileName: "",
    lastResponseText: "",
    lastPayload: null,
    isGenerating: false
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initSettings();
    renderPresets();
    setupEventListeners();
    updateApiStatus();
});

/**
 * 1. Settings & State Initialization
 */
function initSettings() {
    appState.apiKey = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
    appState.model = localStorage.getItem(STORAGE_KEYS.model) || "gemini-flash-lite-latest";

    let savedInstruction = localStorage.getItem(STORAGE_KEYS.systemInstruction);
    if (!savedInstruction || savedInstruction.includes("코드 리팩토링 전문가")) {
        savedInstruction = INSTRUCTION_PRESETS[0].systemInstruction;
        localStorage.setItem(STORAGE_KEYS.systemInstruction, savedInstruction);
    }
    appState.systemInstruction = savedInstruction;
    appState.temperature = parseFloat(localStorage.getItem(STORAGE_KEYS.temp) || "0.7");

    // Sync UI with state
    const selectEl = document.getElementById("select-model");
    if (selectEl) {
        const validValues = Array.from(selectEl.options).map(opt => opt.value);
        if (!validValues.includes(appState.model)) {
            appState.model = "gemini-flash-lite-latest";
            localStorage.setItem(STORAGE_KEYS.model, "gemini-flash-lite-latest");
        }
        selectEl.value = appState.model;
    }
    document.getElementById("system-instruction-input").value = appState.systemInstruction;
    document.getElementById("input-temp").value = appState.temperature;
    document.getElementById("val-temp").textContent = appState.temperature.toFixed(1);

    if (appState.apiKey) {
        document.getElementById("input-api-key").value = appState.apiKey;
        fetchAvailableModels();
    }
}

/**
 * 1.5 Dynamically Fetch Available Models from User's API Key
 */
async function fetchAvailableModels() {
    if (!appState.apiKey) return;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${appState.apiKey}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.models && Array.isArray(data.models)) {
            const validModels = data.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name.replace("models/", ""));

            if (validModels.length > 0) {
                const selectEl = document.getElementById("select-model");
                const currentVal = selectEl.value;

                selectEl.innerHTML = validModels.map(m => {
                    let displayName = m;
                    if (m === "gemini-1.5-flash-latest" || m === "gemini-1.5-flash-002" || m === "gemini-1.5-flash") {
                        displayName += " (권장 Flash)";
                    } else if (m.includes("2.0")) {
                        displayName += " (2.0 차세대)";
                    } else if (m.includes("pro")) {
                        displayName += " (Pro 고성능)";
                    }
                    return `<option value="${m}">${displayName}</option>`;
                }).join('');

                if (validModels.includes(currentVal)) {
                    selectEl.value = currentVal;
                } else if (validModels.includes("gemini-1.5-flash-latest")) {
                    selectEl.value = "gemini-1.5-flash-latest";
                    appState.model = "gemini-1.5-flash-latest";
                } else if (validModels.includes("gemini-1.5-flash-002")) {
                    selectEl.value = "gemini-1.5-flash-002";
                    appState.model = "gemini-1.5-flash-002";
                } else {
                    selectEl.value = validModels[0];
                    appState.model = validModels[0];
                }
            }
        }
    } catch (e) {
        console.warn("ListModels fetch error:", e);
    }
}

/**
 * 2. Render Instruction Presets Grid
 */
function renderPresets() {
    const container = document.getElementById("presets-container");
    if (!container || typeof INSTRUCTION_PRESETS === "undefined") return;

    container.innerHTML = INSTRUCTION_PRESETS.map(preset => `
        <div class="preset-chip" data-id="${preset.id}">
            <div class="preset-chip-title">${preset.title}</div>
            <div class="preset-chip-desc">${preset.description}</div>
        </div>
    `).join('');

    // Attach click events to presets
    container.querySelectorAll(".preset-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const presetId = chip.getAttribute("data-id");
            selectPreset(presetId);
        });
    });
}

function selectPreset(presetId) {
    const preset = INSTRUCTION_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    // Update active UI
    document.querySelectorAll(".preset-chip").forEach(c => c.classList.remove("active"));
    const activeChip = document.querySelector(`.preset-chip[data-id="${presetId}"]`);
    if (activeChip) activeChip.classList.add("active");

    // Apply System Instruction
    appState.systemInstruction = preset.systemInstruction;
    document.getElementById("system-instruction-input").value = preset.systemInstruction;
    localStorage.setItem(STORAGE_KEYS.systemInstruction, preset.systemInstruction);

    showToast(`'${preset.title}' 인스트럭션이 적용되었습니다.`, "success");
}

/**
 * 3. Setup Event Listeners
 */
function setupEventListeners() {
    // API Key Modal Controls
    const apiModal = document.getElementById("api-modal");
    document.getElementById("btn-open-api-modal").addEventListener("click", () => apiModal.classList.add("active"));
    document.getElementById("btn-close-api-modal").addEventListener("click", () => apiModal.classList.remove("active"));

    document.getElementById("btn-toggle-key-visibility").addEventListener("click", () => {
        const input = document.getElementById("input-api-key");
        const icon = document.querySelector("#btn-toggle-key-visibility i");
        if (input.type === "password") {
            input.type = "text";
            icon.className = "fa-solid fa-eye-slash";
        } else {
            input.type = "password";
            icon.className = "fa-solid fa-eye";
        }
    });

    document.getElementById("btn-save-api-key").addEventListener("click", saveApiKey);
    document.getElementById("btn-remove-api-key").addEventListener("click", removeApiKey);
    document.getElementById("btn-test-api-key").addEventListener("click", testApiKeyConnection);

    // Model & Hyperparameter Listeners
    document.getElementById("select-model").addEventListener("change", (e) => {
        appState.model = e.target.value;
        localStorage.setItem(STORAGE_KEYS.model, appState.model);
    });

    const tempInput = document.getElementById("input-temp");
    tempInput.addEventListener("input", (e) => {
        appState.temperature = parseFloat(e.target.value);
        document.getElementById("val-temp").textContent = appState.temperature.toFixed(1);
        localStorage.setItem(STORAGE_KEYS.temp, appState.temperature);
    });

    // System Instruction Textarea
    document.getElementById("system-instruction-input").addEventListener("input", (e) => {
        appState.systemInstruction = e.target.value;
        localStorage.setItem(STORAGE_KEYS.systemInstruction, appState.systemInstruction);
    });

    document.getElementById("btn-reset-instruction").addEventListener("click", () => {
        selectPreset(INSTRUCTION_PRESETS[0].id);
    });

    // User Input & Prompt Listeners
    document.getElementById("btn-clear-input").addEventListener("click", () => {
        document.getElementById("user-prompt-input").value = "";
        clearFileAttachment();
        showToast("입력이 지워졌습니다.", "info");
    });

    const promptInput = document.getElementById("user-prompt-input");
    promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            generateResponse();
        }
    });

    // Dropzone File Drag & Drop
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");

    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelect);

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    // Generate Button
    document.getElementById("btn-generate").addEventListener("click", generateResponse);

    // Output Action Buttons
    document.getElementById("btn-copy-output").addEventListener("click", copyOutputText);
    document.getElementById("btn-toggle-raw").addEventListener("click", toggleRawOutput);

    // Payload Modal Controls
    const payloadModal = document.getElementById("payload-modal");
    document.getElementById("btn-open-payload-modal").addEventListener("click", () => {
        updatePayloadModalDisplay();
        payloadModal.classList.add("active");
    });
    document.getElementById("btn-close-payload-modal").addEventListener("click", () => payloadModal.classList.remove("active"));
    document.getElementById("btn-copy-payload").addEventListener("click", copyPayloadContent);

    // Payload Tab Switches
    document.getElementById("tab-curl").addEventListener("click", (e) => switchPayloadTab("curl", e.target));
    document.getElementById("tab-json").addEventListener("click", (e) => switchPayloadTab("json", e.target));
    document.getElementById("tab-fetch").addEventListener("click", (e) => switchPayloadTab("fetch", e.target));

    // Custom API Studio Modal Controls
    const customModal = document.getElementById("custom-api-modal");
    document.getElementById("btn-open-custom-modal").addEventListener("click", () => {
        fetchCustomAPIs();
        customModal.classList.add("active");
    });
    document.getElementById("btn-close-custom-modal").addEventListener("click", () => customModal.classList.remove("active"));
    document.getElementById("btn-create-custom-api").addEventListener("click", createCustomAPI);

    // Custom API Runner Modal Controls
    const runnerModal = document.getElementById("custom-api-runner-modal");
    document.getElementById("btn-open-runner-modal").addEventListener("click", () => {
        runnerModal.classList.add("active");
    });
    document.getElementById("btn-close-runner-modal").addEventListener("click", () => runnerModal.classList.remove("active"));
    document.getElementById("btn-run-custom-api-test").addEventListener("click", executeCustomAPIRunner);
}

/**
 * 3.5 Custom AI API Generator Functions
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function fetchCustomAPIs() {
    const listContainer = document.getElementById("custom-api-list");
    if (!listContainer) return;

    try {
        const res = await fetch("/api/v1/custom/list");
        const data = await res.json();

        if (!data.success || !Array.isArray(data.apis) || data.apis.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">
                아직 발급된 Custom API가 없습니다. 상단에서 인스트럭션이 적용된 나만의 API를 발급해 보세요!
            </div>`;
            return;
        }

        const host = window.location.host;
        listContainer.innerHTML = "";

        data.apis.forEach(api => {
            const curlCmd = `curl -X POST "http://${host}/api/v1/custom/run" \\
  -H "Authorization: Bearer ${api.customApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "사용자 질문 내용"}'`;

            const item = document.createElement("div");
            item.style.cssText = "background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem; display:flex; flex-direction:column; gap:0.6rem;";

            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:700; font-size:0.95rem; color:var(--primary);">
                        <i class="fa-solid fa-cube"></i> ${escapeHtml(api.name)}
                    </div>
                    <div style="display:flex; gap:0.4rem; align-items:center;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(api.createdAt).toLocaleDateString()}</span>
                        <button class="btn-icon btn-delete-custom" style="color:var(--danger); padding:0.25rem 0.5rem;" title="삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                
                <div style="font-size:0.88rem; color:var(--text-muted);">
                    🔑 Secret Custom API Key: <code style="color:var(--primary); font-family:'Fira Code', monospace; background:rgba(0,242,254,0.1); padding:0.2rem 0.5rem; border-radius:4px;">${escapeHtml(api.customApiKey)}</code>
                </div>

                <div style="position:relative;">
                    <pre style="background:#050811; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:0.8rem; font-family:'Fira Code', monospace; font-size:0.78rem; color:#a5f3fc; overflow-x:auto; white-space:pre-wrap; max-height:120px;">${escapeHtml(curlCmd)}</pre>
                    <div style="position:absolute; top:6px; right:6px; display:flex; gap:0.4rem;">
                        <button class="btn btn-primary btn-test-custom" style="font-size:0.72rem; padding:0.25rem 0.6rem;">
                            <i class="fa-solid fa-gamepad"></i> 바로 테스트하기
                        </button>
                        <button class="btn btn-secondary btn-copy-curl" style="font-size:0.72rem; padding:0.25rem 0.6rem;">
                            <i class="fa-solid fa-copy"></i> cURL 복사
                        </button>
                    </div>
                </div>
            `;

            const btnTest = item.querySelector(".btn-test-custom");
            if (btnTest) {
                btnTest.addEventListener("click", () => {
                    const customModal = document.getElementById("custom-api-modal");
                    if (customModal) customModal.classList.remove("active");

                    const runnerModal = document.getElementById("custom-api-runner-modal");
                    const apiKeyInput = document.getElementById("runner-api-key");
                    if (apiKeyInput) apiKeyInput.value = api.customApiKey;

                    if (runnerModal) runnerModal.classList.add("active");
                });
            }

            const btnCopy = item.querySelector(".btn-copy-curl");
            if (btnCopy) {
                btnCopy.addEventListener("click", () => {
                    navigator.clipboard.writeText(curlCmd).then(() => {
                        showToast("cURL 호출 명령어가 복사되었습니다!", "success");
                    });
                });
            }

            const btnDelete = item.querySelector(".btn-delete-custom");
            if (btnDelete) {
                btnDelete.addEventListener("click", () => {
                    deleteCustomAPI(api.id);
                });
            }

            listContainer.appendChild(item);
        });

    } catch (err) {
        console.error("Custom API list fetch error:", err);
    }
}

async function executeCustomAPIRunner() {
    const keyInput = document.getElementById("runner-api-key");
    const promptInput = document.getElementById("runner-prompt-input");
    const btnRun = document.getElementById("btn-run-custom-api-test");
    const outputBox = document.getElementById("runner-output-box");
    const statusInfo = document.getElementById("runner-status-info");

    const customApiKey = keyInput ? keyInput.value.trim() : "";
    const prompt = promptInput ? promptInput.value.trim() : "";

    if (!customApiKey) {
        showToast("Custom API Key (sk-inst-...)를 입력해 주세요.", "error");
        if (keyInput) keyInput.focus();
        return;
    }

    if (!prompt) {
        showToast("테스트할 질문(프롬프트)을 입력해 주세요.", "error");
        if (promptInput) promptInput.focus();
        return;
    }

    btnRun.disabled = true;
    btnRun.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> API 호출 중...`;
    outputBox.innerHTML = `<span style="color:var(--primary); font-weight:600;"><span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> 로컬 API 호출 중... (http://localhost:5000/api/v1/custom/run)</span>`;
    statusInfo.textContent = "요청 처리 중...";

    try {
        const res = await fetch("/api/v1/custom/run", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${customApiKey}`
            },
            body: JSON.stringify({ prompt, customApiKey })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || `HTTP 오류 ${res.status}`);
        }

        statusInfo.textContent = `✓ 성공 (API: ${data.apiName || 'Custom API'} / 모델: ${data.modelUsed || 'Gemini'})`;
        outputBox.innerHTML = renderMarkdown(data.result || "응답 내용이 없습니다.");
        showToast(`🎉 '${data.apiName || 'Custom API'}' 호출 테스트 성공!`, "success");

    } catch (err) {
        statusInfo.textContent = "❌ 호출 실패";
        let errMsg = err.message;
        if (errMsg.includes("Failed to fetch")) {
            errMsg = "Node.js 서버가 꺼져 있거나 file:// 경로로 접속했습니다. http://localhost:5000 으로 접속해주세요.";
        }
        outputBox.innerHTML = `<div style="color:var(--danger); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> 오류 발생: ${escapeHtml(errMsg)}</div>`;
        showToast(`호출 실패: ${errMsg}`, "error");
    } finally {
        btnRun.disabled = false;
        btnRun.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ⚡ Custom API 호출 테스트`;
    }
}

async function createCustomAPI() {
    const nameInput = document.getElementById("custom-api-name");
    const btnCreate = document.getElementById("btn-create-custom-api");
    const name = nameInput.value.trim();
    const systemInstruction = appState.systemInstruction;
    const model = appState.model;
    const apiKey = appState.apiKey;

    if (!name) {
        showToast("Custom API 이름을 입력해 주세요.", "error");
        nameInput.focus();
        return;
    }

    if (!systemInstruction) {
        showToast("내장할 시스템 인스트럭션을 작성해 주세요.", "error");
        return;
    }

    btnCreate.disabled = true;
    btnCreate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...`;

    try {
        const res = await fetch("/api/v1/custom/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                systemInstruction,
                model,
                apiKey
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || "Custom API 생성 실패");
        }

        nameInput.value = "";
        showToast(`🚀 '${name}' Custom AI API가 성공적으로 생성 및 발급되었습니다!`, "success");
        await fetchCustomAPIs();

    } catch (err) {
        let errMsg = err.message;
        if (errMsg.includes("Failed to fetch")) {
            errMsg = "Node.js 서버가 꺼져 있거나 file:// 경로로 접속했습니다. 터미널에서 'node server.js'를 실행하고 http://localhost:5000 으로 접속해주세요.";
        }
        showToast(`생성 오류: ${errMsg}`, "error");
    } finally {
        btnCreate.disabled = false;
        btnCreate.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Custom API 엔드포인트 발급하기`;
    }
}

async function deleteCustomAPI(id) {
    if (!confirm("정말 이 Custom API 엔드포인트를 삭제하시겠습니까?")) return;

    try {
        const res = await fetch("/api/v1/custom/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Custom API가 삭제되었습니다.", "info");
            fetchCustomAPIs();
        }
    } catch (err) {
        showToast(`삭제 오류: ${err.message}`, "error");
    }
}

function copyTextToClipboard(encodedText) {
    const raw = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(raw).then(() => {
        showToast("cURL 호출 명령어가 복사되었습니다!", "success");
    });
}

/**
 * 4. API Key Management & Connection Test
 */
async function testApiKeyConnection() {
    const key = document.getElementById("input-api-key").value.trim();
    const resultBox = document.getElementById("api-test-result");

    if (!key) {
        resultBox.style.display = "block";
        resultBox.style.background = "rgba(239, 68, 68, 0.1)";
        resultBox.style.border = "1px solid rgba(239, 68, 68, 0.3)";
        resultBox.style.color = "#fca5a5";
        resultBox.innerHTML = "<i class='fa-solid fa-circle-exclamation'></i> API 키를 입력한 후 테스트해 주세요.";
        return;
    }

    resultBox.style.display = "block";
    resultBox.style.background = "rgba(0, 242, 254, 0.1)";
    resultBox.style.border = "1px solid rgba(0, 242, 254, 0.3)";
    resultBox.style.color = "#a5f3fc";
    resultBox.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Google Gemini API 연결 테스트 중...";

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.message || `HTTP ${res.status}`);
        }

        const count = data.models ? data.models.length : 0;
        resultBox.style.background = "rgba(16, 185, 129, 0.1)";
        resultBox.style.border = "1px solid rgba(16, 185, 129, 0.3)";
        resultBox.style.color = "#6ee7b7";
        resultBox.innerHTML = `<strong><i class="fa-solid fa-circle-check"></i> 연결 성공!</strong><br>Google AI Studio API 연결이 정상 확인되었습니다. (사용 가능 모델 ${count}개)`;
        showToast("API 키 연결 테스트 성공!", "success");

    } catch (err) {
        resultBox.style.background = "rgba(239, 68, 68, 0.1)";
        resultBox.style.border = "1px solid rgba(239, 68, 68, 0.3)";
        resultBox.style.color = "#fca5a5";
        resultBox.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation"></i> 연결 실패:</strong><br>${err.message}`;
        showToast(`API 연결 실패: ${err.message}`, "error");
    }
}

function saveApiKey() {
    const key = document.getElementById("input-api-key").value.trim();
    if (!key) {
        showToast("API 키를 입력해 주세요.", "error");
        return;
    }
    appState.apiKey = key;
    localStorage.setItem(STORAGE_KEYS.apiKey, key);
    updateApiStatus();
    fetchAvailableModels();
    document.getElementById("api-modal").classList.remove("active");
    showToast("Gemini API 키가 저장되었습니다.", "success");
}

function removeApiKey() {
    appState.apiKey = "";
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    document.getElementById("input-api-key").value = "";
    document.getElementById("api-test-result").style.display = "none";
    updateApiStatus();
    showToast("API 키가 삭제되었습니다.", "info");
}

function updateApiStatus() {
    const pill = document.getElementById("api-status-pill");
    const statusText = document.getElementById("api-status-text");

    if (appState.apiKey) {
        pill.classList.add("active");
        statusText.textContent = "✓ API 연결됨";
    } else {
        pill.classList.remove("active");
        statusText.textContent = "API 키 미등록";
    }
}

/**
 * 5. File Attachment Handling
 */
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
}

function processFile(file) {
    if (file.size > 2 * 1024 * 1024) {
        showToast("파일 크기는 2MB 이하만 지원됩니다.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        appState.attachedFileContent = e.target.result;
        appState.attachedFileName = file.name;
        document.getElementById("attached-file-info").textContent = `📎 첨부됨: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        showToast(`파일 '${file.name}' 첨부 완료`, "success");
    };
    reader.readAsText(file);
}

function clearFileAttachment() {
    appState.attachedFileContent = "";
    appState.attachedFileName = "";
    document.getElementById("attached-file-info").textContent = "";
    document.getElementById("file-input").value = "";
}

/**
 * 6. Gemini REST API Execution with Auto-Fallback
 */
async function generateResponse(overrideModel = null) {
    if (appState.isGenerating) return;

    if (!appState.apiKey) {
        showToast("Gemini API 키가 필요합니다. 상단의 API 키 설정을 완료하세요.", "error");
        document.getElementById("api-modal").classList.add("active");
        return;
    }

    const promptText = document.getElementById("user-prompt-input").value.trim();
    let fullPrompt = promptText;

    if (appState.attachedFileContent) {
        fullPrompt += `\n\n[첨부 파일 내용: ${appState.attachedFileName}]\n${appState.attachedFileContent}`;
    }

    if (!fullPrompt) {
        showToast("사용자 입력 텍스트 또는 파일을 첨부해 주세요.", "error");
        return;
    }

    const selectEl = document.getElementById("select-model");
    const targetModel = overrideModel || (selectEl ? selectEl.value : appState.model) || "gemini-1.5-flash";
    appState.model = targetModel;

    appState.isGenerating = true;
    const btnGenerate = document.getElementById("btn-generate");
    btnGenerate.disabled = true;
    btnGenerate.innerHTML = `<span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> 생성 중... (${targetModel})`;

    // Show Loading State in Output Panel
    const placeholder = document.getElementById("output-placeholder");
    const content = document.getElementById("output-content");
    const raw = document.getElementById("output-raw");

    placeholder.style.display = "none";
    raw.style.display = "none";
    content.style.display = "block";
    content.innerHTML = `<div style="display:flex; align-items:center; gap:0.6rem; color:var(--primary); font-weight:600;"><span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> AI 시스템 인스트럭션 실행 중 (${targetModel})...</div>`;

    // Prepare Proxy API Request Payload
    const requestBody = {
        prompt: fullPrompt,
        systemInstruction: appState.systemInstruction,
        model: targetModel,
        apiKey: appState.apiKey
    };

    appState.lastPayload = requestBody;

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const errorMsg = data.error || `HTTP 오류 ${response.status}`;

            // If any non-default model fails (quota limit, model not found, rate limit, etc.), auto-fallback to gemini-1.5-flash
            if (targetModel !== "gemini-1.5-flash") {
                console.warn(`[Auto-Fallback] Model ${targetModel} failed (${errorMsg}). Fallback to gemini-1.5-flash...`);
                appState.isGenerating = false;

                appState.model = "gemini-1.5-flash";
                const selectEl = document.getElementById("select-model");
                if (selectEl) selectEl.value = "gemini-1.5-flash";
                localStorage.setItem(STORAGE_KEYS.model, "gemini-1.5-flash");

                showToast(`⚡ '${targetModel}' 모델 호환/쿼터 오류 발생! Gemini 1.5 Flash 모델로 자동 우회 실행합니다...`, "warning");
                return generateResponse("gemini-1.5-flash");
            }

            throw new Error(errorMsg);
        }

        const responseText = data.text || "응답 내용이 없습니다.";
        appState.lastResponseText = responseText;


        content.innerHTML = renderMarkdown(responseText);
        raw.textContent = responseText;
        attachCodeCopyListeners();

        showToast(`성공적으로 AI 인스트럭션 응답이 생성되었습니다! (${targetModel})`, "success");

    } catch (err) {
        console.error("Gemini API Error:", err);

        const isZeroQuota = err.message.includes("limit: 0") || err.message.includes("limit:0");
        const isQuotaErr = err.message.includes("Quota exceeded") || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED");
        const isNotFoundErr = err.message.includes("not found") || err.message.includes("404");

        // Check for Limit: 0 (API Key has 0 quota assigned by Google Cloud Project)
        if (isZeroQuota) {
            let errorContent = `<div style="color:#f59e0b; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.3); padding:1.4rem; border-radius:var(--radius-md);">
                <strong style="display:flex; align-items:center; gap:0.5rem; font-size:1.1rem; color:#f59e0b;">
                    <i class="fa-solid fa-triangle-exclamation"></i> API 키 쿼터 0 오류 안내 (Google Cloud Limit: 0)
                </strong>
                <p style="margin-top:0.6rem; font-size:0.9rem; line-height:1.6; color:var(--text-main);">
                    현재 입력하신 API 키의 Google Cloud 프로젝트에 할당량(Quota)이 <b>0 (limit: 0)</b>으로 설정되어 있어 Google API 호출이 거부되었습니다.<br>
                    (Google 계정 기본 프로젝트 정책 변동으로 발생한 현상입니다.)
                </p>
                
                <div style="margin-top:1rem; padding:1rem; background:rgba(0,0,0,0.3); border-radius:var(--radius-md); font-size:0.85rem; color:#d1d5db; line-height:1.6;">
                    <strong style="color:var(--primary);"><i class="fa-solid fa-wrench"></i> 1분 해결 방법:</strong>
                    <ol style="margin-left:1.4rem; margin-top:0.4rem;">
                        <li><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:underline;">Google AI Studio API Key 페이지</a>에 접속합니다.</li>
                        <li><b>[Create API Key in new project (새 프로젝트에서 API 키 생성)]</b> 버튼을 눌러 새로 발급받습니다.</li>
                        <li>새 API 키를 상단 <b>[API 키 설정]</b>에 입력하면 즉시 100% 정상 작동합니다!</li>
                    </ol>
                </div>

                <div style="display:flex; gap:0.8rem; margin-top:1.2rem;">
                    <button id="btn-open-api-modal-fix" class="btn btn-primary" style="font-size:0.85rem;">
                        <i class="fa-solid fa-key"></i> 새 API 키 등록하기
                    </button>
                    <button id="btn-run-demo-mode" class="btn btn-accent" style="font-size:0.85rem;">
                        🎮 데모 시뮬레이션으로 미리보기
                    </button>
                </div>
            </div>`;

            content.innerHTML = errorContent;

            if (document.getElementById("btn-open-api-modal-fix")) {
                document.getElementById("btn-open-api-modal-fix").addEventListener("click", () => {
                    document.getElementById("api-modal").classList.add("active");
                });
            }

            if (document.getElementById("btn-run-demo-mode")) {
                document.getElementById("btn-run-demo-mode").addEventListener("click", () => {
                    generateDemoResponse();
                });
            }

            showToast("API Key 쿼터(Limit: 0) 오류입니다. 새 API 키 발급이 필요합니다.", "error");

        } else if (isQuotaErr) {
            const match = err.message.match(/retry in ([\d\.]+)s/i);
            let retrySeconds = match ? Math.ceil(parseFloat(match[1])) : 20;
            let currentSec = retrySeconds;

            let errorContent = `<div style="color:var(--warning); background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); padding:1.25rem; border-radius:var(--radius-md);">
                <strong style="display:flex; align-items:center; gap:0.5rem; font-size:1.05rem; color:var(--warning);">
                    <i class="fa-solid fa-hourglass-half"></i> Google API 요청 쿨다운 대기중 (Rate Limit Cooldown)
                </strong>
                <p style="margin-top:0.6rem; font-size:0.88rem; line-height:1.6; color:var(--text-main);">
                    Google AI Studio 무료 티어 분당 제한(15 RPM)에 도달하여 잠시 대기 중입니다.<br>
                    <b><span id="cooldown-sec-num" style="color:var(--primary); font-size:1.15rem; font-weight:700;">${currentSec}</span>초 후</b> 자동으로 AI 인스트럭션 요청을 재시도합니다.
                </p>
                <div style="display:flex; gap:0.6rem; margin-top:1rem;">
                    <button id="btn-cancel-retry" class="btn btn-secondary" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
                        ⏹️ 취소
                    </button>
                    <button id="btn-force-retry" class="btn btn-primary" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
                        ⚡ 지금 바로 다시 시도
                    </button>
                    <button id="btn-demo-fallback" class="btn btn-accent" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
                        🎮 데모 실행
                    </button>
                </div>
            </div>`;

            content.innerHTML = errorContent;

            if (window.cooldownTimerInterval) clearInterval(window.cooldownTimerInterval);

            window.cooldownTimerInterval = setInterval(() => {
                currentSec--;
                const secEl = document.getElementById("cooldown-sec-num");
                if (secEl) secEl.textContent = currentSec;

                if (currentSec <= 0) {
                    clearInterval(window.cooldownTimerInterval);
                    showToast("쿨다운 완료! AI 인스트럭션 자동 재시도 중...", "info");
                    generateResponse("gemini-1.5-flash");
                }
            }, 1000);

            if (document.getElementById("btn-cancel-retry")) {
                document.getElementById("btn-cancel-retry").addEventListener("click", () => {
                    clearInterval(window.cooldownTimerInterval);
                    placeholder.style.display = "flex";
                    content.style.display = "none";
                });
            }

            if (document.getElementById("btn-force-retry")) {
                document.getElementById("btn-force-retry").addEventListener("click", () => {
                    clearInterval(window.cooldownTimerInterval);
                    generateResponse("gemini-1.5-flash");
                });
            }

            if (document.getElementById("btn-demo-fallback")) {
                document.getElementById("btn-demo-fallback").addEventListener("click", () => {
                    clearInterval(window.cooldownTimerInterval);
                    generateDemoResponse();
                });
            }

            showToast(`API 쿨다운 대기: ${retrySeconds}초 후 자동 재시도됩니다.`, "warning");

        } else if (isNotFoundErr) {
            let errorContent = `<div style="color:var(--danger); background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); padding:1.2rem; border-radius:var(--radius-md);">
                <strong style="display:flex; align-items:center; gap:0.5rem; font-size:1.05rem;"><i class="fa-solid fa-triangle-exclamation"></i> 모델 지원 오류</strong>
                <p style="margin-top:0.6rem; font-size:0.88rem; line-height:1.5; color:#fca5a5;">${err.message}</p>
                <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(239,68,68,0.2); display:flex; gap:0.6rem;">
                    <button id="btn-switch-to-flash" class="btn btn-primary" style="font-size:0.82rem; padding:0.4rem 0.9rem;">
                        ⚡ Gemini 1.5 Flash 모델로 전환 후 실행
                    </button>
                </div>
            </div>`;
            content.innerHTML = errorContent;

            if (document.getElementById("btn-switch-to-flash")) {
                document.getElementById("btn-switch-to-flash").addEventListener("click", () => {
                    appState.model = "gemini-1.5-flash";
                    const selectEl = document.getElementById("select-model");
                    if (selectEl) selectEl.value = "gemini-1.5-flash";
                    localStorage.setItem(STORAGE_KEYS.model, "gemini-1.5-flash");
                    generateResponse("gemini-1.5-flash");
                });
            }
            showToast(`모델 오류: ${err.message}`, "error");
        } else {
            let errorContent = `<div style="color:var(--danger); background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); padding:1.2rem; border-radius:var(--radius-md);">
                <strong style="display:flex; align-items:center; gap:0.5rem; font-size:1.05rem;"><i class="fa-solid fa-circle-exclamation"></i> 오류 발생</strong>
                <p style="margin-top:0.4rem; font-size:0.9rem;">${err.message}</p>
            </div>`;
            content.innerHTML = errorContent;
            showToast(`오류: ${err.message}`, "error");
        }
    } finally {
        appState.isGenerating = false;
        btnGenerate.disabled = false;
        btnGenerate.innerHTML = `<i class="fa-solid fa-bolt"></i> AI 인스트럭션 실행하기`;
    }
}

/**
 * 6.5 Demo Simulation Response Mode
 */
function generateDemoResponse() {
    const promptText = document.getElementById("user-prompt-input").value.trim() || "입력 예시";
    const systemInst = appState.systemInstruction;

    const content = document.getElementById("output-content");
    const raw = document.getElementById("output-raw");
    const placeholder = document.getElementById("output-placeholder");

    placeholder.style.display = "none";
    raw.style.display = "none";
    content.style.display = "block";

    let demoText = `### 🎮 AI 인스트럭션 데모 시뮬레이션 결과

> **설정된 시스템 인스트럭션**:
> _${systemInst.split('\n')[0]}..._

---

#### 💡 입력 프롬프트 분석
입력하신 내용 \`${promptText}\`에 대해 설정된 AI 시스템 인스트럭션 지침에 맞춰 처리된 결과입니다.

\`\`\`javascript
// AI 인스트럭션 처리 예시 코드
function processInstruction(input, instruction) {
    console.log("System Instruction Active:", instruction);
    return {
        status: "success",
        processedPrompt: input,
        timestamp: new Date().toISOString()
    };
}
\`\`\`

#### 📌 결론 및 가이드
- 현재 데모 시뮬레이션 모드로 실행되었습니다.
- **[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)** 에 접속하여 **새 프로젝트에서 API 키 생성**을 하시면 실제 실시간 Gemini 모델과 연동됩니다!`;

    appState.lastResponseText = demoText;
    content.innerHTML = renderMarkdown(demoText);
    raw.textContent = demoText;
    attachCodeCopyListeners();

    showToast("🎮 데모 시뮬레이션 결과가 생성되었습니다!", "success");
}

/**
 * 7. Lightweight Markdown Parser & Code Wrapper
 */
function renderMarkdown(md) {
    if (!md) return "";

    // Escape basic HTML
    let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Code Blocks ```lang ... ```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'text';
        return `<div class="code-block-wrapper">
            <div class="code-header">
                <span><i class="fa-solid fa-code"></i> ${language}</span>
                <button class="btn-copy-code" data-code="${encodeURIComponent(code.trim())}" style="background:transparent; border:none; color:var(--primary); cursor:pointer; font-weight:600; font-size:0.75rem;">
                    <i class="fa-solid fa-copy"></i> 복사
                </button>
            </div>
            <pre><code class="language-${language}">${code.trim()}</code></pre>
        </div>`;
    });

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline Code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Unordered Lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

    // Line breaks to paragraphs
    html = html.split('\n\n').map(para => {
        if (para.startsWith('<h') || para.startsWith('<div') || para.startsWith('<ul') || para.startsWith('<blockquote')) {
            return para;
        }
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

function attachCodeCopyListeners() {
    document.querySelectorAll(".btn-copy-code").forEach(btn => {
        btn.addEventListener("click", () => {
            const rawCode = decodeURIComponent(btn.getAttribute("data-code"));
            navigator.clipboard.writeText(rawCode).then(() => {
                showToast("코드가 클립보드에 복사되었습니다!", "success");
            });
        });
    });
}

function copyOutputText() {
    if (!appState.lastResponseText) {
        showToast("복사할 생성 결과가 없습니다.", "info");
        return;
    }
    navigator.clipboard.writeText(appState.lastResponseText).then(() => {
        showToast("마크다운 결과 텍스트가 복사되었습니다.", "success");
    });
}

function toggleRawOutput() {
    const content = document.getElementById("output-content");
    const raw = document.getElementById("output-raw");

    if (content.style.display === "none") {
        content.style.display = "block";
        raw.style.display = "none";
    } else {
        content.style.display = "none";
        raw.style.display = "block";
    }
}

/**
 * 8. Hidden API Exporter & Payload Generator
 */
let currentPayloadTab = "curl";

function updatePayloadModalDisplay() {
    const display = document.getElementById("payload-display");
    const model = appState.model;
    const promptText = document.getElementById("user-prompt-input").value.trim() || "사용자 질문 내용";

    const payloadObj = {
        system_instruction: {
            parts: [{ text: appState.systemInstruction }]
        },
        contents: [
            {
                parts: [{ text: promptText }]
            }
        ],
        generationConfig: {
            temperature: appState.temperature,
            topP: 0.95
        }
    };

    if (currentPayloadTab === "curl") {
        display.textContent = `curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$GEMINI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payloadObj, null, 2)}'`;
    } else if (currentPayloadTab === "json") {
        display.textContent = JSON.stringify(payloadObj, null, 2);
    } else if (currentPayloadTab === "fetch") {
        display.textContent = `const apiKey = process.env.GEMINI_API_KEY;
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=" + apiKey, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${JSON.stringify(payloadObj, null, 2)})
});
const data = await response.json();
console.log(data.candidates[0].content.parts[0].text);`;
    }
}

function switchPayloadTab(tabName, targetBtn) {
    currentPayloadTab = tabName;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    targetBtn.classList.add("active");
    updatePayloadModalDisplay();
}

function copyPayloadContent() {
    const display = document.getElementById("payload-display");
    navigator.clipboard.writeText(display.textContent).then(() => {
        showToast("숨김 API 페이로드가 복사되었습니다!", "success");
    });
}

/**
 * 9. Toast Notification System
 */
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";

    let icon = "fa-solid fa-circle-info";
    let color = "var(--primary)";

    if (type === "success") {
        icon = "fa-solid fa-circle-check";
        color = "var(--success)";
    } else if (type === "error") {
        icon = "fa-solid fa-circle-exclamation";
        color = "var(--danger)";
    }

    toast.style.borderLeftColor = color;
    toast.innerHTML = `<i class="${icon}" style="color:${color}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
