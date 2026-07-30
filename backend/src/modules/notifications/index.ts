// notifications module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting) and DTO types. `NotificationRepository`, `NotificationController`,
// `NotificationMapper`, and `NotificationService` are deliberately NOT
// exported — no other module needs to compose with this one. Mirrors
// `modules/contacts/index.ts`.

export { default as notificationRoutes } from './routes/notification.routes';
export type { NotificationResponseDto } from './dto/notification.res.dto';
export type { ListNotificationsQueryDto } from './dto/notification.req.dto';
