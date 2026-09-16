export type ReadErrorCode =
  | "CONFIG_INVALID"
  | "TRANSPORT_ERROR"
  | "HTTP_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE"
  | "ACCOUNT_MISMATCH"
  | "CHECKPOINT_REGRESSION"
  | "JOURNAL_LOCKED"
  | "JOURNAL_INVALID"
  | "JOURNAL_FULL"
  | "JOURNAL_IO";

/** Deliberately excludes URLs, response bodies, credentials and underlying causes. */
export class ReadError extends Error {
  constructor(
    public readonly code: ReadErrorCode,
    public readonly status?: number,
  ) {
    super(code);
    this.name = "ReadError";
  }

  get retryable(): boolean {
    return this.code === "TRANSPORT_ERROR" ||
      (this.code === "HTTP_ERROR" && (this.status === 429 || (this.status ?? 0) >= 500));
  }
}
