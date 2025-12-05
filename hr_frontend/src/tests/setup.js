import "@testing-library/jest-dom";
import axios from "axios";

// JSDOM NEEDS A REAL ORIGIN FOR RELATIVE URLS
globalThis.location = new URL("http://localhost:5000/");

// Force axios to absolute URL
axios.defaults.baseURL = "http://localhost:5000/api";

// scrollTo mock
window.scrollTo = vi.fn();

// Silence console noise
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
