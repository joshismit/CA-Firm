// notifications module — public exports
//
// The router (for mounting) and DTO types, plus `NotificationDispatchService`
// (PRD §11 delivery engine) for other modules to compose with once they wire
// in real triggers — the same "explicit public surface" precedent as
// `modules/audit`'s `AuditLogRecorder`. `NotificationRepository`,
// `NotificationController`, `NotificationMapper`, and the read-only
// `NotificationService` remain deliberately NOT exported — no other module
// needs to compose with those. Mirrors `modules/contacts/index.ts`.

export { default as notificationRoutes } from './routes/notification.routes';
export { default as notificationTemplateRoutes } from './routes/notification-template.routes';
export { default as notificationPreferenceRoutes } from './routes/notification-preference.routes';
export { default as notificationProviderRoutes } from './routes/notification-provider.routes';
export type { NotificationResponseDto } from './dto/notification.res.dto';
export type { ListNotificationsQueryDto } from './dto/notification.req.dto';
export { NotificationDispatchService } from './service/notification-dispatch.service';
export type { SendNotificationInput } from './service/notification-dispatch.service';
export { NotificationTemplateRenderer } from './service/notification-template-renderer';
export { NotificationDashboardReader } from './service/notification-dashboard.reader';
export type { NotificationDashboardWidgets } from './service/notification-dashboard.reader';
