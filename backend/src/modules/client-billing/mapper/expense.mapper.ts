import { Expense } from '@prisma/client';
import { ExpenseResponseDto } from '../dto/expense.res.dto';

/** Entity ⇄ DTO mapper for `Expense`. Controllers/services must always return data through this mapper — never serialize a raw Prisma row. */
export class ExpenseMapper {
  static toResponseDto(expense: Expense): ExpenseResponseDto {
    return {
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      category: expense.category,
      vendor: expense.vendor,
      amount: expense.amount.toNumber(),
      date: expense.date ? expense.date.toISOString() : null,
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(expenses: Expense[]): ExpenseResponseDto[] {
    return expenses.map((expense) => this.toResponseDto(expense));
  }
}
