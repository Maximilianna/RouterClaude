/// Base URL for the RouterClaude backend API.
/// Override via VITE_API_BASE environment variable (e.g. .env file).
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8900";
