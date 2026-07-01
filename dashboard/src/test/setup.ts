import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Auto-cleanup the rendered DOM between tests (not registered automatically
// because Vitest globals are disabled).
afterEach(() => {
  cleanup();
});
