# sloth-slo-live-editor

Try it live: https://slok.github.io/sloth-slo-live-editor/

This project brings [Sloth] SLO generator directly to your browser using WASM.
It uses the new [Sloth] Go library as a frontend dependency to render Prometheus rules for your SLOs, no CLI, no backend, just your browser.

It’s a small, fun proof of concept (PoC) that also happens to be quite handy: it lets you experiment with Sloth and instantly see what rules it would generate, without installing or running anything locally.

## How it works

The magic happens in just two files:

* main.go : Exposes the `generateSLOFromRaw` function to JavaScript using the Go WASM runtime.
* ui/index.html: Loads the compiled WASM binary and provides a simple UI to interact with it.

When you open the page, the Go code runs inside your browser, calling the Sloth library directly to generate SLO Prometheus rules on the fly.

## Notes

This is a proof of concept, but it shows how Sloth can be reused beyond traditional CLI tools. It’s also a nice example of using Go + WASM to embed backend logic in the browser.

[sloth]: https://sloth.dev