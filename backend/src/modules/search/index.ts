// search module — public exports
//
// Only the router is exported (for mounting) — mirrors `modules/reports/index.ts`.
// `SearchService`/`SearchController`/`SearchMapper` are internal implementation
// details; no other module composes with Search directly.

export { default as searchRoutes } from './routes/search.routes';
