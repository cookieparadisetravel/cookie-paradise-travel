import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadLeadInbox } from "@/lib/lead-inbox";
import { loadSalesProcesses } from "@/lib/inquiry-sales";
import { workspaceOverview } from "@/lib/admin-overview";
import { loadInquiryDashboardData } from "./inquiries/dashboard-data";
import { TodayView } from "./workspace/today-view";
export const dynamic="force-dynamic";
export const metadata={title:"Today | Cookie Paradise Travel",robots:{index:false,follow:false}};
export default async function TodayPage(){
  if(!await requireOwner("/admin"))notFound();
  const [{inquiries},{leads},sales]=await Promise.all([loadInquiryDashboardData(),loadLeadInbox(null),loadSalesProcesses()]);
  const {metrics,actions,guideReview}=workspaceOverview(inquiries,leads,sales);
  const date=new Intl.DateTimeFormat("en-US",{timeZone:"America/Indiana/Indianapolis",weekday:"long",month:"long",day:"numeric"}).format(new Date());
  return <TodayView overview={{metrics,actions,guideReview}} date={date}/>;
}
