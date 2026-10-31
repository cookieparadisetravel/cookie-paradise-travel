import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "@/lib/trip-guide-storage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reminder preferences | Cookie Paradise Travel", robots: { index: false, follow: false } };
export default async function StopGuideReminders({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  await ensureTripGuideStorage();
  const lead = await env.DB!.prepare("SELECT status FROM trip_guide_leads WHERE stop_token=?").bind(token).first<{ status: string }>();
  if (!lead) notFound();
  const stopped = lead.status === "closed" || (await searchParams).saved === "1";
  return <main className="mx-auto max-w-xl px-5 py-20 text-[var(--ink)]"><h1 className="font-serif text-4xl">{stopped ? "Your reminders are stopped" : "Stop consultation reminders?"}</h1><p className="my-6 leading-7">{stopped ? "You will no longer receive automatic consultation reminders for this guide request. This does not change any separate booking or newsletter subscription." : "Confirm below to stop the automatic consultation reminders for your trip guide request. Opening this page alone changes nothing."}</p>{!stopped && <form action="/api/trip-guide/stop" method="post"><input name="token" type="hidden" value={token} /><button className="rounded-full bg-[var(--navy)] px-6 py-3 font-semibold text-white">Stop reminders</button></form>}<a className="mt-8 inline-block underline" href="/vietnam">Back to the trip</a></main>;
}
