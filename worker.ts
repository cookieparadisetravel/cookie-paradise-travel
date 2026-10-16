import handler from "vinext/server/fetch-handler";
import { sendDueAgreementReminders } from "./lib/agreement-reminders";

const worker = {
  ...handler,
  async scheduled() {
    const result = await sendDueAgreementReminders();
    console.log("Agreement reminder run completed", result);
  },
};

export default worker;
