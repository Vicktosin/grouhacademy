import assert from "node:assert/strict";
import test from "node:test";

import {
  issueCohortCertificates,
  planCohortCertificate,
  type CohortCertificateStore,
  type CohortMember,
} from "../lib/cohort-certificates";
import { internshipCertificateNumber } from "../lib/certificate-branding";

// Bulk certificates against an in-memory store that behaves like the
// database (a created certificate is seen by the next listMembers call).

function member(overrides: Partial<CohortMember> & { applicationId: string }): CohortMember {
  return {
    userId: `user-${overrides.applicationId}`,
    name: `Intern ${overrides.applicationId}`,
    email: `${overrides.applicationId}@example.com`,
    status: "ACTIVE",
    paid: true,
    group: null,
    submissionCount: 1,
    existingCertificate: null,
    ...overrides,
  };
}

function fakeStore(members: CohortMember[]) {
  const certificates: { id: string; applicationId: string; certificateNumber: string; title: string; revoked: boolean }[] = [];
  const notified: string[] = [];
  const store: CohortCertificateStore = {
    getCohort: async (id) => (id === "cohort-1" ? { id, name: "November DM", programId: "track-dm" } : null),
    listMembers: async () =>
      members.map((m) => {
        const cert =
          certificates.find((c) => c.applicationId === m.applicationId && !c.revoked) ??
          certificates.find((c) => c.applicationId === m.applicationId);
        return cert
          ? { ...m, existingCertificate: { id: cert.id, certificateNumber: cert.certificateNumber, revoked: cert.revoked } }
          : m;
      }),
    certificatePrefix: async () => "SR-INT",
    createCertificate: async (input) => {
      const existing = certificates.find((c) => c.applicationId === input.applicationId && !c.revoked);
      if (existing) return { id: existing.id, certificateNumber: existing.certificateNumber, created: false };
      const cert = { id: `cert-${certificates.length + 1}`, applicationId: input.applicationId, certificateNumber: input.certificateNumber, title: input.title, revoked: false };
      certificates.push(cert);
      return { id: cert.id, certificateNumber: cert.certificateNumber, created: true };
    },
    notify: async (id) => {
      notified.push(id);
    },
  };
  return { store, certificates, notified };
}

const roster = () => [
  member({ applicationId: "a1", submissionCount: 3 }),
  member({ applicationId: "a2", submissionCount: 0 }),
  member({ applicationId: "a3", submissionCount: 1 }),
  member({ applicationId: "a4", paid: false, submissionCount: 2 }),
  member({ applicationId: "a5", status: "REMOVED", submissionCount: 2 }),
];

test('mode "submitted_at_least_one" issues only to interns with a submission', async () => {
  const { store, certificates } = fakeStore(roster());
  const result = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "DM Internship", mode: "submitted_at_least_one" });
  assert.ok(result.ok);
  if (!result.ok) return;
  const byApp = Object.fromEntries(result.rows.map((r) => [r.applicationId, r]));
  assert.equal(byApp.a1.result, "issued");
  assert.equal(byApp.a3.result, "issued");
  assert.equal(byApp.a2.result, "skipped");
  assert.match(byApp.a2.reason ?? "", /No submissions/);
  assert.match(byApp.a4.reason ?? "", /not paid/);
  assert.match(byApp.a5.reason ?? "", /Removed/);
  assert.deepEqual(result.summary, { issued: 2, skipped: 3 });
  assert.equal(certificates.length, 2);
});

test('mode "all" also issues to paid, active interns with no submissions', async () => {
  const { store } = fakeStore(roster());
  const result = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "DM Internship", mode: "all" });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(
    result.rows.filter((r) => r.result === "issued").map((r) => r.applicationId),
    ["a1", "a2", "a3"],
  );
});

test("running it twice creates no duplicates and notifies each intern once", async () => {
  const { store, certificates, notified } = fakeStore(roster());
  const first = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "DM Internship", mode: "all" });
  const second = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "DM Internship", mode: "all" });
  assert.ok(first.ok && second.ok);
  if (!first.ok || !second.ok) return;
  assert.equal(certificates.length, 3, "still one certificate per intern");
  assert.equal(new Set(certificates.map((c) => c.applicationId)).size, 3);
  assert.equal(second.summary.issued, 0);
  for (const row of second.rows.filter((r) => ["a1", "a2", "a3"].includes(r.applicationId))) {
    assert.equal(row.result, "skipped");
    assert.match(row.reason ?? "", /Already has a certificate/);
    // The skipped row reports the certificate they already have.
    assert.equal(row.certificateNumber, first.rows.find((r) => r.applicationId === row.applicationId)?.certificateNumber);
  }
  assert.deepEqual(notified.sort(), ["cert-1", "cert-2", "cert-3"]);
});

test("each row has name, email, certificate number and issued/skipped with reason", async () => {
  const { store } = fakeStore([member({ applicationId: "a1" })]);
  const result = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "DM Internship", mode: "all" });
  assert.ok(result.ok);
  if (!result.ok) return;
  const [row] = result.rows;
  assert.equal(row.name, "Intern a1");
  assert.equal(row.email, "a1@example.com");
  assert.equal(row.result, "issued");
  assert.match(row.certificateNumber ?? "", /^SR-INT-[0-9A-F]{12}$/, "uses the settings prefix");
});

test("revoked certificates are not silently reissued; existing ones from before are skipped", () => {
  assert.equal(
    planCohortCertificate(member({ applicationId: "x", existingCertificate: { id: "c", certificateNumber: "N", revoked: true } }), "all").issue,
    false,
  );
  assert.equal(
    planCohortCertificate(member({ applicationId: "x", existingCertificate: { id: "c", certificateNumber: "N", revoked: false } }), "all").issue,
    false,
  );
  assert.equal(planCohortCertificate(member({ applicationId: "x", status: "ON_HOLD" }), "all").issue, false);
});

test("bad input is refused before anything is issued", async () => {
  const { store, certificates } = fakeStore(roster());
  const missing = await issueCohortCertificates(store, { cohortId: "nope", title: "T", mode: "all" });
  assert.deepEqual(missing, { ok: false, error: "Cohort not found." });
  const noTitle = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "  ", mode: "all" });
  assert.equal(noTitle.ok, false);
  const badMode = await issueCohortCertificates(store, { cohortId: "cohort-1", title: "T", mode: "some" as never });
  assert.equal(badMode.ok, false);
  assert.equal(certificates.length, 0);
});

test("certificate numbers use the prefix, are unique, and fall back to CERT-INT", () => {
  const numbers = new Set(Array.from({ length: 500 }, () => internshipCertificateNumber("sr-int")));
  assert.equal(numbers.size, 500);
  for (const n of numbers) assert.match(n, /^SR-INT-[0-9A-F]{12}$/);
  assert.match(internshipCertificateNumber(""), /^CERT-INT-/);
});
