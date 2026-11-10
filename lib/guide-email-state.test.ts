import test from 'node:test';
import assert from 'node:assert/strict';
import { guideEmailState } from './guide-email-state.ts';
import type { GuideLeadRow } from './lead-inbox';
const lead = (extra: Partial<GuideLeadRow> = {}) => ({ status:'new', contact_permission:1, guide_email_status:'manual_follow_up', ...extra }) as GuideLeadRow;
test('manual intake is unrecorded, not a claim that no email was sent', () => {
  assert.equal(guideEmailState(lead()).bucket,'needs_guide');
  assert.equal(guideEmailState(lead()).label,'No guide send recorded');
  assert.equal(guideEmailState(lead({contacted_at:'2026-11-01'})).bucket,'needs_guide');
});
test('manual records and provider sends leave the needs-guide queue', () => {
  for (const fields of [{manual_guide_sent_at:'2026-11-10'}, {guide_email_status:'sent'}]) assert.equal(guideEmailState(lead(fields)).bucket,'guide_sent');
});
test('renewed request does not inherit original send status', () => {
  assert.equal(guideEmailState(lead({guide_email_status:'sent', renewed_at:'2026-11-10', renewed_email_status:'pending'})).bucket,'needs_guide');
});
test('closed and declined requests are not email tasks, unknown permissions need review', () => {
  assert.equal(guideEmailState(lead({status:'closed'})).bucket,'guide_inactive');
  assert.equal(guideEmailState(lead({contact_permission:0})).bucket,'guide_inactive');
  assert.equal(guideEmailState(lead({contact_permission:null})).bucket,'guide_review');
});
test('uncertain sends require review before retry', () => {
  for (const status of ['sending','failed','not_configured','unknown']) assert.equal(guideEmailState(lead({guide_email_status:status})).bucket,'guide_review');
});
test('Facebook No answers still show requested guide delivery and errors', () => {
  assert.equal(guideEmailState(lead({source:'meta', contact_permission:0})).bucket,'needs_guide');
  assert.equal(guideEmailState(lead({source:'meta', contact_permission:0, guide_email_status:'failed'})).bucket,'guide_review');
  assert.equal(guideEmailState(lead({source:'meta', contact_permission:0, guide_email_status:'sent'})).bucket,'guide_sent');
  assert.equal(guideEmailState(lead({source:'meta', contact_permission:0, status:'closed'})).bucket,'guide_inactive');
});
