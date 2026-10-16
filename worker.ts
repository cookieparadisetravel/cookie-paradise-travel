import handler from "vinext/server/fetch-handler";
import { sendDueAgreementReminders } from "./lib/agreement-reminders";
import { sendDueInquiryReminders } from "./lib/inquiry-reminders";

const worker = {
  ...handler,
  async scheduled() {
    const jobs = [sendDueAgreementReminders(), sendDueInquiryReminders()];
    const results = await Promise.allSettled(jobs);
    for (const [index, result] of results.entries()) {
      const job = index === 0 ? "Agreement reminders" : "Inquiry reminders";
      if (result.status === "fulfilled") console.log(job, result.value);
      else console.error(`${job} failed; check configuration and service availability.`);
    }
  },
};

export default worker;
