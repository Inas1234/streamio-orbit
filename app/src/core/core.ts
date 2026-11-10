import { Bridge } from './bridge';
import type { CoreEvent, ModelName } from './types';

export type Action = { action: string; args?: unknown };

type StateListener = (models: ModelName[]) => void;
type EventListener = (event: string, args: any) => void;

const stateListeners = new Set<StateListener>();
const eventListeners = new Set<EventListener>();
const libraryStoredListeners = new Set<() => void>();

// The engine only reaches the page for these three things. Storage writes pass through here
// so the app can notice when the saved library changes (My List reads it directly).
const isLibraryKey = (key: string) => key === 'library' || key === 'library_recent';
const scope = {
    get location() {
        return window.location;
    },
    localStorage: {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => {
            localStorage.setItem(key, value);
            if (isLibraryKey(key)) libraryStoredListeners.forEach((l) => l());
        },
        removeItem: (key: string) => {
            localStorage.removeItem(key);
            if (isLibraryKey(key)) libraryStoredListeners.forEach((l) => l());
        },
    },
    onCoreEvent: (event: CoreEvent) => (window as any).onCoreEvent(event),
};

const worker = new Worker(new URL('./core.worker.ts', import.meta.url), { type: 'module' });
const bridge = new Bridge(scope, worker);

(window as any).onCoreEvent = (event: CoreEvent) => {
    if (event.name === 'NewState') {
        stateListeners.forEach((l) => l(event.args));
    } else if (event.name === 'CoreEvent') {
        const { event: name, args } = event.args;
        eventListeners.forEach((l) => l(name, args));
    }
};

let ready: Promise<void> | null = null;

export const core = {
    init(appVersion: string, shellVersion: string | null) {
        ready ??= bridge.call<void>(['init'], [{ appVersion, shellVersion }]);
        return ready;
    },
    getState<T>(model: ModelName): Promise<T> {
        return bridge.call<T>(['getState'], [model]);
    },
    dispatch(action: Action, model?: ModelName) {
        return bridge.call<void>(['dispatch'], [action, model, location.hash]);
    },
    encodeStream(stream: unknown): Promise<string> {
        return bridge.call<string>(['encodeStream'], [stream]);
    },
    decodeStream<T>(encoded: string): Promise<T | null> {
        return bridge.call<T | null>(['decodeStream'], [encoded]);
    },
    onState(listener: StateListener) {
        stateListeners.add(listener);
        return () => void stateListeners.delete(listener);
    },
    onEvent(listener: EventListener) {
        eventListeners.add(listener);
        return () => void eventListeners.delete(listener);
    },
    /** Fires after the engine saves the library to storage. */
    onLibraryStored(listener: () => void) {
        libraryStoredListeners.add(listener);
        return () => void libraryStoredListeners.delete(listener);
    },
};

if (import.meta.env.DEV) (window as any).__core = core;

export const ctxAction =(action: string, args?: unknown): Action => ({
    action: 'Ctx',
    args: args === undefined ? { action } : { action, args },
});
