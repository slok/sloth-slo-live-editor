
const go = new Go();

const urlParamSLOSpec = "slo-spec";
const urlParamSLOPlugin = "slo-plugin";

// Helper to get query param value
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function decodeURLData(encodedData) {
    return LZString.decompressFromEncodedURIComponent(encodedData);
}

function encodeURLData(decodedData) {
    return LZString.compressToEncodedURIComponent(decodedData);
}


async function initWasm() {
    const resp = await fetch("main.wasm");
    const bytes = await resp.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, go.importObject);
    go.run(result.instance);
    setupEditor();
}



// Update URL with base64 YAML
function updateUrlWithYaml(yaml, sloPlugin) {
    let url = window.location.origin + window.location.pathname;
    if (yaml) {
        const base64Yaml = encodeURLData(yaml);
        url += `?${urlParamSLOSpec}=${base64Yaml}`;
    }
    
    if (sloPlugin) {
        const base64Plugin = encodeURLData(sloPlugin);
        url += `&${urlParamSLOPlugin}=${base64Plugin}`;
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

    const b64Yaml = getQueryParam(urlParamSLOSpec);
    if (b64Yaml) {
        const decodedYaml = decodeURLData(b64Yaml);
        if (decodedYaml) {
            input.value = decodedYaml;
        }
    }

    const b64Plugin = getQueryParam(urlParamSLOPlugin);
    if (b64Plugin && pluginInput) {
        const decodedPlugin = decodeURLData(b64Plugin);
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