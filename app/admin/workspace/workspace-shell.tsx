"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Compass, ExternalLink, Focus, Gift, ImageIcon, Inbox, LayoutDashboard, Leaf, LogOut, Menu, Search, Settings2, Users, X } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "./inspiration";
import type { WorkspacePhoto } from "./content";

const links=[{href:"/admin/today",label:"Today",icon:LayoutDashboard},{href:"/admin/inquiries",label:"Inquiries",icon:Inbox},{href:"/admin/referrals",label:"Partnerships",icon:Users},{href:"/admin/prospects",label:"Web prospects",icon:Compass},{href:"/admin/welcome-credits",label:"Welcome credits",icon:Gift},{href:"/admin/inspiration",label:"Inspiration",icon:ImageIcon},{href:"/admin/tools",label:"Tools & integrations",icon:Settings2}];
export function WorkspaceShell({children,photos}:{children:ReactNode;photos:WorkspacePhoto[]}){return <div className="owner-workspace"><WorkspaceProvider initialPhotos={photos}><Shell>{children}</Shell></WorkspaceProvider></div>;}
function Shell({children}:{children:ReactNode}){
  const pathname=usePathname(),{focus,toggleFocus}=useWorkspace(),[open,setOpen]=useState(false),menuButton=useRef<HTMLButtonElement>(null),sidebar=useRef<HTMLElement>(null);
  const current=links.find(link=>link.href==="/admin/today"?pathname==="/admin"||pathname==="/admin/"||pathname==="/admin/today":pathname===link.href||pathname.startsWith(link.href+"/"))??links[6];
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{const desktop=window.matchMedia("(min-width: 761px)");const close=()=>{if(desktop.matches)setOpen(false);};desktop.addEventListener("change",close);return()=>desktop.removeEventListener("change",close);},[]);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";sidebar.current?.querySelector<HTMLElement>("a")?.focus();function key(event:KeyboardEvent){if(event.key==="Escape"){setOpen(false);menuButton.current?.focus();}if(event.key==="Tab"){const targets=sidebar.current?.querySelectorAll<HTMLElement>('a[href],button');if(!targets?.length)return;const first=targets[0],last=targets[targets.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}document.addEventListener("keydown",key);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",key);};},[open]);
  return <div className={focus&&pathname!=="/admin/inspiration"?"ws-frame ws-focus-mode":"ws-frame"}>
    <a className="ws-skip" href="#workspace-content">Skip to workspace</a>
    {open&&<button type="button" className="ws-menu-backdrop" aria-label="Close navigation" onClick={()=>{setOpen(false);menuButton.current?.focus();}}/>}
    <aside ref={sidebar} className={`ws-sidebar ${open?"is-open":""}`} id="workspace-navigation" aria-label="Workspace navigation">
      <a className="ws-brand" href="/admin/today"><span className="ws-brand-mark">cp<small>✦</small></span><span>Cookie Paradise<small>TRAVEL COMPANY</small></span></a>
      <div className="ws-owner-label"><i/> Trung’s workspace</div><p className="ws-nav-label">YOUR DAY</p>
      <nav>{links.map((link,index)=><div key={link.href}>{index===5&&<><div className="ws-nav-divider"/><p className="ws-nav-label">YOUR SPACE</p></>}<a href={link.href} className={`ws-nav-link ${current.href===link.href?"active":""}`} aria-current={current.href===link.href?"page":undefined}><link.icon size={18}/>{link.label}</a></div>)}</nav>
      <div className="ws-sidebar-bottom"><a className="ws-nav-link" href="https://cookieparadisetravel.com" target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Open website</a><a className="ws-nav-link" href="/cdn-cgi/access/logout"><LogOut size={17}/> Sign out</a><div className="ws-profile"><span>TL</span><div><strong>Trung Le</strong><small>Founder & trip host</small></div><Leaf size={17}/></div></div>
      <button className="ws-mobile-close ws-icon" type="button" aria-label="Close navigation" onClick={()=>{setOpen(false);menuButton.current?.focus();}}><X/></button>
    </aside>
    <div className="ws-app"><header className="ws-topbar"><div className="ws-breadcrumb"><button ref={menuButton} className="ws-menu-toggle ws-icon" type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation" onClick={()=>setOpen(!open)}><Menu/></button><span>Workspace</span><span className="ws-slash">/</span><strong>{current.label}</strong></div><div className="ws-top-actions"><a className="ws-icon" href="/admin/inquiries#inquiry-search" aria-label="Search inquiries"><Search/></a><button className="ws-focus-button" type="button" aria-label="Focus mode" aria-pressed={focus} onClick={toggleFocus}><Focus size={16}/><span>Focus mode</span></button></div></header><div id="workspace-content" tabIndex={-1} className="ws-content">{children}</div><footer className="ws-footer"><span>Made for the work that matters.</span><a href="/admin/inspiration">Your inspiration <Leaf size={12}/></a></footer></div>
  </div>;
}
