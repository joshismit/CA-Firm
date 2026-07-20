-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "ltree";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "session_device_type" AS ENUM ('WEB', 'MOBILE_IOS', 'MOBILE_ANDROID', 'DESKTOP', 'API_KEY');

-- CreateEnum
CREATE TYPE "session_revoke_reason" AS ENUM ('LOGOUT', 'PASSWORD_CHANGE', 'ADMIN_REVOKE', 'MFA_DISABLED', 'SESSION_EXPIRED', 'SUSPICIOUS_ACTIVITY', 'DEVICE_REMOVED');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'TWO_FACTOR', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "refresh_token_revoke_reason" AS ENUM ('LOGOUT', 'FAMILY_COMPROMISED', 'PASSWORD_CHANGE', 'SESSION_REVOKED', 'ADMIN_REVOKE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'SHARE', 'APPROVE', 'ASSIGN', 'MANAGE');

-- CreateEnum
CREATE TYPE "login_event_type" AS ENUM ('LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'TOKEN_REFRESH', 'PASSWORD_RESET', 'MFA_SUCCESS', 'MFA_FAILED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED');

-- CreateEnum
CREATE TYPE "login_event_status" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "role_type" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "otp_type" AS ENUM ('TOTP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "resource_access_level" AS ENUM ('NONE', 'READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "domain_ssl_status" AS ENUM ('PENDING', 'PROVISIONED', 'FAILED', 'EXPIRING');

-- CreateEnum
CREATE TYPE "business_status" AS ENUM ('ACTIVE', 'INACTIVE', 'DORMANT', 'STRUCK_OFF', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('REGISTERED', 'CORPORATE', 'BRANCH', 'FACTORY', 'RESIDENTIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "contact_role_type" AS ENUM ('OWNER', 'DIRECTOR', 'PARTNER', 'AUTHORIZED_SIGNATORY', 'ACCOUNTANT', 'AUDITOR', 'EMPLOYEE', 'CLIENT_REPRESENTATIVE', 'EMERGENCY_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "client_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'FORMER');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'SYSTEM_LOG');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'IN',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "default_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "tenant_status" NOT NULL DEFAULT 'TRIAL',
    "subscription_status" "subscription_status" NOT NULL DEFAULT 'TRIAL',
    "subscription_expires_at" TIMESTAMPTZ,
    "plan_code" VARCHAR(50),
    "max_users" INTEGER,
    "max_clients" INTEGER,
    "max_storage_gb" INTEGER,
    "max_documents" INTEGER,
    "onboarding_completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    "date_format" VARCHAR(30) NOT NULL DEFAULT 'DD/MM/YYYY',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 4,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "max_login_attempts" INTEGER NOT NULL DEFAULT 5,
    "session_timeout_mins" INTEGER NOT NULL DEFAULT 480,
    "require_mfa" BOOLEAN NOT NULL DEFAULT false,
    "password_min_length" INTEGER NOT NULL DEFAULT 8,
    "password_require_upper" BOOLEAN NOT NULL DEFAULT true,
    "password_require_number" BOOLEAN NOT NULL DEFAULT true,
    "password_require_symbol" BOOLEAN NOT NULL DEFAULT false,
    "password_expiry_days" INTEGER,
    "allow_client_portal" BOOLEAN NOT NULL DEFAULT false,
    "watermark_documents" BOOLEAN NOT NULL DEFAULT false,
    "enable_webhooks" BOOLEAN NOT NULL DEFAULT false,
    "enable_api_access" BOOLEAN NOT NULL DEFAULT false,
    "enable_ocr" BOOLEAN NOT NULL DEFAULT false,
    "default_notification_email" VARCHAR(255),
    "extra_settings" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_branding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "firm_name" VARCHAR(255),
    "logo_storage_key" VARCHAR(500),
    "logo_dark_storage_key" VARCHAR(500),
    "favicon_storage_key" VARCHAR(500),
    "login_bg_storage_key" VARCHAR(500),
    "primary_color" CHAR(7) DEFAULT '#1a73e8',
    "secondary_color" CHAR(7),
    "accent_color" CHAR(7),
    "background_color" CHAR(7),
    "email_header_color" CHAR(7),
    "font_family" VARCHAR(100) DEFAULT 'Inter',
    "custom_css" TEXT,
    "email_footer_text" TEXT,
    "footer_text" VARCHAR(500),
    "support_email" VARCHAR(255),
    "support_phone" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" VARCHAR(253) NOT NULL,
    "subdomain" VARCHAR(100),
    "verification_token" VARCHAR(255) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "ssl_status" "domain_ssl_status" NOT NULL DEFAULT 'PENDING',
    "ssl_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "avatar_storage_key" VARCHAR(500),
    "job_title" VARCHAR(100),
    "bio" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "phone_verified_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "device_type" "session_device_type" NOT NULL DEFAULT 'WEB',
    "device_name" VARCHAR(255),
    "device_fingerprint" VARCHAR(255),
    "browser" VARCHAR(100),
    "os" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "location_city" VARCHAR(100),
    "location_country" CHAR(2),
    "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" "session_revoke_reason",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ,
    "rotated_to_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" "refresh_token_revoke_reason",
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "email" VARCHAR(255),
    "purpose" "otp_purpose" NOT NULL,
    "type" "otp_type" NOT NULL DEFAULT 'EMAIL',
    "code_hash" VARCHAR(255) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "totp_secret_encrypted" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_verified_at" TIMESTAMPTZ,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sms_phone" VARCHAR(30),
    "backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "backup_codes_generated_at" TIMESTAMPTZ,
    "backup_codes_used_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "last_method" VARCHAR(20),
    "encryption_key_version" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mfa_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "invited_by_id" UUID NOT NULL,
    "role_ids" TEXT[],
    "token_hash" VARCHAR(64) NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "accepted_by_id" UUID,
    "message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "event_type" "login_event_type" NOT NULL,
    "status" "login_event_status" NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "country" CHAR(2),
    "city" VARCHAR(100),
    "session_id" UUID,
    "failure_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "group_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(100) NOT NULL,
    "action" "permission_action" NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" CHAR(7),
    "type" "role_type" NOT NULL DEFAULT 'CUSTOM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_access_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID NOT NULL,
    "access_level" "resource_access_level" NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "resource_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "status" "business_status" NOT NULL DEFAULT 'ACTIVE',
    "pan" VARCHAR(10),
    "gstin" VARCHAR(15),
    "cin" VARCHAR(21),
    "incorporation_date" DATE,
    "financial_year_start" INTEGER NOT NULL DEFAULT 4,
    "industry" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "deleted_by" UUID,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "type" "address_type" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "address_line_1" VARCHAR(255) NOT NULL,
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(20) NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'IN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "registration_type" VARCHAR(50) NOT NULL,
    "registration_num" VARCHAR(100) NOT NULL,
    "issue_date" DATE,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "old_status" "business_status",
    "new_status" "business_status" NOT NULL,
    "reason" TEXT,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "pan" VARCHAR(10),
    "aadhaar_hash" VARCHAR(64),
    "portal_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "role_type" "contact_role_type" NOT NULL,
    "custom_title" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "share_percent" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "type" "address_type" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "address_line_1" VARCHAR(255) NOT NULL,
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(20) NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'IN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_communications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "opt_in_email" BOOLEAN NOT NULL DEFAULT true,
    "opt_in_sms" BOOLEAN NOT NULL DEFAULT true,
    "opt_in_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contact_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "main_contact_id" UUID NOT NULL,
    "related_contact_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "status" "client_status" NOT NULL DEFAULT 'ACTIVE',
    "onboarded_at" TIMESTAMPTZ,
    "category_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" CHAR(7),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "client_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tag_assignments" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "client_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID,
    "contact_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "source_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "expected_revenue" DECIMAL(12,2),
    "probability" INTEGER,
    "expected_close_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_stages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lead_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "activity_type" NOT NULL,
    "description" TEXT NOT NULL,
    "activity_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performed_by_id" UUID NOT NULL,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_conversions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "converted_by_id" UUID NOT NULL,
    "converted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "lead_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "idx_tenants_status" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "idx_tenants_subscription_status" ON "tenants"("subscription_status");

-- CreateIndex
CREATE INDEX "idx_tenants_plan_code" ON "tenants"("plan_code");

-- CreateIndex
CREATE INDEX "idx_tenants_soft_delete" ON "tenants"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_branding_tenant_id_key" ON "tenant_branding"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_tenant_id_key" ON "tenant_domains"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_domain_key" ON "tenant_domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_subdomain_key" ON "tenant_domains"("subdomain");

-- CreateIndex
CREATE INDEX "idx_tenant_domains_domain" ON "tenant_domains"("domain");

-- CreateIndex
CREATE INDEX "idx_tenant_domains_subdomain" ON "tenant_domains"("subdomain");

-- CreateIndex
CREATE INDEX "idx_tenant_domains_ssl_status" ON "tenant_domains"("is_verified", "ssl_status");

-- CreateIndex
CREATE INDEX "idx_users_tenant_status" ON "users"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_users_soft_delete" ON "users"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_users_tenant_owner" ON "users"("tenant_id", "is_owner");

-- CreateIndex
CREATE INDEX "idx_users_email_lookup" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "idx_users_last_login" ON "users"("last_login_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_user_active" ON "user_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_sessions_tenant_user" ON "user_sessions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_cleanup_job" ON "user_sessions"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_rotated_to_id_key" ON "refresh_tokens"("rotated_to_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id", "is_used");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_expiry" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_tenant_user" ON "refresh_tokens"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_otp_active_user" ON "otp_codes"("user_id", "purpose", "expires_at");

-- CreateIndex
CREATE INDEX "idx_otp_active_email" ON "otp_codes"("email", "purpose", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_configs_user_id_key" ON "mfa_configs"("user_id");

-- CreateIndex
CREATE INDEX "idx_mfa_configs_tenant" ON "mfa_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_accepted_by_id_key" ON "user_invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "idx_invitations_tenant_email" ON "user_invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "idx_invitations_expiry_status" ON "user_invitations"("expires_at", "status");

-- CreateIndex
CREATE INDEX "idx_login_history_user_timeline" ON "login_history"("tenant_id", "user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_history_events" ON "login_history"("tenant_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_history_email" ON "login_history"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_history_tenant" ON "login_history"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_history_ip" ON "login_history"("ip_address", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_permissions_module" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "idx_permissions_module_action" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX "idx_permissions_sensitive" ON "permissions"("is_sensitive");

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");

-- CreateIndex
CREATE INDEX "idx_permission_groups_module" ON "permission_groups"("module");

-- CreateIndex
CREATE INDEX "idx_permission_groups_order" ON "permission_groups"("display_order");

-- CreateIndex
CREATE INDEX "idx_roles_tenant_active" ON "roles"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_roles_type" ON "roles"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "idx_roles_soft_delete" ON "roles"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_role_permissions_by_role" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions_by_permission" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_resolution" ON "user_roles"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_by_role" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_expiry" ON "user_roles"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_tenant_id_user_id_role_id_key" ON "user_roles"("tenant_id", "user_id", "role_id");

-- CreateIndex
CREATE INDEX "idx_resource_policy_user_type" ON "resource_access_policies"("tenant_id", "user_id", "resource_type");

-- CreateIndex
CREATE INDEX "idx_resource_policy_by_resource" ON "resource_access_policies"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_resource_policy_expiry" ON "resource_access_policies"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "resource_access_policies_tenant_id_user_id_resource_type_re_key" ON "resource_access_policies"("tenant_id", "user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_types_code_key" ON "business_types"("code");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_status_idx" ON "businesses"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_pan_idx" ON "businesses"("tenant_id", "pan");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_gstin_idx" ON "businesses"("tenant_id", "gstin");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_cin_idx" ON "businesses"("tenant_id", "cin");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_deleted_at_idx" ON "businesses"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "businesses_name_idx" ON "businesses" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "business_addresses_business_id_is_primary_idx" ON "business_addresses"("business_id", "is_primary");

-- CreateIndex
CREATE INDEX "business_registrations_tenant_id_registration_num_idx" ON "business_registrations"("tenant_id", "registration_num");

-- CreateIndex
CREATE UNIQUE INDEX "business_registrations_business_id_registration_type_key" ON "business_registrations"("business_id", "registration_type");

-- CreateIndex
CREATE INDEX "business_assignments_tenant_id_user_id_idx" ON "business_assignments"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_assignments_business_id_user_id_key" ON "business_assignments"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "business_status_history_business_id_created_at_idx" ON "business_status_history"("business_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_portal_user_id_key" ON "contacts"("portal_user_id");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_email_idx" ON "contacts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_phone_idx" ON "contacts"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_pan_idx" ON "contacts"("tenant_id", "pan");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_deleted_at_idx" ON "contacts"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "contacts_first_name_last_name_idx" ON "contacts" USING GIN ("first_name" gin_trgm_ops, "last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "contact_roles_business_id_is_primary_idx" ON "contact_roles"("business_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "contact_roles_business_id_contact_id_role_type_key" ON "contact_roles"("business_id", "contact_id", "role_type");

-- CreateIndex
CREATE INDEX "contact_addresses_contact_id_is_primary_idx" ON "contact_addresses"("contact_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "contact_communications_contact_id_key" ON "contact_communications"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_relationships_main_contact_id_related_contact_id_key" ON "contact_relationships"("main_contact_id", "related_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_business_id_key" ON "clients"("business_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_status_idx" ON "clients"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "clients_tenant_id_category_id_idx" ON "clients"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "client_assignments_tenant_id_user_id_idx" ON "client_assignments"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_assignments_client_id_user_id_key" ON "client_assignments"("client_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_categories_tenant_id_name_key" ON "client_categories"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "client_tags_tenant_id_name_key" ON "client_tags"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "client_tag_assignments_client_id_tag_id_key" ON "client_tag_assignments"("client_id", "tag_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_stage_id_idx" ON "leads"("tenant_id", "stage_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_expected_close_date_idx" ON "leads"("tenant_id", "expected_close_date");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_tenant_id_name_key" ON "lead_sources"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "lead_stages_tenant_id_order_idx" ON "lead_stages"("tenant_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "lead_stages_tenant_id_name_key" ON "lead_stages"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_activity_date_idx" ON "lead_activities"("lead_id", "activity_date" DESC);

-- CreateIndex
CREATE INDEX "lead_notes_lead_id_created_at_idx" ON "lead_notes"("lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "lead_assignments_tenant_id_user_id_idx" ON "lead_assignments"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_lead_id_user_id_key" ON "lead_assignments"("lead_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_conversions_lead_id_key" ON "lead_conversions"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_conversions_client_id_key" ON "lead_conversions"("client_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_rotated_to_id_fkey" FOREIGN KEY ("rotated_to_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_configs" ADD CONSTRAINT "mfa_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_access_policies" ADD CONSTRAINT "resource_access_policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_access_policies" ADD CONSTRAINT "resource_access_policies_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "business_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_addresses" ADD CONSTRAINT "business_addresses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_assignments" ADD CONSTRAINT "business_assignments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_assignments" ADD CONSTRAINT "business_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_status_history" ADD CONSTRAINT "business_status_history_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_status_history" ADD CONSTRAINT "business_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_roles" ADD CONSTRAINT "contact_roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_roles" ADD CONSTRAINT "contact_roles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_communications" ADD CONSTRAINT "contact_communications_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_main_contact_id_fkey" FOREIGN KEY ("main_contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_related_contact_id_fkey" FOREIGN KEY ("related_contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "client_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "client_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "lead_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_conversions" ADD CONSTRAINT "lead_conversions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_conversions" ADD CONSTRAINT "lead_conversions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_conversions" ADD CONSTRAINT "lead_conversions_converted_by_id_fkey" FOREIGN KEY ("converted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
