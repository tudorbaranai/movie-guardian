import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Remove whatever the previous test rendered, so every test starts clean.
afterEach(() => {
  cleanup();
});
