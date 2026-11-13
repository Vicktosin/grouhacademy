import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformSettingsPatch } from "../lib/platform-settings-validation";

test("SabiRole rebrand values are accepted and normalised", () => {
  const { data, errors } = parsePlatformSettingsPatch({
    academyName: " SabiRole ",
    platformName: "SabiRole",
    certificateIssuerName: "SabiRole",
    certificatePrefix: "sabirole",
    certificateNumberPrefix: "sr-int",
    certificateLogoUrl: "/sabirole-logo.png",
    automaticCertificateIssue: false,
    poolGroupSize: 6,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, {
    academyName: "SabiRole",
    platformName: "SabiRole",
    certificateIssuerName: "SabiRole",
    certificatePrefix: "SABIROLE",
    certificateNumberPrefix: "SR-INT",
    certificateLogoUrl: "/sabirole-logo.png",
    automaticCertificateIssue: false,
    poolGroupSize: 6,
  });
});

test("invalid values are reported and not saved", () => {
  const { data, errors } = parsePlatformSettingsPatch({
    academyName: "",
    certificateNumberPrefix: "SR INT!",
    poolGroupSize: 1,
    automaticCertificateIssue: "yes",
    certificateLogoUrl: "javascript:alert(1)",
    supportEmail: "nope",
    testimonialDriveUrl: "https://dropbox.com/x",
  });
  assert.deepEqual(data, {});
  assert.equal(errors.length, 7);
});

test("empty links clear; absent fields are untouched", () => {
  const { data, errors } = parsePlatformSettingsPatch({ certificateLogoUrl: "", testimonialDriveUrl: null, platformUrl: "" });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, { certificateLogoUrl: null, testimonialDriveUrl: null, platformUrl: null });
  assert.deepEqual(parsePlatformSettingsPatch({}), { data: {}, errors: [] });
});
