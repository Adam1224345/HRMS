// src/setup.jsx - Global Vitest Setup: Fixes useNavigate, i18n, console noise, and more

import "@testing-library/jest-dom";
import axios from "axios";
import { vi } from "vitest";

// 1. JSDOM needs a real origin for relative URLs
globalThis.location = new URL("http://localhost:5000/");

// 2. Force axios to absolute URL in tests
axios.defaults.baseURL = "http://localhost:5000/api";

// 3. Mock scrollTo (prevents "scrollTo is not a function" errors)
window.scrollTo = vi.fn();

// 4. Silence console noise in tests (optional but recommended)
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

// 5. Mock react-i18next (prevents "currentLang.startsWith is not a function" error)
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key, // Return key as translation for simplicity
    i18n: {
      language: "en", // Default to English
      changeLanguage: vi.fn(),
    },
  }),
}));
