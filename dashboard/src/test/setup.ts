import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lacks ResizeObserver, which cmdk (command palette) depends on.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom doesn't implement scrollIntoView, which cmdk calls on the active item.
Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};

// Auto-cleanup the rendered DOM between tests (not registered automatically
// because Vitest globals are disabled).
afterEach(() => {
  cleanup();
});
