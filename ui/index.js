
const go = new Go();

// Helper to get query param value
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Helper to decode base64 safely
function decodeBase64(b64) {
    try {
        // decodeURIComponent handles URL-safe base64
        return atob(decodeURIComponent(b64.replace(/\s/g, "")));
    } catch {
        return "";
    }
}

async function initWasm() {
    const resp = await fetch("main.wasm");
    const bytes = await resp.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, go.importObject);
    go.run(result.instance);
    setupEditor();
}

function setupEditor() {
    const input = document.getElementById("sloInput");
    const output = document.getElementById("sloOutput");
    const copyBtn = document.getElementById("copyBtn");
    const shareBtn = document.getElementById("shareBtn");
    const clearBtn = document.getElementById("clearBtn");

    // If ?slo-spec-b64=... is present, decode and set textarea
    const b64Yaml = getQueryParam("slo-spec-b64");
    if (b64Yaml) {
        const decodedYaml = decodeBase64(b64Yaml);
        if (decodedYaml) {
            input.value = decodedYaml;
        }
    }

    // Helper to encode YAML to base64 (URL safe)
    function encodeBase64(str) {
        // btoa only works with latin1, so encodeURIComponent first
        return encodeURIComponent(btoa(str));
    }

    // Update URL with base64 YAML
    function updateUrlWithYaml(yaml) {
        const base64Yaml = encodeBase64(yaml);
        const url = `${window.location.pathname}?slo-spec-b64=${base64Yaml}`;
        window.history.replaceState(null, '', url);
        return window.location.origin + url;
    }

    let debounceTimer;
    const debounceDelay = 500;

    async function render() {
        try {
            const yaml = input.value.trim();
            if (!yaml) {
                output.textContent = "";
                output.className = "";
                return;
            }

            // Generate SLO from raw YAML (Calls Sloth WASM).
            const raw = generateSLOFromRaw(yaml);

            // Try to parse JSON; fallback to raw string
            let textToShow = "";
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object" && "resultRendered" in parsed) {
                    textToShow = String(parsed.resultRendered ?? "");
                } else {
                    textToShow = raw;
                }
            } catch {
                textToShow = raw;
            }

            // Detect error message pattern
            if (textToShow.trim().toLowerCase().startsWith("error: ")) {
                output.className = "error";
            } else {
                output.className = "";
            }

            output.textContent = textToShow || "";
        } catch (err) {
            output.className = "error";
            output.textContent = String(err && err.message ? err.message : err);
        }
    }

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            render();
            // Update URL on every change
            const yaml = input.value.trim();
            if (yaml) {
                updateUrlWithYaml(yaml);
            } else {
                // Remove param if empty
                window.history.replaceState(null, '', window.location.pathname);
            }
        }, debounceDelay);
    });

    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(output.textContent);
            alert("Copied to clipboard!");
        } catch {
            alert("Copy failed");
        }
    });

    // Share button: copy shareable URL to clipboard
    shareBtn.addEventListener("click", async () => {
        const yaml = input.value.trim();
        if (!yaml) {
            alert("Editor is empty. Please write your SLO spec first.");
            return;
        }
        const shareUrl = updateUrlWithYaml(yaml);
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert("Shareable URL copied to clipboard!");
        } catch {
            alert("Failed to copy URL");
        }
    });

    clearBtn.addEventListener("click", () => {
        input.value = "";
        output.textContent = "";
        output.className = "";
    });

    // If we loaded YAML from URL, render immediately
    if (input.value) {
        setTimeout(render, 0);
    }
}

initWasm();