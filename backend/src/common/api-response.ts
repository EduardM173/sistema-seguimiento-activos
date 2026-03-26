/**
 * Standard API response wrapper.
 * Every endpoint in the application uses this format for consistency.
 *
 * Success:  { success: true, data: T, message?: string }
 * List:     { success: true, data: T[], meta: PaginationMeta }
 * Error:    { success: false, message: string, errors?: string[] }
 */

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
  errors?: string[];

  static success<T>(data: T, message?: string): ApiResponse<T> {
    const response = new ApiResponse<T>();
    response.success = true;
    response.data = data;
    if (message) response.message = message;
    return response;
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
  ): ApiResponse<T[]> {
    const response = new ApiResponse<T[]>();
    response.success = true;
    response.data = data;
    response.meta = {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
    return response;
  }

  static error(message: string, errors?: string[]): ApiResponse<null> {
    const response = new ApiResponse<null>();
    response.success = false;
    response.message = message;
    if (errors) response.errors = errors;
    return response;
  }
}
