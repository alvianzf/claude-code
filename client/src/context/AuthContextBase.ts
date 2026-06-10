import { createContext } from "react";
import type { LoginRequest, UserPublic } from "../types";

export interface AuthContextValue {
  user: UserPublic | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
