
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

 // Helper to encode YAML to base64 (URL safe)
function encodeBase64(str) {
    // btoa only works with latin1, so encodeURIComponent first
    return encodeURIComponent(btoa(str));
}

// Update URL with base64 YAML
function updateUrlWithYaml(yaml, sloPlugin) {
    let url = window.location.origin + window.location.pathname;
    if (yaml) {
        const base64Yaml = encodeBase64(yaml);
        url += `?slo-spec-b64=${base64Yaml}`;
    }
    
    if (sloPlugin) {
        const base64Plugin = encodeBase64(sloPlugin);
        url += `&slo-plugin-b64=${base64Plugin}`;
    }
    
    window.history.replaceState(null, '', url);
    
    return url;
}

function setupEditor() {
    const input = document.getElementById("sloInput");
    const pluginInput = document.getElementById("sloPluginInput");
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

    const b64Plugin = getQueryParam("slo-plugin-b64");
    if (b64Plugin && pluginInput) {
        const decodedPlugin = decodeBase64(b64Plugin);
        if (decodedPlugin) {
            pluginInput.value = decodedPlugin;
        }
    }

   
    let debounceTimer;
    const debounceDelay = 500;

    async function render() {
        try {
            const yaml = input.value.trim();
            const pluginCode = pluginInput ? pluginInput.value.trim() : "";
            if (!yaml) {
                output.value = "";
                output.className = "";
                output.setAttribute("aria-invalid", "false");
                return;
            }

            // Generate SLO from raw YAML and plugin code (Calls Sloth WASM).
            const raw = generateSLOFromRaw(yaml, pluginCode);

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
                output.setAttribute("aria-invalid", "true");
            } else {
                output.className = "";
                output.setAttribute("aria-invalid", "false");
            }

            output.value = textToShow || "";
        } catch (err) {
            output.className = "error";
            output.value = String(err && err.message ? err.message : err);
            output.setAttribute("aria-invalid", "true");
        }
    }

    function debouncedRenderAndUrl() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            render();
            // Update URL on every change (only for SLO YAML)
            const yaml = input.value.trim();
            const sloPlugin = pluginInput.value.trim();
            updateUrlWithYaml(yaml, sloPlugin);
        }, debounceDelay);
    }

    input.addEventListener("input", debouncedRenderAndUrl);
    pluginInput.addEventListener("input", debouncedRenderAndUrl);
    

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
        const sloPlugin = pluginInput.value.trim();
        const shareUrl = updateUrlWithYaml(yaml, sloPlugin);
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert("Shareable URL copied to clipboard!");
        } catch {
            alert("Failed to copy URL");
        }
    });

    clearBtn.addEventListener("click", () => {
        input.value = "";
        output.value = "";
        pluginInput.value = "";
        output.className = "";
        output.setAttribute("aria-invalid", "false");
    });

    // If we loaded YAML from URL, render immediately
    if (input.value) {
        render();
    }
}

initWasm();