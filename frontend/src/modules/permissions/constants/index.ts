// permissions-scoped constants (enums, option lists, default values).
// The canonical resource/action registry already lives in config/permissions.config.ts (used by
// usePermission/<Can>) - re-exported here so permissions-admin UI has one place to import from
// without reaching into config/ directly.

export { PERMISSION_ACTIONS, PERMISSION_RESOURCES, PERMISSIONS } from '@/config/permissions.config'
