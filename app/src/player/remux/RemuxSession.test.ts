import { describe, expect, it } from 'vitest';
import { needsRestart } from './RemuxSession';
import { retryDelay } from './remux';

const ranges = (...r: Array<[number, number]>) => r;

describe('needsRestart', () => {
    it('no restart when the time is already loaded', () => {
        expect(needsRestart(30, ranges([0, 60]), 0, 60)).toBe(false);
    });

    it('waits when the time is just ahead of where reading has got', () => {
        expect(needsRestart(63, ranges([0, 60]), 0, 60)).toBe(false);
    });

    it('restarts when seeking back into data that was already dropped', () => {
        // Read from 0 up to 1260 s, but everything before 1170 s was dropped from memory.
        expect(needsRestart(300, ranges([1170, 1260]), 0, 1260)).toBe(true);
    });

    it('restarts when seeking far ahead of the read', () => {
        expect(needsRestart(600, ranges([0, 60]), 0, 60)).toBe(true);
    });

    it('restarts when seeking before where the current read started', () => {
        expect(needsRestart(10, ranges([200, 260]), 200, 260)).toBe(true);
    });
});

describe('retryDelay', () => {
    it('retries a few times with growing waits, whatever the error', () => {
        expect(retryDelay(1)).toBe(1);
        expect(retryDelay(2)).toBe(2);
        expect(retryDelay(4)).toBe(8);
        expect(retryDelay(6)).toBe(8);
        expect(retryDelay(7)).toBeNull();
    });
});
