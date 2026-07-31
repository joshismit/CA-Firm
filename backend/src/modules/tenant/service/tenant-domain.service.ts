import { Request } from 'express';
import dns from 'node:dns';
import { DomainSslStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/environment';
import { BaseService } from '@shared/base';
import { ConflictError, ValidationError } from '@shared/errors';
import { WHITE_LABEL } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { TenantDomainRepository } from '../repository/tenant-domain.repository';
import { DomainMapper } from '../mapper/domain.mapper';
import { CreateTenantDomainDto } from '../dto/domain.req.dto';
import { TenantDomainResponseDto } from '../dto/domain.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Domain Service (PRD §4.3 — "firmname.yourdomain.com or custom domain")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A platform subdomain (`<slug>.PLATFORM_DOMAIN`) is verified and given
 * `sslStatus: PROVISIONED` the instant it's created — the platform already
 * owns that DNS and, in real infra, already terminates TLS for it under a
 * wildcard certificate; there is nothing to prove or provision. A custom
 * domain starts unverified with `sslStatus: PENDING` and stays that way
 * until `verifyDomain()`'s real DNS TXT lookup succeeds — and even once
 * verified, actually ISSUING a certificate for an arbitrary third-party
 * domain is a reverse-proxy/CDN/ACME concern (e.g. Cloudflare, an ACME
 * client fronting the app), not something this service does — `sslStatus`
 * for a custom domain is only ever read here, never advanced past `PENDING`
 * by this code. That's an honest boundary, not a missing feature: no ACME
 * account/infra exists for this platform to provision against.
 *
 * `resolveTxt` is injected (defaulting to the real `dns.promises.resolveTxt`)
 * so tests can substitute a fake resolver instead of depending on a real,
 * externally-owned domain actually having the right TXT record — the same
 * "inject the network boundary" precedent as `EmailProvider`'s `mailTransport`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantDomainService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: TenantDomainRepository = new TenantDomainRepository(prisma),
    private readonly resolveTxt: (hostname: string) => Promise<string[][]> = dns.promises.resolveTxt,
  ) {
    super(req);
  }

  async getDomain(): Promise<TenantDomainResponseDto | null> {
    const domain = await this.repository.findByTenantId(this.tenantId as string);
    return domain ? DomainMapper.toResponseDto(domain) : null;
  }

  async createDomain(dto: CreateTenantDomainDto): Promise<TenantDomainResponseDto> {
    if (Boolean(dto.subdomain) === Boolean(dto.customDomain)) {
      throw new ValidationError('Provide exactly one of subdomain or customDomain.');
    }

    const tenantId = this.tenantId as string;

    const existing = await this.repository.findByTenantId(tenantId);
    if (existing) {
      throw new ConflictError('This tenant already has a domain configured. Remove it before adding another.');
    }

    if (dto.subdomain) {
      const taken = await this.repository.findBySubdomainLabel(dto.subdomain);
      if (taken) {
        throw new ConflictError('This subdomain is already taken.');
      }

      this.logger.info({ subdomain: dto.subdomain }, 'Configuring platform subdomain');

      const domain = await this.repository.create({
        tenant: { connect: { id: tenantId } },
        domain: `${dto.subdomain}.${env.PLATFORM_DOMAIN}`,
        subdomain: dto.subdomain,
        verificationToken: CryptoUtils.generateRandomToken(WHITE_LABEL.VERIFICATION_TOKEN_BYTES),
        isVerified: true,
        verifiedAt: new Date(),
        sslStatus: DomainSslStatus.PROVISIONED,
      });
      return DomainMapper.toResponseDto(domain);
    }

    const customDomain = dto.customDomain as string;
    const hostTaken = await this.repository.findByHostname(customDomain);
    if (hostTaken) {
      throw new ConflictError('This domain is already in use.');
    }

    this.logger.info({ domain: customDomain }, 'Configuring custom domain');

    const domain = await this.repository.create({
      tenant: { connect: { id: tenantId } },
      domain: customDomain,
      verificationToken: CryptoUtils.generateRandomToken(WHITE_LABEL.VERIFICATION_TOKEN_BYTES),
      isVerified: false,
      sslStatus: DomainSslStatus.PENDING,
    });
    return DomainMapper.toResponseDto(domain);
  }

  /**
   * Idempotent — re-verifying an already-verified domain, or a domain whose
   * TXT record still isn't there yet, both return normally with the current
   * (possibly still-unverified) state rather than throwing. "Not verified
   * yet" is an expected polling outcome, not an error.
   */
  async verifyDomain(): Promise<TenantDomainResponseDto> {
    const domain = await this.repository.findByTenantId(this.tenantId as string);
    this.validateExists(domain, 'Domain');

    if (domain.isVerified) {
      return DomainMapper.toResponseDto(domain);
    }

    const recordName = `${WHITE_LABEL.VERIFICATION_TXT_PREFIX}.${domain.domain}`;
    let found = false;
    try {
      const records = await this.resolveTxt(recordName);
      found = records.some((chunks) => chunks.join('').trim() === domain.verificationToken);
    } catch (err) {
      this.logger.info({ err, recordName }, 'Domain verification TXT lookup did not resolve — not verified yet');
    }

    if (!found) {
      return DomainMapper.toResponseDto(domain);
    }

    const updated = await this.repository.update(domain.id, { isVerified: true, verifiedAt: new Date() });
    this.logger.info({ domain: domain.domain }, 'Custom domain ownership verified');
    return DomainMapper.toResponseDto(updated);
  }

  async deleteDomain(): Promise<void> {
    const tenantId = this.tenantId as string;
    const domain = await this.repository.findByTenantId(tenantId);
    this.validateExists(domain, 'Domain');

    this.logger.info({ domain: domain.domain }, 'Removing tenant domain');
    await this.repository.deleteByTenantId(tenantId);
  }
}
