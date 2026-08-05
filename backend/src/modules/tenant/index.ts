// tenant module — public exports (PRD §4.3 white-label: branding + custom
// domain; PRD §7.4 firm storage settings)
//
// Only the routers (for mounting) are exported — no other module needs
// to compose with this one's services/repositories/controllers. Mirrors
// `modules/notifications/index.ts`.

export { default as brandingRoutes } from './routes/branding.routes';
export { default as domainRoutes } from './routes/domain.routes';
export { default as publicBrandingRoutes } from './routes/public-branding.routes';
export { default as storageSettingsRoutes } from './routes/storage-settings.routes';
