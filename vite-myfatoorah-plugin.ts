// Vite dev-server plugin that mirrors the Supabase Edge Functions
// (myfatoorah-initiate / myfatoorah-callback) for local development.
//
// The MyFatoorah API key is read from process.env (loaded from .env.local
// by vite.config.ts) and only ever lives on the dev server — the browser
// only sees the proxied responses. In production these endpoints are served
// by the deployed Supabase Edge Functions instead.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

interface PluginEnv {
  MYFATOORAH_API_KEY: string;
  MYFATOORAH_BASE_URL: string;
  MYFATOORAH_RETURN_BASE: string;
}

const METHOD_CODES: Record<string, string[]> = {
  visa: ["vm", "vmc", "creditcard"],
  apple_pay: ["ap", "applepay"],
  google_pay: ["gp", "googlepay"],
  samsung_pay: ["sp", "samsungpay"],
  knet: ["kn", "knet"],
  mada: ["md", "mada"],
  amex: ["ae", "amex"],
  stcpay: ["stcpay", "stc"],
  any: [],
};

interface MFMethod {
  PaymentMethodId: number;
  PaymentMethodCode: string;
  PaymentMethodEn: string;
}

function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

async function mfCall<T>(
  env: PluginEnv,
  path: string,
  body: unknown,
): Promise<T> {
  const resp = await fetch(`${env.MYFATOORAH_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MYFATOORAH_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as {
    IsSuccess?: boolean;
    Message?: string;
    Data?: T;
    ValidationErrors?: { Name: string; Error: string }[];
  };
  if (!resp.ok || data?.IsSuccess === false) {
    const detail = data?.ValidationErrors?.map((v) => `${v.Name}: ${v.Error}`).join("; ");
    throw new Error(detail || data?.Message || `MyFatoorah ${path} failed (${resp.status})`);
  }
  return data.Data as T;
}

function resolveMethodId(methods: MFMethod[], internal: string): number | null {
  if (internal === "any") return null;
  const codes = METHOD_CODES[internal] ?? [];
  for (const m of methods) {
    const code = (m.PaymentMethodCode ?? "").toLowerCase();
    if (codes.some((c) => code === c || code.includes(c))) return m.PaymentMethodId;
  }
  const fb = methods.find((m) =>
    m.PaymentMethodEn?.toLowerCase().includes(internal.replace("_", " ")),
  );
  return fb?.PaymentMethodId ?? null;
}

export interface MyFatoorahDevOptions {
  /** Override env loaded from .env.local. */
  env?: Partial<PluginEnv>;
}

export function myfatoorahDevProxy(opts: MyFatoorahDevOptions = {}): Plugin {
  return {
    name: "bookit:myfatoorah-dev-proxy",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const env: PluginEnv = {
        MYFATOORAH_API_KEY: opts.env?.MYFATOORAH_API_KEY ?? process.env.MYFATOORAH_API_KEY ?? "",
        MYFATOORAH_BASE_URL:
          opts.env?.MYFATOORAH_BASE_URL ??
          process.env.MYFATOORAH_BASE_URL ??
          "https://apitest.myfatoorah.com",
        MYFATOORAH_RETURN_BASE:
          opts.env?.MYFATOORAH_RETURN_BASE ??
          process.env.MYFATOORAH_RETURN_BASE ??
          "http://localhost:5173",
      };

      if (!env.MYFATOORAH_API_KEY) {
        // eslint-disable-next-line no-console
        console.warn(
          "[bookit] MYFATOORAH_API_KEY not set in .env.local — /api/myfatoorah-* will return 503.",
        );
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[bookit] MyFatoorah dev proxy active → ${env.MYFATOORAH_BASE_URL}`,
        );
      }

      // ----- POST /api/myfatoorah-initiate ---------------------------------
      server.middlewares.use("/api/myfatoorah-initiate", async (req, res, next) => {
        if (req.method !== "POST") return next();
        if (!env.MYFATOORAH_API_KEY) return send(res, 503, { success: false, error: "MYFATOORAH_API_KEY not set" });

        try {
          const body = await readJson<{
            method: string;
            amount: number;
            currency: string;
            reference: string;
            business_slug: string;
            customer: { name: string; phone?: string | null; email?: string | null };
            booking_id?: string | null;
            language?: "EN" | "AR";
          }>(req);

          if (!body.amount || !body.currency || !body.reference || !body.business_slug) {
            return send(res, 400, { success: false, error: "missing fields" });
          }

          // 1. InitiatePayment → list of available methods + service charge
          const init = await mfCall<{ PaymentMethods: MFMethod[] }>(env, "/v2/InitiatePayment", {
            InvoiceAmount: body.amount,
            CurrencyIso: body.currency,
          });

          const methodId = resolveMethodId(init.PaymentMethods ?? [], body.method);

          const callbackUrl = `${env.MYFATOORAH_RETURN_BASE}/business/${body.business_slug}/payment/callback?ref=${encodeURIComponent(body.reference)}`;
          const errorUrl = `${callbackUrl}&error=1`;

          const common = {
            CustomerName: body.customer.name || "Customer",
            DisplayCurrencyIso: body.currency,
            MobileCountryCode: "+965",
            CustomerMobile: (body.customer.phone ?? "").replace(/\D/g, "") || "00000000",
            CustomerEmail: body.customer.email ?? "noreply@bookit.local",
            InvoiceValue: body.amount,
            CallBackUrl: callbackUrl,
            ErrorUrl: errorUrl,
            Language: body.language ?? "EN",
            CustomerReference: body.reference,
            UserDefinedField: body.booking_id ?? body.reference,
          };

          let exec: {
            InvoiceId: number;
            IsDirectPayment: boolean;
            PaymentURL: string;
            CustomerReference: string;
          };

          if (methodId) {
            exec = await mfCall(env, "/v2/ExecutePayment", {
              ...common,
              PaymentMethodId: methodId,
            });
          } else {
            exec = await mfCall(env, "/v2/SendPayment", {
              ...common,
              NotificationOption: "LNK",
            });
          }

          return send(res, 200, {
            success: true,
            paymentUrl: exec.PaymentURL,
            invoiceId: exec.InvoiceId,
            customerReference: exec.CustomerReference,
          });
        } catch (err) {
          return send(res, 502, {
            success: false,
            error: err instanceof Error ? err.message : "MyFatoorah error",
          });
        }
      });

      // ----- POST /api/myfatoorah-callback ---------------------------------
      server.middlewares.use("/api/myfatoorah-callback", async (req, res, next) => {
        if (req.method !== "POST") return next();
        if (!env.MYFATOORAH_API_KEY) return send(res, 503, { success: false, error: "MYFATOORAH_API_KEY not set" });

        try {
          const body = await readJson<{
            paymentId?: string | null;
            invoiceId?: string | number | null;
            reference?: string | null;
          }>(req);

          if (!body.paymentId && !body.invoiceId) {
            return send(res, 400, { success: false, error: "paymentId or invoiceId required" });
          }

          const status = await mfCall<{
            InvoiceId: number;
            InvoiceStatus: string;
            CustomerReference: string | null;
            InvoiceValue: number;
            InvoiceTransactions?: Array<{
              PaymentGateway: string;
              PaymentId: string;
              TransactionStatus: string;
              CardNumber: string | null;
              Error: string | null;
              Currency: string;
            }>;
          }>(env, "/v2/GetPaymentStatus", body.paymentId
            ? { Key: String(body.paymentId), KeyType: "PaymentId" }
            : { Key: String(body.invoiceId), KeyType: "InvoiceId" });

          const tx = status.InvoiceTransactions?.[0];
          const isPaid =
            status.InvoiceStatus === "Paid" &&
            (tx?.TransactionStatus === "Success" || tx?.TransactionStatus === "Succss");

          return send(res, 200, {
            success: isPaid,
            status: status.InvoiceStatus,
            transactionStatus: tx?.TransactionStatus ?? null,
            paymentGateway: tx?.PaymentGateway ?? null,
            transactionId: tx?.PaymentId ?? null,
            invoiceId: status.InvoiceId,
            customerReference: status.CustomerReference ?? body.reference,
            amount: status.InvoiceValue,
            cardNumber: tx?.CardNumber ?? null,
            error: tx?.Error ?? null,
          });
        } catch (err) {
          return send(res, 502, {
            success: false,
            error: err instanceof Error ? err.message : "MyFatoorah error",
          });
        }
      });
    },
  };
}
