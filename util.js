export function initEmscriptenModule(
    moduleFactory,
    wasmUrl,
) {
    return new Promise((resolve) => {
        const module = moduleFactory({
            // Just to be safe, don't automatically invoke any wasm functions
            noInitialRun: true,
            locateFile(url) {
                // Redirect the request for the wasm binary to whatever webpack gave us.
                if (url.endsWith('.wasm')) return wasmUrl;
                return url;
            },
            onRuntimeInitialized() {
                // An Emscripten is a then-able that resolves with itself, causing an infite loop when you
                // wrap it in a real promise. Delete the `then` prop solves this for now.
                // https://github.com/kripken/emscripten/issues/5820
                delete (module).then;
                resolve(module);
            },
        });
    });
}


export function clamp(x, opts) {
    return Math.min(Math.max(x, opts.min || Number.MIN_VALUE), opts.max || Number.MAX_VALUE);
}
