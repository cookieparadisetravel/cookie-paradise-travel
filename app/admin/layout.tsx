import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { listWorkspacePhotos } from "@/lib/workspace-media";
import { WorkspaceShell } from "./workspace/workspace-shell";
import "./workspace/workspace.css";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){
  if(!await requireOwner("/admin"))notFound();
  const photos=await listWorkspacePhotos().catch(()=>[]);
  return <><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Be+Vietnam+Pro:wght@400;500;600&display=swap"/><WorkspaceShell photos={photos}>{children}</WorkspaceShell></>;
}
