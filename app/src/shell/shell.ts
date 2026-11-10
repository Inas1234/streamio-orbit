// Talks to the desktop app (stremio-community-v5 / stremio-shell-ng) over WebView2 messaging.
// In a normal browser `active` is false and every call is a no-op.
import EventEmitter from 'eventemitter3';

type WebView = {
    postMessage(message: string): void;
    addEventListener(type: 'message', listener: (event: { data: string }) => void): void;
};

const ipc: WebView | undefined = (globalThis as any).chrome?.webview;
const legacy = (globalThis as any).qt?.webChannelTransport;
if (legacy) legacy.onmessage = () => {};
// stremio-community-v5 calls this on load (its own web build defines it). If it's missing,
// the shell treats the page as broken and keeps reloading it. Our transport needs no setup.
(globalThis as any).initShellComm ??= () => {};

const SIGNAL = 1;
const INIT = 3;
const INVOKE = 6;

const events = new EventEmitter();
let nextId = 1;
let properties: Record<string, unknown> = {};
let resolveReady: () => void = () => {};
const ready = new Promise<void>((r) => (resolveReady = r));

if (ipc) {
    ipc.addEventListener('message', (message) => {
        try {
            const event = JSON.parse(message.data);
            // stremio-shell-ng tags the handshake reply with type 3; stremio-community-v5 sends it
            // without a type, so also recognize it by its shape.
            if (event.type === INIT || (event.type === undefined && event.data?.transport)) {
                const list: unknown[] = event.data?.transport?.properties ?? [];
                properties = Object.fromEntries(
                    list
                        .filter((p): p is unknown[] => Array.isArray(p) && p.length >= 4 && !!p[1])
                        .map((p) => [p[1] as string, p[3]]),
                );
                resolveReady();
            } else if (event.type === SIGNAL) {
                const [name, arg] = event.args ?? [];
                events.emit(name, arg);
            }
        } catch (e) {
            console.error('shell: bad message', e);
        }
    });
    ipc.postMessage(JSON.stringify({ id: 0, type: INIT }));
} else {
    resolveReady();
}

export const shell = {
    active: !!ipc,
    ready,
    get version(): string | null {
        return (properties.shellVersion as string) ?? null;
    },
    get streamingServerUrl(): string | null {
        return (properties.streamingServerUrl as string) || null;
    },
    send(method: string, ...args: unknown[]) {
        // object/method are required by stremio-community-v5 and harmless for stremio-shell-ng.
        ipc?.postMessage(JSON.stringify({ id: nextId++, type: INVOKE, object: 'transport', method: 'onEvent', args: [method, ...args] }));
    },
    on(name: string, listener: (arg: any) => void) {
        events.on(name, listener);
    },
    off(name: string, listener: (arg: any) => void) {
        events.off(name, listener);
    },
    openExternal(url: string) {
        if (ipc) this.send('open-external', url);
        else window.open(url, '_blank', 'noopener');
    },
};
