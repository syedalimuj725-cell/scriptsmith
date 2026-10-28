import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Strict Content Security Policy for the published build. The app loads only
// its own files: no third-party scripts, no network calls, no forms, no frames.
// (Added only at build time, because the dev server needs inline scripts.)
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React inline styles + the small <style> block
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function securityHeaders() {
  return {
    name: "security-meta-tags",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />` +
          `\n    <meta name="referrer" content="no-referrer" />`
      );
    },
  };
}

// Relative base so the build works on GitHub Pages under /scriptsmith/
export default defineConfig({
  plugins: [react(), securityHeaders()],
  base: "./",
});
