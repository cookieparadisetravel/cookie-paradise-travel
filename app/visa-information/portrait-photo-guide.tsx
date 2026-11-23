export function PortraitPhotoGuide() {
  return (
    <aside className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--cream)] p-4" aria-label="Portrait photo guidance">
      <h3 className="font-semibold">How to frame your portrait</h3>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <figure className="w-28 shrink-0">
          <img src="/images/visa/portrait-example.webp" width={360} height={540} className="block h-auto w-full rounded border border-[var(--line)] bg-white" alt="Illustrative portrait: head centered, facing forward, no glasses, with a white background and shoulders visible."/>
          <figcaption className="mt-2 text-sm">Illustrative example</figcaption>
        </figure>
        <ul className="min-w-36 flex-1 list-disc space-y-2 pl-5 text-sm leading-6">
          <li>Use a plain white background.</li>
          <li>Face the camera straight on.</li>
          <li>Remove your glasses.</li>
          <li>Keep your whole head centered and visible, with shoulders in the frame.</li>
        </ul>
      </div>
      <p className="mt-3 text-sm">Portrait format: 4 × 6 cm (2:3 proportions).</p>
      <a href="https://vietnamembassydelhi.in/visa-faq/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">Vietnam Embassy photo requirements</a>
    </aside>
  );
}
