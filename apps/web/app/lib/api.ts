"use client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CurrentUserResponse = {
  error?: string;
  user?: AuthenticatedUser;
};

export class ApiError extends Error {
  status: number;

  /**
   * Creates an API error with the originating HTTP status.
   *
   * @param message User-facing error message.
   * @param status HTTP response status code.
   */
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Builds an API URL from the optional public API origin.
 *
 * @param path API path beginning with a slash.
 * @returns Same-origin path or absolute API URL.
 */
export const getApiUrl = (path: string) => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

  return `${apiBaseUrl}${path}`;
};

/**
 * Reads the current authenticated user using the HTTP-only auth cookie.
 *
 * @returns Current authenticated user.
 */
export const getCurrentUser = async () => {
  const response = await fetch(getApiUrl("/api/auth/me"), {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as CurrentUserResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Authentication check failed.", response.status);
  }

  if (!payload.user) {
    throw new ApiError("Authentication response did not include a user.", response.status);
  }

  return payload.user;
};
