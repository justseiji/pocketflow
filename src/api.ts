import type { Command, State } from "../shared/model";

let csrf = "";
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Portfolio {
  state: State;
  version: number;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({
    error:
      "The server is still starting or unavailable. Please try again in a moment.",
  }));
  if (!response.ok)
    throw new ApiError(
      data.error ?? "Unable to complete this request.",
      response.status,
    );
  if (data.csrf) csrf = data.csrf;
  return data as T;
}
export const saveCommand = (version: number, command: Command) =>
  request<Portfolio>("/commands", { version, command });
