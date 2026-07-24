import { LoadingStatus } from "@/src/components/common/loading/primitives/LoadingStatus";

type ImportProgressMessageProps = {
  message: string;
};

export function ImportProgressMessage({ message }: ImportProgressMessageProps) {
  return <LoadingStatus message={message} showSpinner spinnerSize="md" />;
}
