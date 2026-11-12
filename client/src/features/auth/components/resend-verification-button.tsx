import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toApiError } from "@/lib/api-error";
import { useResendVerification } from "../auth-api";

export function ResendVerificationButton() {
  const resend = useResendVerification();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={resend.isPending || resend.isSuccess}
      onClick={() =>
        resend.mutate(undefined, {
          onSuccess: () => toast.success("Verification email sent. Check your inbox."),
          onError: (error) => toast.error(toApiError(error).message),
        })
      }
    >
      {resend.isSuccess ? "Email sent" : "Resend verification email"}
    </Button>
  );
}
