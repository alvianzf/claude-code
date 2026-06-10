import { useContext } from "react";
import { AuthContext } from "./AuthContextBase";
import type { AuthContextValue } from "./AuthContextBase";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
