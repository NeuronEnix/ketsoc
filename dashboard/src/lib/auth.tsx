import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, ApiError } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: number;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

const ME_KEY = ["me"] as const;

type Credentials = { email: string; password: string };

/** Current signed-in user (null when unauthenticated). */
export function useMe() {
  return useQuery<AuthUser | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<AuthUser>("/api/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          return null;
        }
        throw e;
      }
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Credentials) => api.post<AuthUser>("/api/auth/login", v),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Credentials) => api.post<AuthUser>("/api/auth/signup", v),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => qc.setQueryData(ME_KEY, null),
  });
}
