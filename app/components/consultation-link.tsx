import { ArrowRight } from "lucide-react";
import { consultationBookingUrl } from "@/lib/consultation";

export function ConsultationLink({ compact = false, inverse = false, className = "" }: { compact?: boolean; inverse?: boolean; className?: string }) {
  const colors = inverse ? "bg-[var(--navy)] text-white hover:bg-[#593412]" : "bg-[var(--gold)] text-[#38281e] hover:bg-[#ffc56c]";
  return <a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer"
    aria-label="Book a free 30-minute Vietnam trip call with Trung on Google Meet"
    className={"inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-center text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] " + colors + " " + className}>
    {compact ? "Book a free call" : "Book a free Vietnam trip call"}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
  </a>;
}
