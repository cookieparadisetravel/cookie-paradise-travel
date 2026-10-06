"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  Inbox,
  ListFilter,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";
import { DepositInvoiceAction } from "./deposit-invoice-action";
import { PaymentPreferenceInvitationAction } from "./payment-preference-invitation-action";
import { StatusSelect } from "./status-select";
import { TravelerAgreementManager } from "./traveler-agreement-manager";
import { TravelerListInvitationAction } from "./traveler-list-invitation-action";
import type { DashboardInquiry, GeneratedInvitationDraft, PaymentPreferenceGeneratedDraft, SquareMode } from "./dashboard-types";
import { isPaymentPreferenceDraftUsable } from "./payment-preference-state";
import { getSquareInvoiceStatusPresentation } from "./square-invoice-status";
import {
  inquiryStageLabel,
  inquiryStageMatchesFilter,
  inquiryStageOptions,
  isActiveInquiryStage,
  normalizeInquiryStage,
} from "@/lib/inquiry-stage";

type Props = {
  inquiries: DashboardInquiry[];
  acceptanceDate: string;
  initialDetailSection?: DetailSection;
  initialInquiryId?: number;
  ownerEmail: string;
  squareMode: SquareMode;
};

type MainTab = "active" | "all" | "waitlist" | "closed";
type AttentionFilter = "new" | "missing_travelers" | "agreements" | "invoice_issues" | null;
type DetailSection = "overview" | "travelers" | "payments" | "activity";
type SortOption = "attention" | "newest" | "oldest" | "departure" | "name";
type ChecklistState = "complete" | "pending" | "error";

type ChecklistItem = {
  label: string;
  detail: string;
  state: ChecklistState;
  section: DetailSection;
};

const generatedLinkCacheKey = "cookie-paradise-admin-generated-links-v1";
const dashboardListStateKey = "cookie-paradise-admin-inquiry-list-state-v1";

type DashboardListState = {
  mainTab: MainTab;
  attentionFilter: AttentionFilter;
  search: string;
  stage: string;
  departure: string;
  sort: SortOption;
  scrollY: number;
  focusedInquiryId: number;
};

type GeneratedLinkCache = {
  travelerLists: Record<number, GeneratedInvitationDraft>;
  paymentChoices: Record<number, PaymentPreferenceGeneratedDraft>;
};

const departureLabels: Record<string, string> = {
  "2027-06-01": "Jun 1, 2027",
  "2027-06-29": "Jun 29, 2027",
  "2027-07-27": "Jul 27, 2027",
  flexible: "Flexible",
};

const stateLabels: Record<string, string> = {
  CA: "California",
  FL: "Florida",
  HI: "Hawaii",
  MD: "Maryland",
  WA: "Washington",
};

