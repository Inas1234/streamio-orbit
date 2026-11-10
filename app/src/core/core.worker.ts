/// <reference lib="webworker" />
// Runs Stremio's core (Rust compiled to WebAssembly) off the main thread,
// so catalog parsing and library sync never block scrolling or animations.
import { Bridge } from './bridge';
import { pruneAddonCache, withAddonCache } from './addonCache';
import wasmUrl from '@stremio/stremio-core-web/stremio_core_web_bg.wasm?url';

declare const self: DedicatedWorkerGlobalScope & Record<string, any>;

// The engine calls the worker's global fetch; route addon requests through the cache.
self.fetch = withAddonCache(self.fetch.bind(self));
void pruneAddonCache();

const bridge = new Bridge(self, self);

self.init = async ({ appVersion, shellVersion }: { appVersion: string; shellVersion: string | null }) => {
    // The wasm glue reads these globals.
    self.document = { baseURI: self.location.href };
    self.app_version = appVersion;
    self.shell_version = shellVersion;
    self.get_location_hash = () => bridge.call(['location', 'hash'], []);
    self.local_storage_get_item = (key: string) => bridge.call(['localStorage', 'getItem'], [key]);
    self.local_storage_set_item = (key: string, value: string) => bridge.call(['localStorage', 'setItem'], [key, value]);
    self.local_storage_remove_item = (key: string) => bridge.call(['localStorage', 'removeItem'], [key]);

    // CommonJS module with __esModule: named exports sit on the namespace, the wasm loader is `default`.
    const ns: any = await import('@stremio/stremio-core-web/stremio_core_web.js');
    const mod = typeof ns.get_state === 'function' ? ns : ns.default;
    const initApi = typeof ns.default === 'function' ? ns.default : mod.default;

    self.getState = mod.get_state;
    self.dispatch = mod.dispatch;
    self.analytics = mod.analytics;
    self.decodeStream = mod.decode_stream;
    self.encodeStream = mod.encode_stream;

    await initApi({ module_or_path: wasmUrl });
    await mod.initialize_runtime((event: unknown) => bridge.call(['onCoreEvent'], [event]));
};
