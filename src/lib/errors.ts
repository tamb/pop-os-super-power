export function messageFromError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === "object" && "message" in err) {
    const message = err.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return String(err);
}