export function InquiryDashboardClient({ inquiries, acceptanceDate, initialDetailSection, initialInquiryId, ownerEmail, squareMode }: Props) {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>("active");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [departure, setDeparture] = useState("all");
  const [sort, setSort] = useState<SortOption>("attention");
  const [listStateToRestore, setListStateToRestore] = useState<DashboardListState | null>(null);
  const selectedInquiryId = initialInquiryId ?? null;
  const [detailSection, setDetailSection] = useState<DetailSection>(() => initialDetailSection
    ?? (initialInquiryId && inquiries[0] ? workflowFor(inquiries[0]).section : "overview"));
  const [refreshing, setRefreshing] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLinkCache>(readGeneratedLinkCache);
  const detailBackButton = useRef<HTMLButtonElement>(null);
  const loadedListState = useRef(false);
  const restoredListPosition = useRef(false);

  const selectedInquiry = inquiries.find((inquiry) => inquiry.id === selectedInquiryId) ?? null;
  const validatedGeneratedLinks = useMemo<GeneratedLinkCache>(() => ({
    travelerLists: generatedLinks.travelerLists,
    paymentChoices: Object.fromEntries(Object.entries(generatedLinks.paymentChoices).filter(([rawInquiryId, draft]) => {
      const inquiry = inquiries.find((item) => item.id === Number(rawInquiryId));
      return inquiry ? isPaymentPreferenceDraftUsable(draft, inquiry.latestPaymentChoiceInvitation) : false;
    })),
  }), [generatedLinks, inquiries]);

  useEffect(() => {
    window.sessionStorage.setItem(generatedLinkCacheKey, JSON.stringify(validatedGeneratedLinks));
  }, [validatedGeneratedLinks]);

  useEffect(() => {
    if (selectedInquiryId !== null) {
      window.scrollTo({ top: 0, behavior: "auto" });
      detailBackButton.current?.focus();
    }
  }, [selectedInquiryId]);

  useEffect(() => {
    if (selectedInquiryId !== null || loadedListState.current) return;
    loadedListState.current = true;
    const savedState = readDashboardListState();
    if (!savedState) return;
    const frame = window.requestAnimationFrame(() => {
      setMainTab(savedState.mainTab);
      setAttentionFilter(savedState.attentionFilter);
      setSearch(savedState.search);
      setStage(savedState.stage);
      setDeparture(savedState.departure);
      setSort(savedState.sort);
      setListStateToRestore(savedState);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedInquiryId]);

  useEffect(() => {
    if (selectedInquiryId !== null || restoredListPosition.current || !listStateToRestore) return;
    restoredListPosition.current = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: listStateToRestore.scrollY, behavior: "auto" });
        document.getElementById(`inquiry-row-${listStateToRestore.focusedInquiryId}`)?.focus({ preventScroll: true });
      });
    });
  }, [listStateToRestore, selectedInquiryId]);
  const activeInquiries = inquiries.filter((inquiry) => isActiveInquiryStage(inquiry.status));
  const attentionCounts = {
    new: activeInquiries.filter((inquiry) => inquiry.status === "new").length,
    missing_travelers: activeInquiries.filter(hasMissingTravelerDetails).length,
    agreements: activeInquiries.filter(hasIncompleteAgreements).length,
    invoice_issues: activeInquiries.filter(hasInvoiceIssue).length,
  };

  const tabCounts = {
    active: activeInquiries.length,
    all: inquiries.length,
    waitlist: inquiries.filter((inquiry) => inquiry.status === "waitlist").length,
    closed: inquiries.filter((inquiry) => inquiry.status === "closed").length,
  };

  const departures = Array.from(new Set(inquiries.map((inquiry) => inquiry.departure)))
    .sort((a, b) => departureSortValue(a) - departureSortValue(b));

  const visibleInquiries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = inquiries.filter((inquiry) => {
      if (mainTab === "active" && !isActiveInquiryStage(inquiry.status)) return false;
      if (mainTab === "waitlist" && inquiry.status !== "waitlist") return false;
      if (mainTab === "closed" && inquiry.status !== "closed") return false;
      if (stage !== "all" && !inquiryStageMatchesFilter(inquiry.status, stage)) return false;
      if (departure !== "all" && inquiry.departure !== departure) return false;
      if (attentionFilter === "new" && inquiry.status !== "new") return false;
      if (attentionFilter === "missing_travelers" && !hasMissingTravelerDetails(inquiry)) return false;
      if (attentionFilter === "agreements" && !hasIncompleteAgreements(inquiry)) return false;
      if (attentionFilter === "invoice_issues" && !hasInvoiceIssue(inquiry)) return false;
      if (!normalizedSearch) return true;
      return [inquiry.fullName, inquiry.email, inquiry.phone, String(inquiry.id)]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });

    return [...filtered].sort((a, b) => compareInquiries(a, b, sort));
  }, [attentionFilter, departure, inquiries, mainTab, search, sort, stage]);

  function selectAttention(next: Exclude<AttentionFilter, null>) {
    setMainTab("active");
    setStage("all");
    setAttentionFilter((current) => current === next ? null : next);
  }

  function openInquiry(inquiry: DashboardInquiry, section?: DetailSection) {
    const nextSection = section ?? workflowFor(inquiry).section;
    const listState: DashboardListState = {
      mainTab,
      attentionFilter,
      search,
      stage,
      departure,
      sort,
      scrollY: window.scrollY,
      focusedInquiryId: inquiry.id,
    };
    window.sessionStorage.setItem(dashboardListStateKey, JSON.stringify(listState));
    router.push(`/admin/inquiries/${inquiry.id}?section=${nextSection}`);
  }

  function closeInquiry() {
    const listState = readDashboardListState();
    if (listState?.focusedInquiryId === selectedInquiryId) {
      router.back();
      return;
    }
    router.push("/admin/inquiries");
  }

  function changeDetailSection(section: DetailSection) {
    setDetailSection(section);
    if (selectedInquiryId !== null) {
      router.replace(`/admin/inquiries/${selectedInquiryId}?section=${section}`, { scroll: false });
    }
  }

  function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 700);
  }

  return (
    <main className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-7">
          <div className="flex items-center gap-4">
            <div className="hidden rounded-xl bg-[var(--gold)] px-3 py-2 font-black text-[var(--ink)] sm:block">Cookie Paradise</div>
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-[var(--orange)]">Owner dashboard</p>
              <h1 className="font-serif text-2xl font-bold sm:text-3xl">{selectedInquiry ? "Inquiry details" : "Inquiries"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden rounded-full px-3 py-1 text-xs font-extrabold sm:inline-flex ${squareMode === "sandbox" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
              Square {squareMode === "sandbox" ? "Sandbox" : "Production"}
            </span>
            <button aria-label="Refresh inquiries" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--line)] px-3 text-sm font-bold hover:bg-[var(--cream)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40" onClick={refresh} type="button">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
            </button>
            <a aria-label="Sign out of owner dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--navy)] px-3 text-sm font-bold text-white hover:bg-[var(--ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/50" href="/cdn-cgi/access/logout">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </a>
          </div>
        </div>
      </header>

      {selectedInquiry ? (
        <InquiryDetail
          acceptanceDate={acceptanceDate}
          backButtonRef={detailBackButton}
          inquiry={selectedInquiry}
          onClose={closeInquiry}
          onSectionChange={changeDetailSection}
          paymentChoiceDraft={validatedGeneratedLinks.paymentChoices[selectedInquiry.id]}
          onPaymentChoiceDraftChange={(draft) => setGeneratedLinks((current) => ({ ...current, paymentChoices: { ...current.paymentChoices, [selectedInquiry.id]: draft } }))}
          section={detailSection}
          squareMode={squareMode}
          travelerListDraft={selectedInquiry.latestTravelerListCompletedAt ? undefined : generatedLinks.travelerLists[selectedInquiry.id]}
          onTravelerListDraftChange={(draft) => setGeneratedLinks((current) => ({ ...current, travelerLists: { ...current.travelerLists, [selectedInquiry.id]: draft } }))}
        />
      ) : (
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">Who needs attention?</h2>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">Attention counts overlap and are not a total.</p>
          </div>
          <p className="text-xs font-semibold text-[var(--muted-ink)]">Signed in as {ownerEmail}</p>
        </div>

        <section aria-label="Attention filters" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionCard active={attentionFilter === "new"} count={attentionCounts.new} icon={Inbox} label="New inquiries" onClick={() => selectAttention("new")} />
          <AttentionCard active={attentionFilter === "missing_travelers"} count={attentionCounts.missing_travelers} icon={UserRoundSearch} label="Missing traveler details" onClick={() => selectAttention("missing_travelers")} />
          <AttentionCard active={attentionFilter === "agreements"} count={attentionCounts.agreements} icon={FileSignature} label="Agreements incomplete" onClick={() => selectAttention("agreements")} />
          <AttentionCard active={attentionFilter === "invoice_issues"} count={attentionCounts.invoice_issues} icon={AlertCircle} label="Invoice issues" onClick={() => selectAttention("invoice_issues")} />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
          <div className="border-b border-[var(--line)] p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_190px_180px]">
              <label className="relative block">
                <span className="sr-only">Search inquiries</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-ink)]" />
                <input className="min-h-11 w-full rounded-xl border border-[var(--input)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--orange)] focus:ring-4 focus:ring-[var(--gold)]/25" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone or ID" type="search" value={search} />
              </label>
              <FilterSelect icon={ListFilter} label="Stage" onChange={setStage} value={stage}>
                <option value="all">All sales stages</option>
                {inquiryStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FilterSelect>
              <FilterSelect icon={CalendarDays} label="Departure" onChange={setDeparture} value={departure}>
                <option value="all">All departures</option>
                {departures.map((value) => <option key={value} value={value}>{departureLabel(value)}</option>)}
              </FilterSelect>
              <FilterSelect icon={ArrowUpDown} label="Sort" onChange={(value) => setSort(value as SortOption)} value={sort}>
                <option value="attention">Needs attention</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="departure">Departure date</option>
                <option value="name">Contact name</option>
              </FilterSelect>
            </div>
          </div>

          <nav aria-label="Inquiry groups" className="flex overflow-x-auto border-b border-[var(--line)] px-3 sm:px-5">
            {(["active", "all", "waitlist", "closed"] as const).map((tab) => (
              <button key={tab} className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-bold capitalize focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/30 ${mainTab === tab ? "border-[var(--gold)] text-[var(--ink)]" : "border-transparent text-[var(--muted-ink)] hover:text-[var(--ink)]"}`} onClick={() => { setMainTab(tab); setAttentionFilter(null); setStage("all"); }} type="button">
                {tab} ({tabCounts[tab]})
              </button>
            ))}
          </nav>

          {attentionFilter && (
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--gold)]/12 px-4 py-2 text-sm font-semibold">
              <span>Showing: {attentionFilterLabel(attentionFilter)}</span>
              <button className="rounded-full px-3 py-1 text-xs font-extrabold hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40" onClick={() => setAttentionFilter(null)} type="button">Clear</button>
            </div>
          )}

          <InquiryList inquiries={visibleInquiries} onOpen={openInquiry} squareMode={squareMode} />
        </section>
      </div>
      )}
    </main>
  );
}

function AttentionCard({ active, count, icon: Icon, label, onClick }: { active: boolean; count: number; icon: typeof Inbox; label: string; onClick: () => void }) {
  return (
    <button aria-pressed={active} className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40 ${active ? "border-[var(--gold)] bg-[var(--gold)]/15 shadow-sm" : "border-[var(--line)] bg-white hover:border-[var(--gold)]"}`} onClick={onClick} type="button">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--gold)]/25"><Icon className="h-5 w-5 text-[var(--ink)]" /></span>
      <span><span className="block text-sm font-semibold text-[var(--muted-ink)]">{label}</span><span className="mt-0.5 block font-serif text-3xl font-bold">{count}</span></span>
    </button>
  );
}

function FilterSelect({ children, icon: Icon, label, onChange, value }: { children: React.ReactNode; icon: typeof ListFilter; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-ink)]" />
      <select className="min-h-11 w-full appearance-none rounded-xl border border-[var(--input)] bg-white pl-10 pr-8 text-sm font-semibold outline-none focus:border-[var(--orange)] focus:ring-4 focus:ring-[var(--gold)]/25" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[var(--muted-ink)]" />
    </label>
  );
}

