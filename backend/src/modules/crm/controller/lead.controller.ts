import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { LeadService } from '../service/lead.service';
import { LeadMapper } from '../mapper/lead.mapper';
import {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
  ConvertLeadDto,
  CreateLeadNoteDto,
  AssignLeadDto,
  SendProposalDto,
  RespondProposalDto,
  LeadTimelineQueryDto,
} from '../dto/lead.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Lead Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `LeadService`,
 * call exactly one service method, map the result through `LeadMapper`,
 * and respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/business/controller/business.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class LeadController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.createLead(req.body as CreateLeadDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, LeadMapper.toResponseDto(lead)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.updateLead(req.params.id, req.body as UpdateLeadDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, LeadMapper.toResponseDto(lead)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    await service.deleteLead(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.getLeadById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, LeadMapper.toResponseDto(lead), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const { data, meta } = await service.listLeads(req.query as unknown as ListLeadsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, LeadMapper.toResponseDtoList(data), meta));
  });

  static listStages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const stages = await service.listStages();

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, LeadMapper.toStageResponseDtoList(stages), MESSAGES.FETCHED));
  });

  static convert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.convertLead(req.params.id, req.body as ConvertLeadDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, LeadMapper.toResponseDto(lead)));
  });

  static sendProposal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.sendProposal(req.params.id, req.body as SendProposalDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, LeadMapper.toResponseDto(lead)));
  });

  static acceptProposal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.acceptProposal(req.params.id, req.body as RespondProposalDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, LeadMapper.toResponseDto(lead)));
  });

  static rejectProposal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const lead = await service.rejectProposal(req.params.id, req.body as RespondProposalDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, LeadMapper.toResponseDto(lead)));
  });

  static timeline = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const query = req.query as unknown as LeadTimelineQueryDto;
    const { data, meta } = await service.getLeadTimeline(req.params.id, query);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, data, meta));
  });

  static dashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const stats = await service.getDashboardStats();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, stats, MESSAGES.FETCHED));
  });

  static listNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const notes = await service.listLeadNotes(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, LeadMapper.toNoteResponseDtoList(notes), MESSAGES.FETCHED));
  });

  static addNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const note = await service.addLeadNote(req.params.id, req.body as CreateLeadNoteDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, LeadMapper.toNoteResponseDto(note)));
  });

  static listAssignments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const assignments = await service.listLeadAssignments(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, LeadMapper.toAssignmentResponseDtoList(assignments), MESSAGES.FETCHED));
  });

  static assign = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    const assignment = await service.assignLeadUser(req.params.id, req.body as AssignLeadDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, LeadMapper.toAssignmentResponseDto(assignment)));
  });

  static unassign = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new LeadService(req);
    await service.unassignLeadUser(req.params.id, req.params.userId);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
