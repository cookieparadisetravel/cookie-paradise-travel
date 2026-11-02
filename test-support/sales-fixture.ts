import { loadModule } from "./lead-fixture.ts";
import * as salesTypes from "../lib/inquiry-sales-types.ts";
import * as notes from "../lib/inquiry-notes.ts";
import * as consultation from "../lib/consultation.ts";

export async function loadSalesModules(runtime:Record<string,unknown>,history:Record<string,unknown>,send: (input:Record<string,unknown>)=>Promise<{sentAt:string;messageId:string|null}> = async()=>({sentAt:new Date().toISOString(),messageId:"test"})) {
  const storage=await loadModule<typeof import("../lib/inquiry-sales-storage")>("lib/inquiry-sales-storage.ts",{"cloudflare:workers":{env:runtime},"./followup-history":history});
  const sales=await loadModule<typeof import("../lib/inquiry-sales")>("lib/inquiry-sales.ts",{
    "cloudflare:workers":{env:runtime},"./inquiry-sales-storage":storage,"./followup-history":history,
    "./inquiry-sales-types":salesTypes,"./inquiry-notes":notes,"./inquiry-reminder-storage":{ensureInquiryReminderStorage:async()=>{}},
  });
  const invitations=await loadModule<typeof import("../lib/inquiry-booking-invitations")>("lib/inquiry-booking-invitations.ts",{
    "cloudflare:workers":{env:runtime},"./inquiry-sales-storage":storage,"./inquiry-sales":sales,
    "./mailersend-transactional":{sendTripGuideEmailMessage:send},"./consultation":consultation,
  });
  return {sales,salesStorage:storage,invitations};
}
