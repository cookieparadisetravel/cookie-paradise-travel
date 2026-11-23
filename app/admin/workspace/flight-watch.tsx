import { Plane } from "lucide-react";

const watchUrl = "https://chatgpt.com/c/6afc95ed-6fdc-83ea-bcd6-1a04e3ab21f1";

export function FlightWatchCard() {
  return (
    <section className="ws-flight-card" aria-labelledby="flight-watch-heading">
      <div className="ws-flight-title"><Plane size={22} aria-hidden="true"/><div>
        <p className="ws-eyebrow">TRAVELER PLANNING</p>
        <h2 id="flight-watch-heading">Vietnam flight watch</h2>
        <p>Jem Busse · Los Angeles to Ho Chi Minh City</p>
      </div></div>
      <div className="ws-flight-summary"><strong>Arrive May 30–31, 2027</strong><p>Economy · Return June 8–10 · Dates to confirm</p><p className="ws-muted">Daily fare checks and alerts in ChatGPT.</p></div>
      <a className="ws-button" href="/admin/flight-watch">View flight watch</a>
    </section>
  );
}

export function FlightWatchDetails() {
  return (
    <main className="ws-page">
      <div className="ws-heading"><div><p className="ws-eyebrow">TRAVELER PLANNING</p><h1>Vietnam flight watch.</h1><p className="ws-muted">Help Jem find a good fare and a comfortable route.</p></div></div>
      <section className="ws-flight-panel" aria-labelledby="jem-watch-heading">
        <div className="ws-flight-detail-heading"><div><h2 id="jem-watch-heading">Jem Busse</h2><p>Discover Southern Vietnam · June 1–8, 2027</p></div><span className="ws-pill">Dates to confirm</span></div>
        <dl className="ws-flight-facts">
          <div><dt>Outbound</dt><dd>Los Angeles (LAX) to Ho Chi Minh City (SGN)</dd><dd>Arrive May 30 or 31, 2027, Vietnam time.</dd></div>
          <div><dt>Return</dt><dd>Da Nang (DAD) to Los Angeles (LAX)</dd><dd>Depart June 8, 9, or 10, 2027.</dd></div>
          <div><dt>Compare with</dt><dd>Round-trip LAX–SGN plus a Da Nang–Ho Chi Minh City flight after the tour.</dd></div>
          <div><dt>Flight preferences</dt><dd>One adult · Economy · One checked bag</dd><dd>Prefer no more than one stop each way.</dd></div>
        </dl>
        <p className="ws-flight-assumption">These are the starting search criteria. Confirm Jem’s dates and preferences before choosing a flight.</p>
      </section>
      <section className="ws-flight-panel ws-flight-monitor" aria-labelledby="watch-results-heading">
        <div><h2 id="watch-results-heading">Fare checks & alerts</h2><p>The watch was set up for daily checks starting November 24, 2026. Results, current schedule, and pause controls are in ChatGPT.</p>
          <p>The first verified search establishes a baseline. Later alerts highlight a price drop of at least $100 or 10%, or a better itinerary at a similar or lower price. Comparisons include baggage and connection details.</p>
          <p className="ws-muted">This dashboard is a shortcut to the watch; live fares and run status are shown in ChatGPT.</p></div>
        <a className="ws-button ws-button-primary" href={watchUrl} target="_blank" rel="noopener noreferrer">Open flight watch in ChatGPT</a>
      </section>
    </main>
  );
}
