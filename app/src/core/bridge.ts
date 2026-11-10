// Small RPC layer over postMessage, wire-compatible with @stremio/stremio-core-web's bridge.
// Unlike the upstream version, pending calls live in one Map, so a reply costs O(1)
// instead of waking every outstanding listener.

type Endpoint = {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

type Request = { id: string; path: string[]; args: unknown[] };
type Response = { id: string; result: { data: unknown } | { error: unknown } };

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export class Bridge {
    private pending = new Map<string, { resolve: (v: any) => void; reject: (e: unknown) => void }>();

    constructor(private scope: any, private endpoint: Endpoint) {
        endpoint.addEventListener('message', (event) => {
            const { request, response } = (event.data ?? {}) as { request?: Request; response?: Response };
            if (response) this.onResponse(response);
            else if (request) void this.onRequest(request);
        });
    }

    call<T = unknown>(path: string[], args: unknown[]): Promise<T> {
        const id = nextId();
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.endpoint.postMessage({ request: { id, path, args } });
        });
    }

    private onResponse({ id, result }: Response) {
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        if ('error' in result) entry.reject(result.error);
        else entry.resolve(result.data);
    }

    private async onRequest({ id, path, args }: Request) {
        try {
            const value = path.reduce((obj, key) => obj?.[key], this.scope);
            const thisArg = path.slice(0, -1).reduce((obj, key) => obj?.[key], this.scope);
            const data = typeof value === 'function' ? await value.apply(thisArg, args) : await value;
            this.endpoint.postMessage({ response: { id, result: { data } } });
        } catch (error) {
            this.endpoint.postMessage({ response: { id, result: { error } } });
        }
    }
}
