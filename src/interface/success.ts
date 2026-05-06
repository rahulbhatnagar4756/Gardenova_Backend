export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
