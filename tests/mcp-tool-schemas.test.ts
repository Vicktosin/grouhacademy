import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Starts the real MCP server and reads its tool list exactly as Claude does,
// so a field missing from a tool's schema fails here. Listing tools makes
// no database queries.

const appDir = path.resolve(__dirname, "..");

test("MCP tools expose the new fields to Claude", { timeout: 60_000 }, async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [require.resolve("tsx/cli"), path.join(appDir, "mcp-server", "index.ts")],
    cwd: appDir,
    stderr: "pipe",
  });
  const client = new Client({ name: "schema-test", version: "1.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const schema = (name: string) => {
      const tool = tools.find((t) => t.name === name);
      assert.ok(tool, `${name} is registered`);
      return tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    };

    const updateTask = schema("update_cohort_task").properties ?? {};
    for (const field of ["labPassMark", "opensWeek", "opensDay", "opensTime", "dueWeek", "dueDay", "dueTime"])
      assert.ok(field in updateTask, `update_cohort_task has ${field}`);

    const create = schema("create_announcement").properties ?? {};
    for (const field of ["cohortIds", "showAsPopup", "programId", "audience"])
      assert.ok(field in create, `create_announcement has ${field}`);
    assert.ok("cohortIds" in (schema("update_announcement").properties ?? {}));
    schema("list_announcements");
    schema("delete_announcement");

    const settings = schema("update_platform_settings").properties ?? {};
    for (const field of [
      "academyName", "platformName", "certificateIssuerName", "certificatePrefix",
      "certificateNumberPrefix", "automaticCertificateIssue", "poolGroupSize", "certificateLogoUrl",
    ])
      assert.ok(field in settings, `update_platform_settings has ${field}`);

    const bulk = schema("issue_cohort_certificates");
    assert.deepEqual([...(bulk.required ?? [])].sort(), ["cohortId", "mode", "title"]);
    assert.deepEqual((bulk.properties?.mode as { enum?: string[] }).enum, ["submitted_at_least_one", "all"]);

    assert.deepEqual(schema("list_cohort_members").required, ["cohortId"]);
    for (const name of ["list_testimonials", "update_testimonial", "set_testimonial_drive_link", "list_testimonial_drive_links"])
      schema(name);
  } finally {
    await client.close();
  }
});
