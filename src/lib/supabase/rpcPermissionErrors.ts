export type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** PostgreSQL insufficient_privilege / PostgREST execute denial. */
export function isRpcPermissionDenied(error: RpcErrorLike | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? "").trim();
  const message = (error.message ?? "").toLowerCase();

  if (code === "42501") return true;
  if (code === "PGRST301") return true;

  if (message.includes("permission denied for function")) return true;
  if (message.includes("permission denied")) return true;
  if (message.includes("not authorized")) return true;
  if (message.includes("insufficient privilege")) return true;

  return false;
}

/** Raised inside PL/pgSQL via RAISE EXCEPTION (not a grant failure). */
export function isRpcBusinessRuleError(error: RpcErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (error.code ?? "").trim() === "P0001";
}

export function describeRpcPermissionExpectation(
  error: RpcErrorLike | null | undefined,
): string {
  if (isRpcPermissionDenied(error)) {
    return "permission_denied";
  }
  if (isRpcBusinessRuleError(error)) {
    return "business_rule_error";
  }
  if (error?.message) {
    return `other:${error.code ?? "unknown"}:${error.message}`;
  }
  return "no_error";
}
