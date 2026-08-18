import { TenantDomain } from '@prisma/client';
import { WHITE_LABEL } from '@shared/constants';
import { TenantDomainResponseDto } from '../dto/domain.res.dto';

export class DomainMapper {
  static toResponseDto(domain: TenantDomain): TenantDomainResponseDto {
    return {
      domain: domain.domain,
      subdomain: domain.subdomain,
      isVerified: domain.isVerified,
      verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
      sslStatus: domain.sslStatus,
      verification:
        !domain.isVerified && !domain.subdomain
          ? {
              recordType: 'TXT',
              recordName: `${WHITE_LABEL.VERIFICATION_TXT_PREFIX}.${domain.domain}`,
              recordValue: domain.verificationToken,
            }
          : null,
      createdAt: domain.createdAt.toISOString(),
    };
  }
}
