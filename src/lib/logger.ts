/**
 * Structured logger
 * Stack contract: observability.logging=pino
 *                 NFR-013: No PII (customer names, mobiles, addresses) in logs
 */

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // PII redaction: paths matching these patterns are replaced with [Redacted]
  redact: {
    paths: [
      "phone",
      "customer_mobile",
      "customer_name",
      "customer_email",
      "address",
      "*.phone",
      "*.customer_mobile",
      "*.customer_name",
      "*.customer_email",
      "*.address",
    ],
    censor: "[Redacted]",
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});
