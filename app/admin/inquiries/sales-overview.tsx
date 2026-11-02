"use client";
import type { SalesProcess } from "@/lib/inquiry-sales-types";
import { indianaDate, nextSalesAction, salesFunnel } from "@/lib/inquiry-sales-types";
const href=(sale:SalesProcess)=>sale.bookingId ? `/admin/inquiries/${sale.bookingId}?section=overview` : `/admin/inquiries/guide/${sale.guideId}`;
const dateLabel=(day:string)=>new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US",{timeZone:"America/Indiana/Indianapolis",month:"short",day:"numeric",year:"numeric"});
export function SalesOverview({processes}:{processes:SalesProcess[]}) {
  const today=indianaDate();
  const funnel=salesFunnel(processes);
  const priority=(entry:{sale:SalesProcess;action:ReturnType<typeof nextSalesAction>})=>entry.action?.due ? 0 : entry.sale.stage==="new" ? 1 : entry.sale.consultationBookedAt && !entry.sale.consultationCompletedAt ? 2 : entry.action?.date ? 3 : 4;
  const actions=processes.filter(sale=>sale.squareEnvironment==="production").map(sale=>({sale,action:nextSalesAction(sale,today)})).filter(entry=>entry.action)
    .sort((a,b)=>priority(a)-priority(b) || (a.action?.date || "9999").localeCompare(b.action?.date || "9999") || a.sale.createdAt.localeCompare(b.sale.createdAt));
  return <section className="mb-6 space-y-4" aria-label="Sales process overview">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Guide requests",funnel.guides],["Consultations booked",funnel.calls],["Bookings started",funnel.started],["Reserved",funnel.reserved]].map(([label,value])=><div className="rounded-2xl border border-[var(--line)] bg-white p-4" key={String(label)}><p className="text-sm font-semibold">{label}</p><p className="mt-2 font-serif text-3xl font-bold">{value}</p></div>)}</div>
    <p className="text-xs leading-5">Conversion counts follow guide requests through their linked consultation and booking records. Stages can be skipped when a customer is already ready to book.</p>
    <details className="rounded-2xl border border-[var(--line)] bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Guide conversions by source</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Source","Guides","Calls booked","Bookings started","Reserved"].map(label=><th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{funnel.sources.map(source=><tr className="border-t border-[var(--line)]" key={source.source}><td className="px-3 py-2">{source.source}</td><td className="px-3 py-2">{source.guides}</td><td className="px-3 py-2">{source.calls}</td><td className="px-3 py-2">{source.started}</td><td className="px-3 py-2">{source.reserved}</td></tr>)}</tbody></table></div></details>
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-2xl font-bold">Next sales actions</h2><span className="text-sm">{actions.filter(entry=>entry.action?.due).length} due · Indiana dates</span></div>
      {actions.length ? <ul className="mt-4 divide-y divide-[var(--line)]">{actions.slice(0,8).map(({sale,action})=><li key={sale.id}><a className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3 focus-visible:outline-2 focus-visible:outline-offset-4" href={href(sale)}><span><span className="block font-bold">{sale.name}</span><span className="text-sm">{action?.label}</span></span><span className={`text-sm font-semibold ${action?.due ? "text-red-800" : ""}`}>{action?.date ? `${action.due ? "Due: " : ""}${dateLabel(action.date)}` : "Review inquiry"} →</span></a></li>)}</ul> : <p className="mt-3 text-sm">No open sales follow-ups.</p>}
      {actions.length>8 && <p className="mt-3 text-sm">Showing the first 8 of {actions.length} open actions. All inquiries remain in the list below.</p>}
    </div>
  </section>;
}
