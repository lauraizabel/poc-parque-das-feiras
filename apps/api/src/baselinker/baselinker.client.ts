import { Injectable } from "@nestjs/common";

export class BaselinkerApiError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string
  ) {
    super(message);
    this.name = "BaselinkerApiError";
  }
}

export type BaselinkerResponse<T> = {
  status: "SUCCESS" | "ERROR";
  error_code?: string;
  error_message?: string;
} & T;

@Injectable()
export class BaselinkerClient {
  private readonly endpoint = "https://api.baselinker.com/connector.php";

  async call<T>(token: string, method: string, parameters: object = {}): Promise<T> {
    const body = new URLSearchParams({
      token,
      method,
      parameters: JSON.stringify(parameters)
    });

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new BaselinkerApiError(
        "HTTP_ERROR",
        `BaseLinker HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as BaselinkerResponse<T>;

    if (data.status === "ERROR") {
      throw new BaselinkerApiError(
        data.error_code ?? "UNKNOWN",
        data.error_message ?? "BaseLinker API error"
      );
    }

    return data as T;
  }
}
