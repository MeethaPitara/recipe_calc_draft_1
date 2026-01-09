import { toast } from "@/hooks/use-toast";

/**
 * Standardized API error toast handler
 * Provides consistent UX for common HTTP error codes and messages
 * 
 * @param err - Error object or unknown error type
 * @param context - Optional context string describing the failed action
 */
export function showApiErrorToast(err: unknown, context = "Action failed") {
  const msg = (typeof err === "object" && err && "message" in err) ? (err as any).message : String(err);
  const status = (err as any)?.status ?? (err as any)?.response?.status ?? null;

  let title = context;
  let description = msg;

  // Handle specific HTTP status codes with user-friendly messages
  if (status === 429) {
    title = "Rate limit reached";
    description = "You've hit the hourly limit. Try again in ~1 hour.";
  } else if (status === 402) {
    title = "AI credits exhausted";
    description = "Please top up or try later.";
  } else if (status === 401) {
    title = "Please sign in";
    description = "Your session expired. Sign in and retry.";
  }

  toast({ title, description, variant: "destructive" });
}
