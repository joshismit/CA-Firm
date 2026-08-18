import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { ExpenseService } from '../service/expense.service';
import { ExpenseMapper } from '../mapper/expense.mapper';
import { CreateExpenseDto, UpdateExpenseDto, ListExpensesQueryDto } from '../dto/expense.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/contacts/controller/contact.controller.ts`.
 */
export class ExpenseController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ExpenseService(req);
    const { data, meta } = await service.listExpenses(req.query as unknown as ListExpensesQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, ExpenseMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ExpenseService(req);
    const expense = await service.getExpenseById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, ExpenseMapper.toResponseDto(expense), MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ExpenseService(req);
    const expense = await service.createExpense(req.body as CreateExpenseDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, ExpenseMapper.toResponseDto(expense)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ExpenseService(req);
    const expense = await service.updateExpense(req.params.id, req.body as UpdateExpenseDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, ExpenseMapper.toResponseDto(expense)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ExpenseService(req);
    await service.deleteExpense(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
