import axios, { AxiosError } from "axios";
import config from "../config/env";

/**
 * Makes a GET request to the Country-State-City (CSC) API for the given endpoint.
 * This function is generic and returns data of type T.
 *
 * @param endpoint - The API endpoint to call, e.g., "/countries" or "/countries/IN/states".
 * @returns A Promise resolving to the data returned by the CSC API, typed as T.
 * @throws An object containing `status` and `message` if the request fails or the network is unavailable.
 */
export const makeCSCRequest = async <T>(endpoint: string): Promise<T> => {
  try {
    const response = await axios.get<T>(
      `${config.CSC_API_BASE_URL}${endpoint}`,
      {
        headers: {
          "X-CSCAPI-KEY": config.CSC_API_KEY,
        },
      }
    );
    return response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      throw {
        status: axiosErr.response?.status ?? 500,
        message: axiosErr.response?.data?.error || "API request failed",
      };
    }

    throw {
      status: 500,
      message: "Network error or service unavailable",
    };
  }
};
