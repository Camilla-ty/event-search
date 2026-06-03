import { InlineErrorBanner } from "@/src/components/common/states";

export function AuthFormError({ message }: { message: string }) {
  return <InlineErrorBanner message={message} variant="error" />;
}
