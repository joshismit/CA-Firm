import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { ContactService } from '../service/contact.service';
import { ContactMapper } from '../mapper/contact.mapper';
import { CreateContactDto, UpdateContactDto, ListContactsQueryDto, AssignContactRoleDto } from '../dto/contact.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `ContactService`,
 * call exactly one service method, map the result through `ContactMapper`,
 * and respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/business/controller/business.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ContactController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const contact = await service.createContact(req.body as CreateContactDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, ContactMapper.toResponseDto(contact)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const contact = await service.updateContact(req.params.id, req.body as UpdateContactDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, ContactMapper.toResponseDto(contact)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    await service.deleteContact(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const contact = await service.getContactById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, ContactMapper.toResponseDto(contact), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const { data, meta } = await service.listContacts(req.query as unknown as ListContactsQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.paginated(req, ContactMapper.toResponseDtoList(data), meta));
  });

  static listRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const roles = await service.listContactRoles(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, ContactMapper.toRoleResponseDtoList(roles), MESSAGES.FETCHED));
  });

  static assignRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ContactService(req);
    const role = await service.assignContactRole(req.body as AssignContactRoleDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, ContactMapper.toRoleResponseDto(role)));
  });
}
