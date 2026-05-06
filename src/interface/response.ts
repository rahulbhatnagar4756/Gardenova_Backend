import { AxiosRequestConfig } from "axios";

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: unknown;
  config: {
    method?: string;
    url?: string;
    baseURL?: string;
  };
}

export interface ParallelRequest {
  method: string;
  url: string;
  data?: unknown;
  config?: AxiosRequestConfig;
}
