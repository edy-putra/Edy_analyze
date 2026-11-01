export class AppError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status = 500, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}
