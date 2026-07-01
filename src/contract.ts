/**
 * Browser-safe API contract shared by the Worker and the dashboard.
 *
 * Keep this file free of any Worker-only imports (no `cloudflare:workers`,
 * no `Response` helpers) so the dashboard can import it directly via the
 * `@shared/contract` alias.
 */

/** Uniform JSON envelope returned by every ketsoc API endpoint. */
export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}
