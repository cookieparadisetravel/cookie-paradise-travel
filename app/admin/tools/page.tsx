import { CalendarDays, CreditCard, ExternalLink, Mail, Search } from "lucide-react";
import { MetaSyncPanel } from "../inquiries/meta-sync-panel";
export const metadata={title:"Tools & integrations | Cookie Paradise Travel",robots:{index:false,follow:false}};
export default function ToolsPage(){return <main className="ws-page"><div className="ws-heading"><div><p className="ws-eyebrow">BEHIND THE SCENES</p><h1>Tools & integrations.</h1><p className="ws-muted">Keep your systems connected and your daily work clear.</p></div></div><div className="ws-tools-grid">{[
  {title:"Reminder tests",description:"Check calendar access and preview reminder emails.",href:"/admin/reminder-tests",icon:CalendarDays},
  {title:"Payments & invoices",description:"Review each traveler’s payment status inside their inquiry.",href:"/admin/inquiries",icon:CreditCard},
  {title:"Prospect discovery",description:"Manage search settings and review discovered travel conversations.",href:"/admin/prospects",icon:Search},
  {title:"Welcome credits",description:"Find customer credits and review their redemption history.",href:"/admin/welcome-credits",icon:Mail}
].map(tool=><a className="ws-tool-card" href={tool.href} key={tool.href}><tool.icon/><h2>{tool.title}</h2><p>{tool.description}</p><span>Open <ExternalLink size={13}/></span></a>)}</div><div className="ws-tools-sync"><MetaSyncPanel/></div></main>;}
