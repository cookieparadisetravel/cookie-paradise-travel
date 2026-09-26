"use client";

import { useEffect } from "react";

type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ToolRegistration, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

export function WebMcpTools() {
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const execute = async (input: unknown) => {
      const response = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: "Unable to save request." }));
        throw new Error(result.error ?? "Unable to save request.");
      }
      return { status: "received", paymentCollected: false, reservationConfirmed: false };
    };

    const registration = context.registerTool({
      name: "submit_vietnam_trip_request",
      title: "Request a Vietnam trip place",
      description: "Submit a non-binding interest request for one Vietnam 2027 departure. This does not collect payment or confirm a reservation.",
      inputSchema: {
        type: "object",
        properties: {
          fullName: { type: "string", minLength: 1, maxLength: 120 },
          email: { type: "string", format: "email", maxLength: 180 },
          phone: { type: "string", maxLength: 40 },
          departure: { type: "string", enum: ["2027-06-01", "2027-06-29", "2027-07-27", "flexible"] },
          room: { type: "string", enum: ["shared", "private", "unsure"] },
          partySize: { type: "integer", minimum: 1, maximum: 6 },
          notes: { type: "string", maxLength: 1000 },
        },
        required: ["fullName", "email", "departure", "room", "partySize"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute,
    }, { signal: lifecycle.signal });

    void Promise.resolve(registration).catch((error) => console.warn("Trip request tool unavailable", error));
    return () => lifecycle.abort();
  }, []);

  return null;
}
