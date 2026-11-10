import { useEffect, useRef, useState } from 'react';
import { core, type Action } from './core';
import type { ModelName } from './types';

type Options = {
    /** Dispatched whenever its JSON changes. */
    load?: Action | null;
    /** Send Unload when the component unmounts. Leave off for models worth keeping warm (board). */
    unloadOnExit?: boolean;
};

/**
 * Subscribes to a core model. State fetches are coalesced: however many
 * NewState events arrive while a fetch is in flight, at most one more fetch runs
 * after it, and React only sees the newest state.
 */
export function useModel<T>(model: ModelName, { load, unloadOnExit }: Options = {}): T | null {
    const [state, setState] = useState<T | null>(null);
    const loadKey = load ? JSON.stringify(load) : null;
    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        if (loadRef.current) void core.dispatch(loadRef.current, model);
    }, [loadKey, model]);

    useEffect(() => {
        let alive = true;
        let inFlight = false;
        let dirty = false;

        const fetchState = async () => {
            if (inFlight) {
                dirty = true;
                return;
            }
            inFlight = true;
            let latest: T;
            do {
                dirty = false;
                latest = await core.getState<T>(model);
            } while (dirty && alive);
            inFlight = false;
            if (alive) setState(latest);
        };

        const off = core.onState((models) => {
            if (models.includes(model)) void fetchState();
        });
        void fetchState();

        return () => {
            alive = false;
            off();
        };
    }, [model]);

    useEffect(() => {
        if (!unloadOnExit) return;
        return () => void core.dispatch({ action: 'Unload' }, model);
    }, [model, unloadOnExit]);

    return state;
}
