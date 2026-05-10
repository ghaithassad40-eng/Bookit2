// Stylised, original brand marks for each gateway. We keep these generic
// (no rasterized logos) to avoid trademark issues — they look "official enough"
// to be recognisable while being unambiguously our own marks.

import type { PaymentMethodId } from "@/lib/payments";
import { cn } from "@/lib/utils";

interface Props {
  method: PaymentMethodId;
  className?: string;
}

export function PaymentBrandMark({ method, className }: Props) {
  switch (method) {
    case "visa":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#1A1F71] to-[#2A3DA8] text-[10px] font-extrabold italic tracking-tight text-white shadow-inner",
            className,
          )}
        >
          VISA
        </div>
      );
    case "apple_pay":
      return (
        <div
          className={cn(
            "flex h-9 w-14 items-center justify-center gap-0.5 rounded-md bg-black text-[10px] font-semibold text-white",
            className,
          )}
        >
          <span className="text-[13px] leading-none"></span>
          <span>Pay</span>
        </div>
      );
    case "google_pay":
      return (
        <div
          className={cn(
            "flex h-9 w-14 items-center justify-center gap-0.5 rounded-md border border-black/10 bg-white text-[10px] font-semibold text-black shadow-sm",
            className,
          )}
        >
          <span className="text-[12px] font-bold leading-none">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]"> </span>
          </span>
          <span>Pay</span>
        </div>
      );
    case "samsung_pay":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#1428A0] to-[#1f51c4] text-[9px] font-bold tracking-tight text-white",
            className,
          )}
        >
          Samsung
        </div>
      );
    case "paypal":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-[#003087] text-[10px] font-extrabold italic tracking-tight",
            className,
          )}
        >
          <span>
            <span className="text-[#0070BA]">Pay</span>
            <span className="text-white">Pal</span>
          </span>
        </div>
      );
    case "knet":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#0E3A8A] to-[#15a4d6] text-[10px] font-extrabold tracking-widest text-white",
            className,
          )}
        >
          KNET
        </div>
      );
    case "mada":
      return (
        <div
          className={cn(
            "flex h-9 w-14 items-center justify-center rounded-md bg-white text-[10px] font-extrabold tracking-tight text-[#84AF40] ring-1 ring-[#84AF40]/30",
            className,
          )}
        >
          mada
        </div>
      );
    case "stcpay":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#4F008C] to-[#7C3AED] text-[9px] font-extrabold tracking-tight text-white",
            className,
          )}
        >
          STC Pay
        </div>
      );
    case "uaecc":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#005f3c] via-[#FFFFFF] to-[#a3242f] text-[9px] font-extrabold tracking-tight text-black ring-1 ring-black/10",
            className,
          )}
        >
          UAE
        </div>
      );
    case "amex":
      return (
        <div
          className={cn(
            "grid h-9 w-14 place-items-center rounded-md bg-gradient-to-br from-[#0E64C8] to-[#0a4fa3] text-[10px] font-extrabold italic tracking-tight text-white",
            className,
          )}
        >
          AMEX
        </div>
      );
  }
}
