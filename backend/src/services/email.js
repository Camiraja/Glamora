import "dotenv/config";
import { Resend } from "resend";

const emailProviders = new Map();
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const developmentSender = "Glamora <onboarding@resend.dev>";

if (resendClient) {
  registerEmailProvider("resend", async ({ from, to, subject, text }) => {
    const { data, error } = await resendClient.emails.send({ from, to, subject, text });
    if (error) throw new Error(error.message || "Resend could not deliver the email.");
    return data;
  });
}

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super("Email delivery is not configured.");
    this.name = "EmailDeliveryUnavailableError";
  }
}

export function registerEmailProvider(name, send) {
  if (!name || typeof send !== "function") {
    throw new TypeError("An email provider name and send function are required.");
  }
  emailProviders.set(name, send);
}

export function isEmailDeliveryConfigured() {
  const provider = process.env.EMAIL_PROVIDER || (resendClient ? "resend" : "");
  const from = process.env.EMAIL_FROM || (process.env.NODE_ENV === "production" ? "" : developmentSender);
  return Boolean(from && emailProviders.has(provider));
}

export async function sendEmail({ to, subject, text }) {
  const provider = process.env.EMAIL_PROVIDER || (resendClient ? "resend" : "");
  const from = process.env.EMAIL_FROM || (process.env.NODE_ENV === "production" ? "" : developmentSender);
  const send = emailProviders.get(provider);
  if (!from || !send) {
    throw new EmailDeliveryUnavailableError();
  }
  return send({ from, to, subject, text });
}