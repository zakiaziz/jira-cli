import { CliError } from "./core/errors.js";
import type { Provider, ProviderErrorDetail } from "./core/provider.js";
import { HTTP_METHODS } from "./core/types.js";
import { isRecord, visibleAsciiConstraint } from "./core/values.js";
import { commands, groups, offsetPagination } from "./registry.js";

const SITE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export const provider: Provider = {
  bin: "jira",
  name: "Jira",
  secrets: [
    {
      key: "email",
      label: "email",
      secret: false,
      placeholder: "EMAIL",
      example: "ada@example.com",
      validate: (value) => /^[^\s:\u0000-\u001f\u007f@]+@[^\s:\u0000-\u001f\u007f@]+$/.test(value)
        ? undefined
        : "be an email address without whitespace, colons, or control characters",
    },
    { key: "apiToken", label: "API token", validate: visibleAsciiConstraint },
  ],
  authScheme: "HTTP Basic authentication with the email and API token",
  authorize: (credential) => ({
    Authorization: `Basic ${Buffer.from(`${credential.email}:${credential.apiToken}`).toString("base64")}`,
  }),
  secretValues: (credential) => [Buffer.from(`${credential.email}:${credential.apiToken}`).toString("base64")],
  baseUrl: { allowPath: false },
  endpointFields: [{
    key: "site",
    label: "site",
    placeholder: "NAME",
    example: "acme",
    validate: (value) => SITE.test(value) ? undefined : "be a site name of letters, digits, and hyphens, such as acme",
    baseUrl: (value) => `https://${value}.atlassian.net`,
  }],
  accessLevels: true,
  requestIdHeader: ["x-arequestid", "atl-traceid", "x-request-id"],
  errorDetail,
  pagination: offsetPagination,
  verify: {
    method: "GET",
    path: "/rest/api/3/myself",
    query: [],
    effect: "Sends GET /rest/api/3/myself. Success proves that Jira accepted the account email and API token and identifies the account. It does not prove complete permission coverage.",
    identity(data) {
      if (!isRecord(data) || typeof data.accountId !== "string" || data.accountId === "") {
        throw new CliError("INVALID_RESPONSE", "Jira response does not contain a nonempty \"accountId\" string for auth verify.", {
          hint: "Retry later. If the failure persists, the Jira API contract may have changed.",
        });
      }
      return Object.fromEntries(["accountId", "displayName", "emailAddress", "active", "accountType"]
        .filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
    },
  },
  api: {
    methods: HTTP_METHODS,
    examples: [
      "jira api request GET /rest/api/3/issue/ISSUE_KEY --query fields=summary,status",
      "jira api request PUT /rest/api/3/issue/ISSUE_KEY --file ./issue.json --dry-run",
    ],
  },
  groups,
  commands,
};

function errorDetail(body: unknown): ProviderErrorDetail {
  if (!isRecord(body)) return {};
  const messages = Array.isArray(body.errorMessages)
    ? body.errorMessages.filter((value): value is string => typeof value === "string")
    : [];
  if (isRecord(body.errors)) {
    for (const [field, message] of Object.entries(body.errors)) {
      if (typeof message === "string") messages.push(`${field}: ${message}`);
    }
  }
  if (typeof body.message === "string") messages.push(body.message);
  const code = typeof body.code === "string" || typeof body.code === "number" ? body.code : undefined;
  return {
    ...(messages.length === 0 ? {} : { message: messages.join("; ") }),
    ...(code === undefined ? {} : { code }),
  };
}
