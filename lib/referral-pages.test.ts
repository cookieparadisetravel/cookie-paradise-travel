import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("both routes enforce activation/owner access and render only the selected salon", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "referral-pages-"));
  const globals = globalThis as unknown as Record<string, unknown>;
  const state = { owner: true, env: { REFERRAL_ACTIVE_PARTNERS: "" } };
  globals.__referralPageTest = state;
  try {
    await build({ stdin: { resolveDir: process.cwd(), contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import PublicPage from './app/referrals/[partner]/page.tsx';
      import PreviewPage from './app/admin/referrals/[partner]/page.tsx';
      export { PublicPage, PreviewPage };
      export function render(element) { return renderToStaticMarkup(element); }
    `, loader: "tsx" }, outfile: path.join(dir, "pages.mjs"), bundle: true, platform: "node", format: "esm", jsx: "automatic", banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, plugins: [{ name: "page-infrastructure", setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|next\/navigation|@\/lib\/owner-auth)$/ }, (args) => ({ path: args.path, namespace: "page-mock" }));
      builder.onResolve({ filter: /\.\/(booking-dialog|mobile-book-bar)$/ }, (args) => ({ path: args.path, namespace: "page-mock" }));
      builder.onLoad({ filter: /.*/, namespace: "page-mock" }, ({ path: modulePath }) => {
        const modules: Record<string, string> = {
          "cloudflare:workers": "export const env = globalThis.__referralPageTest.env;",
          "next/navigation": "export const notFound = () => {throw Error('404');};",
          "@/lib/owner-auth": "export const requireOwner = async () => globalThis.__referralPageTest.owner ? {email: 'owner@example.invalid'} : null;",
          "./booking-dialog": "import React from 'react'; export const BookingDialog = (props) => React.createElement('button', {'data-referral': props.referralPartner, 'data-preview': String(props.referralPreview)}, props.triggerLabel);",
          "./mobile-book-bar": "import React from 'react'; export const MobileBookBar = (props) => React.createElement('button', {'data-mobile-referral': props.referralPartner, 'data-preview': String(props.referralPreview)}, 'Mobile inquiry');",
        };
        return { contents: modules[modulePath], loader: "js", resolveDir: process.cwd() };
      });
    }}] });
    const { PublicPage, PreviewPage, render } = await import(path.join(dir, "pages.mjs"));
    for (const [id, other, label] of [["gossip-nails", "nail-station-spa", "Gossip Nails"], ["nail-station-spa", "gossip-nails", "Nail Station &amp; Spa"]]) {
      const params = { params: Promise.resolve({partner: id}) };
      await assert.rejects(() => PublicPage(params), /404/);
      const preview = await PreviewPage(params);
      const html = render(preview);
      assert.ok(html.includes(`/referral-logos/${id}.png`));
      assert.ok(!html.includes(`/referral-logos/${other}.png`));
      assert.ok(html.includes(label));
      assert.ok(html.includes('Pilot concept'));
      assert.equal((html.match(new RegExp(`data-referral="${id}"`, 'g')) ?? []).length, 3);
      assert.ok(html.includes(`data-mobile-referral="${id}"`));
      assert.ok(html.includes('data-preview="true"'));
      state.env.REFERRAL_ACTIVE_PARTNERS = id;
      const live = await PublicPage(params);
      assert.equal(live.props.referralPreview, false);
      state.env.REFERRAL_ACTIVE_PARTNERS = "";
      state.owner = false;
      await assert.rejects(() => PreviewPage(params), /404/);
      state.owner = true;
    }
    await assert.rejects(() => PreviewPage({ params: Promise.resolve({partner: "unknown"}) }), /404/);
  } finally { delete globals.__referralPageTest; await rm(dir, { recursive: true, force: true }); }
});