function InquiryList({ inquiries, onOpen, squareMode }: { inquiries: DashboardInquiry[]; onOpen: (inquiry: DashboardInquiry, section?: DetailSection) => void; squareMode: SquareMode }) {
  if (inquiries.length === 0) {
    return <div className="p-10 text-center"><ClipboardList className="mx-auto h-9 w-9 text-[var(--muted-ink)]" /><h3 className="mt-3 font-serif text-2xl font-bold">No matching inquiries</h3><p className="mt-1 text-sm text-[var(--muted-ink)]">Try a different tab or clear a filter.</p></div>;
  }

  return (
    <div>
      <div className="hidden grid-cols-[minmax(210px,1.35fr)_minmax(145px,.8fr)_130px_minmax(175px,1fr)_155px_minmax(190px,1fr)] gap-4 border-b border-[var(--line)] bg-[var(--cream)]/55 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.09em] text-[var(--muted-ink)] xl:grid">
        <span>Contact</span><span>Departure / party</span><span>Stage</span><span>Progress</span><span>Payment</span><span>Next step</span>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {inquiries.map((inquiry) => {
          const workflow = workflowFor(inquiry);
          const acceptedCount = acceptedAgreementCount(inquiry);
          return (
            <button id={`inquiry-row-${inquiry.id}`} key={inquiry.id} className="group grid w-full gap-3 px-4 py-4 text-left hover:bg-[var(--gold)]/8 focus-visible:bg-[var(--gold)]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--gold)]/45 sm:px-5 xl:grid-cols-[minmax(210px,1.35fr)_minmax(145px,.8fr)_130px_minmax(175px,1fr)_155px_minmax(190px,1fr)] xl:items-center xl:gap-4" onClick={() => onOpen(inquiry)} type="button">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="truncate font-bold text-[var(--ink)]">{inquiry.fullName}</span><span className="text-xs font-semibold text-[var(--muted-ink)]">#{inquiry.id}</span></div>
                <p className="truncate text-sm text-[var(--muted-ink)]">{inquiry.email}</p>
                {inquiry.sellerOfTravelStateResident && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[0.68rem] font-extrabold text-red-800"><ShieldAlert className="h-3 w-3" /> Review {inquiry.residenceState ?? "state"} residency</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 xl:block">
                <MobileLabel>Departure / party</MobileLabel>
                <div><p className="text-sm font-semibold">{departureLabel(inquiry.departure)}</p><p className="text-xs text-[var(--muted-ink)]">{inquiry.partySize} traveler{inquiry.partySize === 1 ? "" : "s"}</p></div>
              </div>
              <div className="grid grid-cols-2 items-center gap-3 xl:block"><MobileLabel>Stage</MobileLabel><StageBadge status={inquiry.status} /></div>
              <div className="grid grid-cols-2 gap-3 xl:block">
                <MobileLabel>Progress</MobileLabel>
                <div className="space-y-1.5 text-xs font-semibold"><ProgressLine state={inquiry.travelers.length === inquiry.partySize ? "complete" : inquiry.travelers.length > inquiry.partySize ? "error" : "pending"} label={`Travelers ${inquiry.travelers.length}/${inquiry.partySize}`} /><ProgressLine state={acceptedCount === inquiry.partySize && inquiry.agreementActive && inquiry.travelers.length === inquiry.partySize ? "complete" : acceptedCount > inquiry.partySize ? "error" : "pending"} label={`Agreements ${acceptedCount}/${inquiry.partySize}`} /></div>
              </div>
              <div className="grid grid-cols-2 items-center gap-3 xl:block"><MobileLabel>Payment</MobileLabel><PaymentBadge inquiry={inquiry} squareMode={squareMode} /></div>
              <div className="grid grid-cols-2 items-center gap-3 xl:flex xl:items-center xl:justify-between">
                <MobileLabel>Next step</MobileLabel>
                <span><span className={`inline-flex rounded-lg px-3 py-2 text-xs font-extrabold ${workflow.blocked ? "bg-amber-100 text-amber-950" : "bg-[var(--gold)] text-[var(--ink)]"}`}>{workflow.label}</span>{workflow.blocked && <span className="mt-1 block text-[0.68rem] text-[var(--muted-ink)]">Blocked</span>}</span>
                <ChevronRight className="hidden h-4 w-4 text-[var(--muted-ink)] transition group-hover:translate-x-0.5 xl:block" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InquiryDetail({ acceptanceDate, backButtonRef, inquiry, onClose, onPaymentChoiceDraftChange, onSectionChange, onTravelerListDraftChange, paymentChoiceDraft, section, squareMode, travelerListDraft }: { acceptanceDate: string; backButtonRef: React.RefObject<HTMLButtonElement | null>; inquiry: DashboardInquiry; onClose: () => void; onPaymentChoiceDraftChange: (draft: PaymentPreferenceGeneratedDraft) => void; onSectionChange: (section: DetailSection) => void; onTravelerListDraftChange: (draft: GeneratedInvitationDraft) => void; paymentChoiceDraft?: PaymentPreferenceGeneratedDraft; section: DetailSection; squareMode: SquareMode; travelerListDraft?: GeneratedInvitationDraft }) {
  const workflow = workflowFor(inquiry);
  const acceptedCount = acceptedAgreementCount(inquiry);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
      <button ref={backButtonRef} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-extrabold shadow-sm hover:bg-[var(--cream)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40" onClick={onClose} type="button">
        <ArrowLeft className="h-4 w-4" /> Back to inquiries
      </button>

      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <header className="px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(300px,1.2fr)] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--orange)]">Inquiry #{inquiry.id}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3 sm:gap-x-8">
                <h2 className="min-w-0 truncate font-serif text-3xl font-bold leading-tight">{inquiry.fullName}</h2>
                <StatusSelect compact key={`${inquiry.id}-${inquiry.status}`} id={inquiry.id} initialStatus={inquiry.status} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex rounded-full bg-[var(--cream)] px-3 py-1.5 font-bold">{departureLabel(inquiry.departure)}</span>
              <span className="inline-flex rounded-full bg-[var(--cream)] px-3 py-1.5 font-bold">{inquiry.partySize} traveler{inquiry.partySize === 1 ? "" : "s"}</span>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${workflow.blocked ? "border-amber-300 bg-amber-50" : "border-[var(--gold)] bg-[var(--gold)]/15"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Next action</p><p className="truncate text-sm font-bold">{workflow.label}</p></div>
                <button className="min-h-10 shrink-0 rounded-full border border-[#d99a3b] bg-[var(--gold)] px-3 py-2 text-xs font-extrabold text-[var(--ink)] shadow-sm hover:bg-[#ffc56c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/50" onClick={() => onSectionChange(workflow.section)} type="button">{workflow.actionLabel}</button>
              </div>
              {workflow.blocked && <p className="mt-1 text-xs font-semibold text-amber-900">Blocked: {workflow.detail}</p>}
            </div>
          </div>

          <InquiryProgressChecklist inquiry={inquiry} onSectionChange={onSectionChange} />

          <nav aria-label="Inquiry detail sections" className="mt-4 flex overflow-x-auto border-t border-[var(--line)]" role="tablist">
            {(["overview", "travelers", "payments", "activity"] as const).map((value) => (
              <button aria-controls={`inquiry-panel-${value}`} aria-selected={section === value} id={`inquiry-tab-${value}`} key={value} className={`min-h-12 whitespace-nowrap border-b-2 px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/30 sm:px-5 ${section === value ? "border-[var(--gold)] text-[var(--ink)]" : "border-transparent text-[var(--muted-ink)]"}`} onClick={() => onSectionChange(value)} role="tab" type="button">{detailSectionLabel(value)}</button>
            ))}
          </nav>
        </header>
      </section>

        <div aria-labelledby={`inquiry-tab-${section}`} className="mt-5" id={`inquiry-panel-${section}`} role="tabpanel" tabIndex={0}>
          {section === "overview" && <OverviewSection inquiry={inquiry} squareMode={squareMode} />}
          {section === "travelers" && (
            <div className="space-y-4">
              <SectionHeading description={`${inquiry.travelers.length} of ${inquiry.partySize} traveler records · ${acceptedCount} current agreements accepted`} title="Travelers & agreements" />
              <TravelerListInvitationAction inquiryId={inquiry.id} expectedPartySize={inquiry.partySize} currentTravelerCount={inquiry.travelers.length} initialGeneratedDraft={travelerListDraft} onGeneratedDraftChange={onTravelerListDraftChange} />
              <TravelerAgreementManager key={`agreements-${inquiry.id}-${inquiry.travelers.length}-${inquiry.acceptedTravelerIds.join("-")}-${Object.values(inquiry.agreementInvitationDeliveries).map((delivery) => delivery.sentAt).join("-")}`} inquiryId={inquiry.id} expectedPartySize={inquiry.partySize} initialTravelers={inquiry.travelers} agreementActive={inquiry.agreementActive} acceptedTravelerIds={inquiry.acceptedTravelerIds} initialInvitationDeliveries={inquiry.agreementInvitationDeliveries} paymentPreference={inquiry.paymentPreference} invoiceExists={Boolean(inquiry.squareDepositInvoiceId)} />
            </div>
          )}
          {section === "payments" && (
            <div className="space-y-4">
              <SectionHeading description={`Square ${squareMode === "sandbox" ? "Sandbox testing" : "production"}. A saved preference is not a payment.`} title="Payments" />
              <PaymentPreferenceInvitationAction inquiryId={inquiry.id} initialBookingTotalCents={inquiry.confirmedBookingTotalCents} initialPaymentPreference={inquiry.paymentPreference} initialSelectedAt={inquiry.paymentPreferenceSelectedAt} invoiceExists={Boolean(inquiry.squareDepositInvoiceId)} partySize={inquiry.partySize} roomPreference={inquiry.roomPreference} initialGeneratedDraft={paymentChoiceDraft} onGeneratedDraftChange={onPaymentChoiceDraftChange} />
              <DepositInvoiceAction key={`invoice-${inquiry.id}-${inquiry.squareDepositInvoiceStatus}-${inquiry.squareDepositInvoiceUrl ?? "none"}`} id={inquiry.id} partySize={inquiry.partySize} departure={inquiry.departure} acceptanceDate={inquiry.companyAcceptanceDate || acceptanceDate} email={inquiry.email} initialStatus={inquiry.squareDepositInvoiceStatus} initialUrl={inquiry.squareDepositInvoiceUrl} agreementReady={inquiry.agreementReady} agreementReadinessMessage={inquiry.agreementReadinessMessage} confirmedBookingTotalCents={inquiry.confirmedBookingTotalCents} initialPaymentPreference={inquiry.paymentPreference} paymentPreferenceSelectedAt={inquiry.paymentPreferenceSelectedAt} creatingClaimIsStale={inquiry.squareDepositClaimIsStale} squareMode={squareMode} />
            </div>
          )}
          {section === "activity" && <ActivitySection inquiry={inquiry} squareMode={squareMode} />}
        </div>
    </div>
  );
}

function InquiryProgressChecklist({ inquiry, onSectionChange }: { inquiry: DashboardInquiry; onSectionChange: (section: DetailSection) => void }) {
  const items = progressChecklistFor(inquiry);
  const completeCount = items.filter((item) => item.state === "complete").length;

  return (
    <section aria-label="Inquiry progress checklist" className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--cream)]/55 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-serif text-xl font-bold">Booking progress</h3>
          <p className="mt-0.5 text-xs font-semibold text-[var(--muted-ink)]">Select an item to open the section where it is managed.</p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[var(--ink)] shadow-sm">{completeCount} of {items.length} complete</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="list">
        {items.map((item) => {
          const stateLabel = item.state === "complete" ? "Complete" : item.state === "error" ? "Needs attention" : "Pending";
          const classes = item.state === "complete"
            ? "border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-400"
            : item.state === "error"
              ? "border-red-300 bg-red-50 text-red-950 hover:border-red-500"
              : "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400";
          const statusClasses = item.state === "complete" ? "text-emerald-800" : item.state === "error" ? "text-red-800" : "text-amber-900";

          return (
            <div key={item.label} role="listitem">
              <button
                aria-label={`${item.label}: ${stateLabel}. ${item.detail}`}
                className={`min-h-24 w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/45 ${classes}`}
                onClick={() => onSectionChange(item.section)}
                type="button"
              >
                <span className={`flex items-center gap-2 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] ${statusClasses}`}>
                  {item.state === "complete" ? <CheckCircle2 className="h-4 w-4" /> : item.state === "error" ? <AlertCircle className="h-4 w-4" /> : <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current" />}
                  {stateLabel}
                </span>
                <span className="mt-1.5 block text-sm font-extrabold leading-5">{item.label}</span>
                <span className="mt-1 block text-xs font-medium leading-5 opacity-80">{item.detail}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewSection({ inquiry, squareMode }: { inquiry: DashboardInquiry; squareMode: SquareMode }) {
  return (
    <div className="space-y-5">
      {inquiry.sellerOfTravelStateResident && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950"><p className="flex items-center gap-2 font-bold"><ShieldAlert className="h-5 w-5" /> Seller-of-travel screening required</p><p className="mt-1 text-sm leading-6">The customer reported residence in {stateLabels[inquiry.residenceState ?? ""] ?? inquiry.residenceState ?? "a regulated state"}. Review registration requirements before proceeding with a sale.</p></div>}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
        <SectionHeading description="Information submitted with the inquiry." title="Overview" />
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <InfoItem label="Email"><a className="font-semibold underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a></InfoItem>
          <InfoItem label="Phone"><a className="font-semibold underline" href={`tel:${inquiry.phone}`}>{inquiry.phone || "Not recorded"}</a></InfoItem>
          <InfoItem label="Departure">{departureLabel(inquiry.departure)}</InfoItem>
          <InfoItem label="Party size">{inquiry.partySize}</InfoItem>
          <InfoItem label="Room preference">{readableValue(inquiry.roomPreference)}</InfoItem>
          <InfoItem label="Trip contact consent">{inquiry.contactConsent ? "Recorded" : "Not recorded"}</InfoItem>
          <InfoItem label="Marketing consent">{inquiry.marketingConsent ? "Recorded" : "Not given"}</InfoItem>
          <InfoItem label="Payment environment">Square {squareMode === "sandbox" ? "Sandbox" : "Production"}</InfoItem>
        </dl>
        {inquiry.notes && <div className="mt-5 rounded-xl bg-[var(--cream)] p-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Customer notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{inquiry.notes}</p></div>}
      </section>
    </div>
  );
}

function ActivitySection({ inquiry, squareMode }: { inquiry: DashboardInquiry; squareMode: SquareMode }) {
  const agreementDeliveries = Object.values(inquiry.agreementInvitationDeliveries).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return (
    <div className="space-y-5">
      <SectionHeading description="Only persisted timestamps and system states are shown. Gmail drafts and copied links are not treated as sent messages." title="Activity & admin details" />
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <InfoItem label="Inquiry submitted">{formatTimestamp(inquiry.createdAt)}</InfoItem>
          <InfoItem label="Owner notification">{readableValue(inquiry.ownerNotificationStatus)}</InfoItem>
          <InfoItem label="MailerLite status">{readableValue(inquiry.mailerLiteStatus)}</InfoItem>
          <InfoItem label="Contact consent recorded">{formatTimestamp(inquiry.contactConsentedAt)}</InfoItem>
          <InfoItem label="Marketing consent recorded">{formatTimestamp(inquiry.marketingConsentedAt)}</InfoItem>
          <InfoItem label="Traveler-list link created">{formatTimestamp(inquiry.latestTravelerListLinkCreatedAt)}</InfoItem>
          <InfoItem label="Traveler list submitted">{formatTimestamp(inquiry.latestTravelerListCompletedAt)}</InfoItem>
          <InfoItem label="Payment-choice link created">{formatTimestamp(inquiry.latestPaymentChoiceLinkCreatedAt)}</InfoItem>
          <InfoItem label="Payment choice recorded">{formatTimestamp(inquiry.paymentPreferenceSelectedAt)}</InfoItem>
          <InfoItem label="Square invoice created">{formatTimestamp(inquiry.squareDepositCreatedAt)}</InfoItem>
          <InfoItem label="Square environment">{squareMode === "sandbox" ? "Sandbox testing" : "Production"}</InfoItem>
          <InfoItem label="Company accepted booking">{formatTimestamp(inquiry.companyAcceptedAt)}</InfoItem>
          <InfoItem label="Accepted by">{inquiry.companyAcceptedBy ?? "Not recorded"}</InfoItem>
        </dl>
      </section>
      <details className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/35">Recorded agreement email deliveries ({agreementDeliveries.length})</summary>
        {agreementDeliveries.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-ink)]">No persisted agreement-email delivery timestamp is available.</p> : <ul className="mt-3 space-y-2 text-sm">{agreementDeliveries.map((delivery) => <li key={`${delivery.email}-${delivery.sentAt}`} className="rounded-xl bg-[var(--cream)] p-3"><strong>{delivery.email}</strong><br /><span className="text-[var(--muted-ink)]">Sent {formatTimestamp(delivery.sentAt)}{delivery.acceptedAt ? ` · accepted ${formatTimestamp(delivery.acceptedAt)}` : ""}</span></li>)}</ul>}
      </details>
      <details className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/35">Technical identifiers</summary>
        <dl className="mt-3 grid gap-3 break-all font-mono text-xs sm:grid-cols-2"><InfoItem label="Inquiry ID">{inquiry.id}</InfoItem><InfoItem label="Square invoice ID">{inquiry.squareDepositInvoiceId ?? "Not created"}</InfoItem><InfoItem label="Square status">{readableValue(inquiry.squareDepositInvoiceStatus)}</InfoItem></dl>
      </details>
    </div>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return <div><h3 className="font-serif text-2xl font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{description}</p></div>;
}

function InfoItem({ children, label }: { children: React.ReactNode; label: string }) {
  return <div><dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted-ink)]">{label}</dt><dd className="mt-1 font-semibold text-[var(--ink)]">{children}</dd></div>;
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-extrabold uppercase tracking-[0.09em] text-[var(--muted-ink)] xl:hidden">{children}</span>;
}

function StageBadge({ status }: { status: string }) {
  const normalized = normalizeInquiryStage(status);
  const classes = normalized === "closed" ? "bg-slate-100 text-slate-700" : normalized === "waitlist" ? "bg-amber-100 text-amber-900" : normalized === "reserved" ? "bg-emerald-100 text-emerald-900" : normalized === "booking_in_progress" ? "bg-blue-100 text-blue-900" : normalized === "new" ? "bg-[var(--gold)]/25 text-[var(--ink)]" : "bg-[var(--cream)] text-[var(--ink)]";
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${classes}`}>{inquiryStageLabel(status) ?? readableValue(status)}</span>;
}

function ProgressLine({ label, state }: { label: string; state: "complete" | "pending" | "error" }) {
  const classes = state === "complete" ? "text-emerald-800" : state === "error" ? "text-red-700" : "text-[var(--muted-ink)]";
  return <span className={`flex items-center gap-1.5 ${classes}`}>{state === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : state === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-current" />}{label}</span>;
}

function PaymentBadge({ inquiry, squareMode }: { inquiry: DashboardInquiry; squareMode: SquareMode }) {
  const presentation = getSquareInvoiceStatusPresentation(inquiry.squareDepositInvoiceStatus);
  const preferenceOnly = inquiry.squareDepositInvoiceStatus === "not_created" && Boolean(inquiry.paymentPreference);
  const label = preferenceOnly ? "Preference saved · not paid" : presentation.label;
  const classes = preferenceOnly
    ? "bg-blue-100 text-blue-900"
    : presentation.tone === "success"
      ? "bg-emerald-100 text-emerald-900"
      : presentation.tone === "pending"
        ? "bg-amber-100 text-amber-950"
        : presentation.tone === "danger"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${classes}`}>{label}{squareMode === "sandbox" ? " · Test" : ""}</span>;
}

function progressChecklistFor(inquiry: DashboardInquiry): ChecklistItem[] {
  const travelerCount = inquiry.travelers.length;
  const acceptedCount = acceptedAgreementCount(inquiry);
  const invoiceStatus = inquiry.squareDepositInvoiceStatus.trim().toLowerCase();
  const invoicePresentation = getSquareInvoiceStatusPresentation(invoiceStatus);

  const travelerItem: ChecklistItem = travelerCount === inquiry.partySize
    ? { label: "Traveler details", detail: `${travelerCount}/${inquiry.partySize} traveler records received.`, state: "complete", section: "travelers" }
    : travelerCount > inquiry.partySize
      ? { label: "Traveler details", detail: `${travelerCount} records for a party of ${inquiry.partySize}. Resolve the mismatch.`, state: "error", section: "travelers" }
      : { label: "Traveler details", detail: `${travelerCount}/${inquiry.partySize} traveler records received.`, state: "pending", section: "travelers" };

  let agreementItem: ChecklistItem;
  if (!inquiry.agreementActive) {
    agreementItem = { label: "Traveler agreements", detail: "Agreement signing is not active yet.", state: "pending", section: "travelers" };
  } else if (travelerCount > inquiry.partySize || acceptedCount > inquiry.partySize) {
    agreementItem = { label: "Traveler agreements", detail: `${acceptedCount}/${inquiry.partySize} accepted; resolve the traveler mismatch first.`, state: "error", section: "travelers" };
  } else if (travelerCount === inquiry.partySize && acceptedCount === inquiry.partySize) {
    agreementItem = { label: "Traveler agreements", detail: `${acceptedCount}/${inquiry.partySize} current agreements accepted.`, state: "complete", section: "travelers" };
  } else {
    agreementItem = { label: "Traveler agreements", detail: `${acceptedCount}/${inquiry.partySize} current agreements accepted.`, state: "pending", section: "travelers" };
  }

  let invoiceItem: ChecklistItem;
  if (invoiceStatus === "not_created") {
    invoiceItem = { label: "Square invoice", detail: "No published invoice is recorded.", state: "pending", section: "payments" };
  } else if (invoiceStatus === "creating") {
    invoiceItem = inquiry.squareDepositClaimIsStale
      ? { label: "Square invoice", detail: "Invoice creation is stuck and can be retried safely.", state: "error", section: "payments" }
      : { label: "Square invoice", detail: "Invoice creation is in progress.", state: "pending", section: "payments" };
  } else if (invoiceStatus === "draft") {
    invoiceItem = { label: "Square invoice", detail: "A Square draft exists but is not published.", state: "pending", section: "payments" };
  } else if (invoicePresentation.needsAttention) {
    invoiceItem = { label: "Square invoice", detail: invoicePresentation.description, state: "error", section: "payments" };
  } else if (invoicePresentation.invoiceExists) {
    invoiceItem = { label: "Square invoice", detail: `Published · ${invoicePresentation.label}.`, state: "complete", section: "payments" };
  } else {
    invoiceItem = { label: "Square invoice", detail: invoicePresentation.description, state: "pending", section: "payments" };
  }

  let paymentItem: ChecklistItem;
  if (invoiceStatus === "paid") {
    paymentItem = { label: "Payment", detail: "Square reports the invoice paid in full.", state: "complete", section: "payments" };
  } else if (["error", "failed", "canceled", "refunded", "partially_refunded"].includes(invoiceStatus) || (!invoicePresentation.invoiceExists && invoicePresentation.tone === "danger")) {
    paymentItem = { label: "Payment", detail: invoicePresentation.description, state: "error", section: "payments" };
  } else if (["partially_paid", "payment_pending"].includes(invoiceStatus)) {
    paymentItem = { label: "Payment", detail: invoicePresentation.description, state: "pending", section: "payments" };
  } else {
    paymentItem = { label: "Payment", detail: invoicePresentation.invoiceExists ? `${invoicePresentation.label}; payment is not complete.` : "No verified payment is recorded.", state: "pending", section: "payments" };
  }

  return [
    { label: "Inquiry received", detail: `Submitted ${formatTimestamp(inquiry.createdAt)}.`, state: "complete", section: "activity" },
    inquiry.sellerOfTravelStateResident
      ? { label: "Residency screening", detail: `Review ${stateLabels[inquiry.residenceState ?? ""] ?? inquiry.residenceState ?? "the reported state"} requirements.`, state: "error", section: "overview" }
      : { label: "Residency screening", detail: "No regulated-state flag was reported.", state: "complete", section: "overview" },
    travelerItem,
    inquiry.confirmedBookingTotalCents && inquiry.confirmedBookingTotalCents > 0
      ? { label: "Booking total", detail: `${formatCurrency(inquiry.confirmedBookingTotalCents)} confirmed.`, state: "complete", section: "payments" }
      : { label: "Booking total", detail: "Confirmed total has not been entered.", state: "pending", section: "payments" },
    inquiry.paymentPreference && inquiry.paymentPreferenceSelectedAt
      ? { label: "Payment choice", detail: `${inquiry.paymentPreference === "full" ? "Full payment" : "Installment plan"} selected by customer.`, state: "complete", section: "payments" }
      : { label: "Payment choice", detail: "No submitted customer choice is recorded.", state: "pending", section: "payments" },
    agreementItem,
    invoiceItem,
    paymentItem,
  ];
}

function workflowFor(inquiry: DashboardInquiry): { label: string; detail: string; actionLabel: string; section: DetailSection; blocked: boolean } {
  if (inquiry.travelers.length > inquiry.partySize) return { label: "Resolve traveler-count mismatch", detail: `${inquiry.travelers.length} traveler records exist for a party of ${inquiry.partySize}. Agreement and payment steps remain blocked until the extra record is resolved.`, actionLabel: "Review travelers", section: "travelers", blocked: true };
  if (inquiry.sellerOfTravelStateResident) return { label: "Review residency screening", detail: `Review seller-of-travel requirements for ${stateLabels[inquiry.residenceState ?? ""] ?? inquiry.residenceState ?? "the customer's state"} before proceeding with a sale.`, actionLabel: "Review overview", section: "overview", blocked: true };
  if (hasMissingTravelerDetails(inquiry)) return { label: "Collect traveler details", detail: `${inquiry.partySize - inquiry.travelers.length} traveler record${inquiry.partySize - inquiry.travelers.length === 1 ? " is" : "s are"} still needed. Create or replace the secure traveler-list link in the traveler section.`, actionLabel: "Open travelers", section: "travelers", blocked: false };
  if (inquiry.departure === "flexible") return { label: "Confirm departure", detail: "A specific departure must be confirmed before agreement acceptance and payment scheduling can proceed.", actionLabel: "Review overview", section: "overview", blocked: true };
  if (!inquiry.agreementActive) return { label: "Await agreement activation", detail: "Traveler agreement invitations remain disabled until the legally approved agreement is activated.", actionLabel: "Review travelers", section: "travelers", blocked: true };
  if (!travelerPricesComplete(inquiry)) return { label: "Set traveler prices", detail: "Enter and save each traveler’s confirmed Trip Price before asking the primary contact to choose a payment option.", actionLabel: "Open travelers", section: "travelers", blocked: false };
  if (!inquiry.confirmedBookingTotalCents) return { label: "Prepare payment-choice link", detail: "Enter the confirmed group total and create the secure payment-choice link.", actionLabel: "Open payments", section: "payments", blocked: false };
  if (!inquiry.paymentPreference) return { label: "Await payment choice", detail: "The customer has not recorded a payment preference. Creating or opening a draft does not mean it was sent.", actionLabel: "Open payments", section: "payments", blocked: false };
  if (hasInvoiceIssue(inquiry)) {
    const invoiceStatus = getSquareInvoiceStatusPresentation(inquiry.squareDepositInvoiceStatus);
    return { label: "Review invoice issue", detail: invoiceStatus.description, actionLabel: "Review payment", section: "payments", blocked: invoiceStatus.tone === "danger" };
  }
  if (hasIncompleteAgreements(inquiry)) return { label: "Review agreements", detail: `${inquiry.partySize - acceptedAgreementCount(inquiry)} personalized Agreement 1.0 acceptance${inquiry.partySize - acceptedAgreementCount(inquiry) === 1 ? " is" : "s are"} still needed before the Square draft can be issued.`, actionLabel: "Open agreements", section: "travelers", blocked: false };
  if (getSquareInvoiceStatusPresentation(inquiry.squareDepositInvoiceStatus).invoiceExists) return { label: inquiry.squareDepositInvoiceStatus === "paid" ? "Review completed payment" : "Open Square invoice", detail: "Square's persisted invoice status is shown. Paid amounts and balances are omitted because they are not stored in D1.", actionLabel: "Open payments", section: "payments", blocked: false };
  return { label: "Review payment setup", detail: "The payment preference is recorded, but a published Square invoice is not available.", actionLabel: "Open payments", section: "payments", blocked: false };
}

function hasMissingTravelerDetails(inquiry: DashboardInquiry) { return inquiry.travelers.length < inquiry.partySize; }
function travelerPricesComplete(inquiry: DashboardInquiry) { return inquiry.travelers.length === inquiry.partySize && inquiry.travelers.every((traveler) => Boolean(traveler.confirmedTripPriceCents && traveler.confirmedTripPriceCents >= 50_000 && (traveler.confirmedOccupancy === "shared" || traveler.confirmedOccupancy === "private"))); }
function acceptedAgreementCount(inquiry: DashboardInquiry) { const accepted = new Set(inquiry.acceptedTravelerIds); return inquiry.travelers.filter((traveler) => accepted.has(traveler.id)).length; }
function hasIncompleteAgreements(inquiry: DashboardInquiry) { return acceptedAgreementCount(inquiry) < inquiry.partySize; }
function hasInvoiceIssue(inquiry: DashboardInquiry) { return getSquareInvoiceStatusPresentation(inquiry.squareDepositInvoiceStatus).needsAttention; }
function departureLabel(value: string) { return departureLabels[value] ?? value; }
function departureSortValue(value: string) { if (value === "flexible") return Number.MAX_SAFE_INTEGER; const parsed = Date.parse(`${value}T00:00:00Z`); return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER - 1; }
function readableValue(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatCurrency(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100); }
function formatTimestamp(value: string | null) { if (!value) return "Not recorded"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "Not recorded"; return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Indiana/Indianapolis" }); }
function detailSectionLabel(section: DetailSection) { return section[0].toUpperCase() + section.slice(1); }
function attentionFilterLabel(filter: Exclude<AttentionFilter, null>) { return filter === "new" ? "New inquiries" : filter === "missing_travelers" ? "Missing traveler details" : filter === "agreements" ? "Agreements incomplete" : "Invoice issues"; }
function compareInquiries(a: DashboardInquiry, b: DashboardInquiry, sort: SortOption) {
  if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
  if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
  if (sort === "departure") return departureSortValue(a.departure) - departureSortValue(b.departure) || b.createdAt.localeCompare(a.createdAt);
  if (sort === "name") return a.fullName.localeCompare(b.fullName);
  return attentionScore(b) - attentionScore(a) || b.createdAt.localeCompare(a.createdAt);
}
function attentionScore(inquiry: DashboardInquiry) {
  let score = 0;
  if (hasInvoiceIssue(inquiry)) score += 50;
  if (inquiry.sellerOfTravelStateResident) score += 40;
  if (hasMissingTravelerDetails(inquiry)) score += 30;
  if (hasIncompleteAgreements(inquiry)) score += 20;
  if (inquiry.status === "new") score += 10;
  return score;
}

function isGeneratedInvitationDraft(value: unknown): value is GeneratedInvitationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.invitationUrl === "string"
    && typeof draft.primaryContactName === "string"
    && typeof draft.primaryContactEmail === "string";
}

function isPaymentPreferenceGeneratedDraft(value: unknown): value is PaymentPreferenceGeneratedDraft {
  if (!isGeneratedInvitationDraft(value)) return false;
  const draft = value as unknown as Record<string, unknown>;
  return Number.isInteger(draft.invitationId)
    && typeof draft.createdAt === "string"
    && typeof draft.expiresAt === "string";
}

function isGeneratedLinkCache(value: unknown): value is GeneratedLinkCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Record<string, unknown>;
  if (!cache.travelerLists || typeof cache.travelerLists !== "object" || !cache.paymentChoices || typeof cache.paymentChoices !== "object") return false;
  return Object.values(cache.travelerLists).every(isGeneratedInvitationDraft)
    && Object.values(cache.paymentChoices).every(isPaymentPreferenceGeneratedDraft);
}

function readGeneratedLinkCache(): GeneratedLinkCache {
  const empty: GeneratedLinkCache = { travelerLists: {}, paymentChoices: {} };
  if (typeof window === "undefined") return empty;
  try {
    const cached = window.sessionStorage.getItem(generatedLinkCacheKey);
    if (!cached) return empty;
    const parsed = JSON.parse(cached) as unknown;
    return isGeneratedLinkCache(parsed) ? parsed : empty;
  } catch {
    return empty;
  }
}

function isDashboardListState(value: unknown): value is DashboardListState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  const validMainTabs: MainTab[] = ["active", "all", "waitlist", "closed"];
  const validAttentionFilters: AttentionFilter[] = [null, "new", "missing_travelers", "agreements", "invoice_issues"];
  const validSortOptions: SortOption[] = ["attention", "newest", "oldest", "departure", "name"];
  return validMainTabs.includes(state.mainTab as MainTab)
    && validAttentionFilters.includes(state.attentionFilter as AttentionFilter)
    && typeof state.search === "string"
    && typeof state.stage === "string"
    && typeof state.departure === "string"
    && validSortOptions.includes(state.sort as SortOption)
    && typeof state.scrollY === "number"
    && Number.isFinite(state.scrollY)
    && Number.isInteger(state.focusedInquiryId)
    && Number(state.focusedInquiryId) > 0;
}

function readDashboardListState(): DashboardListState | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(dashboardListStateKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as unknown;
    return isDashboardListState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
