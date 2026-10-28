/**
 * Vitest & Test Runner Compatibility Adapter
 * Seamlessly provides describe, it, expect, beforeEach, vi
 * using native Node.js test runner and strict assertions,
 * fully compatible with Vitest CLI.
 */

import { describe as nodeDescribe, it as nodeIt, beforeEach as nodeBeforeEach } from 'node:test';
import assert from 'node:assert/strict';

export const describe = nodeDescribe;
export const it = nodeIt;
export const beforeEach = nodeBeforeEach;

export function expect<T = any>(actual: T) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined);
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(expected: number) {
      assert.strictEqual((actual as any).length, expected);
    },
    toBeGreaterThan(expected: number) {
      assert.ok((actual as any) > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok((actual as any) >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected: number) {
      assert.ok((actual as any) < expected, `Expected ${actual} < ${expected}`);
    },
    toContain(expected: any) {
      if (typeof actual === 'string') {
        assert.ok(actual.includes(expected), `Expected "${actual}" to contain "${expected}"`);
      } else if (Array.isArray(actual)) {
        assert.ok(actual.includes(expected), `Expected array to contain ${JSON.stringify(expected)}`);
      } else {
        throw new Error(`toContain not supported on ${typeof actual}`);
      }
    },
    toBeCloseTo(expected: number, precision: number = 2) {
      const diff = Math.abs((actual as any) - expected);
      const tolerance = Math.pow(10, -precision) / 2;
      assert.ok(
        diff <= tolerance,
        `Expected ${actual} to be close to ${expected} (diff: ${diff}, tolerance: ${tolerance})`
      );
    },
    toThrow(expectedMessage?: string | RegExp) {
      let threw = false;
      let actualError: any;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (err) {
        threw = true;
        actualError = err;
      }
      assert.ok(threw, 'Expected function to throw');
      if (expectedMessage) {
        const msg = String(actualError?.message || actualError);
        if (typeof expectedMessage === 'string') {
          assert.ok(
            msg.includes(expectedMessage),
            `Expected error message "${msg}" to include "${expectedMessage}"`
          );
        } else {
          assert.ok(expectedMessage.test(msg), `Expected error message "${msg}" to match ${expectedMessage}`);
        }
      }
    },
    not: {
      toThrow() {
        let threw = false;
        let actualError: any;
        try {
          if (typeof actual === 'function') {
            actual();
          }
        } catch (err) {
          threw = true;
          actualError = err;
        }
        assert.ok(!threw, `Expected function not to throw, but threw: ${actualError?.message}`);
      },
      toBe(expected: any) {
        assert.notStrictEqual(actual, expected);
      },
    },
  };
}

export const vi = {
  fn: (impl?: (...args: any[]) => any) => {
    const fn = (...args: any[]) => {
      (fn as any).mock.calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    (fn as any).mock = { calls: [] };
    return fn;
  },
};
