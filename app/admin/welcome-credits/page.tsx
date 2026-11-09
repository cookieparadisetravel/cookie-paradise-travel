import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { listCredits } from "@/lib/welcome-credit-service";
import { CreditsClient } from "./credits-client";
export const dynamic="force-dynamic";
export const metadata={title:"Welcome credits | Cookie Paradise Travel",robots:{index:false,follow:false}};
export default async function CreditsPage({searchParams}:{searchParams:Promise<{q?:string}>}){
  if(!await requireOwner("/admin/welcome-credits"))notFound();
  const {q}=await searchParams;
  return <CreditsClient credits={await listCredits(q)} query={q||""}/>;
}
