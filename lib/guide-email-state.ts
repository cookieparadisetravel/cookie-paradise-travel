import type { GuideLeadRow } from './lead-inbox';

export type GuideEmailBucket = 'needs_guide' | 'guide_sent' | 'guide_review' | 'guide_inactive';
export function guideEmailState(lead: GuideLeadRow): { bucket: GuideEmailBucket; label: string; detail: string; action: string; tone: string } {
  const status = lead.renewed_at ? lead.renewed_email_status ?? 'pending' : lead.guide_email_status;
  if (lead.manual_guide_sent_at || status === 'sent') return { bucket: 'guide_sent', label: 'Guide sent', detail: lead.manual_guide_sent_at ? 'Manually recorded by owner' : 'Send recorded · delivery not verified', action: 'View guide history', tone: 'bg-emerald-100 text-emerald-900' };
  if (lead.status === 'closed' || lead.contact_permission === 0 || status === 'not_consented') return { bucket: 'guide_inactive', label: 'No email action', detail: lead.status === 'closed' ? 'Inquiry closed' : 'Contact permission declined', action: 'View request', tone: 'bg-slate-100 text-slate-700' };
  if (lead.contact_permission !== 1) return { bucket: 'guide_review', label: 'Check permission', detail: 'Review the original request before emailing', action: 'Review permission', tone: 'bg-amber-100 text-amber-950' };
  if (['failed', 'not_configured', 'sending'].includes(status)) return { bucket: 'guide_review', label: status === 'sending' ? 'Send in progress / unconfirmed' : 'Email needs review', detail: 'Check email activity before resending', action: 'Review email status', tone: 'bg-amber-100 text-amber-950' };
  if (['pending', 'manual_follow_up'].includes(status)) return { bucket: 'needs_guide', label: 'No guide send recorded', detail: 'Check your sent folder; send or record an earlier email', action: 'Review & record guide', tone: 'bg-orange-100 text-orange-950' };
  return { bucket: 'guide_review', label: 'Check email status', detail: 'No confirmed send record for this request', action: 'Review request', tone: 'bg-amber-100 text-amber-950' };
}
