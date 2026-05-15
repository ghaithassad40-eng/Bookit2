import { useEffect, useState } from "react";
import {
  getStoredCustomer,
  onCustomerAuthChange,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
  type AuthResult,
  type CustomerProfile,
  type SignUpInput,
} from "@/lib/customerAuth";

export interface UseCustomerAuth {
  customer: CustomerProfile | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => AuthResult;
  signUp: (input: SignUpInput) => AuthResult;
  signOut: () => void;
}

/**
 * Lightweight customer-auth hook. Reads the current customer from
 * localStorage and re-renders the host component whenever sign-in / sign-out
 * happens — either in this tab (via our custom event) or in another tab (via
 * the native storage event).
 */
export function useCustomerAuth(): UseCustomerAuth {
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => getStoredCustomer());

  useEffect(() => {
    return onCustomerAuthChange(() => {
      setCustomer(getStoredCustomer());
    });
  }, []);

  return {
    customer,
    isAuthenticated: customer !== null,
    signIn: (email, password) => signInCustomer(email, password),
    signUp: (input) => signUpCustomer(input),
    signOut: () => signOutCustomer(),
  };
}
