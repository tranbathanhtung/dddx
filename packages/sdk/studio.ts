// Main studio bundle — lazy-loaded by the loader entry (index.ts).
// Importing `./src/host` transitively imports `./src/styles.css`, whose
// build-time plugin assigns the Tailwind CSS string to `window.dddx.styles`.
export { mountStudio } from "./src/host";
