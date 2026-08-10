export interface PaginationMeta {
  totalData: number;
  totalPage: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface RequestMeta {
  timestamp: string;
  path: string;
  requestId: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  pagination?: PaginationMeta;
  meta: RequestMeta;
}

export interface ValidationErrorDetail {
  field: string;
  rule?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ValidationErrorDetail[];
  meta: RequestMeta;
}
