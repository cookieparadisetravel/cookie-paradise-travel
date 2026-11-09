import { mapMetaLead } from "./meta-leads.ts";

export type MetaRecoveryConfig = {
  token: string; version: string; formIds: string[]; consentField: string; timingField?: string;
};
export type MetaRecoveryResult = {
  checked: number; added: number; existing: number; failed: number; errors: string[];
};

// Only fixed, actionable messages leave this module. Graph errors and pagination URLs
// can contain credentials or submitted answers and must never reach logs or the UI.
export async function recoverMetaLeads(config: MetaRecoveryConfig, save: (input: ReturnType<typeof mapMetaLead>) => Promise<{ created: boolean }>, request: typeof fetch = fetch): Promise<MetaRecoveryResult> {
  const result: MetaRecoveryResult = { checked: 0, added: 0, existing: 0, failed: 0, errors: [] };
  const error = (message: string) => { if (!result.errors.includes(message)) result.errors.push(message); };
  for (const formId of config.formIds) {
    let after = "";
    const cursors = new Set<string>();
    for (let page = 0; page < 10; page++) {
      // Rebuild pagination on our fixed Graph origin; never follow paging.next,
      // which may embed a token or an unexpected destination.
      const url = new URL(`https://graph.facebook.com/${config.version}/${formId}/leads`);
      url.searchParams.set("fields", "id,created_time,ad_id,form_id,field_data");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      let body: { data?: unknown[]; error?: { code?: number }; paging?: { next?: string; cursors?: { after?: string } } };
      try {
        const response = await request(url, { headers: { Authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(10_000) });
        body = await response.json();
        if (!response.ok || body.error) {
          const code = body.error?.code;
          error(code === 190 ? "Facebook access token expired or was revoked. Reconnect the Page token in Cloudflare."
            : code === 10 || code === 200 ? "Facebook denied lead access. Check the app's leads_retrieval permission and Page Leads Access assignment."
            : "Facebook could not return this form's leads. Check the approved form IDs, Page access, and app live mode, then retry.");
          break;
        }
        if (!Array.isArray(body.data)) throw new Error("Invalid response");
      } catch {
        error("Facebook lead retrieval did not complete. Please retry; saved leads will not be duplicated.");
        break;
      }
      for (const raw of body.data) {
        result.checked++;
        let input: ReturnType<typeof mapMetaLead>;
        try {
          const id = (raw as { id?: unknown } | null)?.id;
          if (typeof id !== "string") throw new Error("Missing ID");
          input = mapMetaLead(raw, { id, formId, consentField: config.consentField, timingField: config.timingField });
        } catch {
          result.failed++;
          error("Some leads could not be read. Check the contact-permission field name and required name/email answers on the Facebook form.");
          continue;
        }
        try {
          const saved = await save(input);
          if (saved.created) result.added++; else result.existing++;
        } catch {
          result.failed++;
          error("Some leads could not be saved to the dashboard. Retry the sync; already saved leads will not be duplicated.");
        }
      }
      if (!body.paging?.next) break;
      const cursor = body.paging.cursors?.after;
      if (!cursor || cursor.length > 4096 || cursors.has(cursor) || page === 9) {
        error("The form has more results than this recovery check could read. Further recovery is needed.");
        break;
      }
      cursors.add(cursor);
      after = cursor;
    }
  }
  return result;
}
