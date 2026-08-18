-- CreateIndex
CREATE INDEX "businesses_tenant_id_din_idx" ON "businesses"("tenant_id", "din");

-- CreateIndex
CREATE INDEX "businesses_trade_name_idx" ON "businesses" USING GIN ("trade_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_title_idx" ON "leads" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "tasks_title_idx" ON "tasks" USING GIN ("title" gin_trgm_ops);
