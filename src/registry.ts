import type { Pagination, RequestCommand } from "./core/provider.js";
import { FILE_OPTION, type ArgumentSpec, type Context, type GroupSpec, type OptionSpec, type PaginationSpec } from "./core/registry.js";
import { DATE_TIME_FORM, echoable, invalidValue, isRecord, missingFields, parseCalendarDate, readInput, readJsonFile, redact, validateId } from "./core/values.js";

const API = "/rest/api/3";
const AGILE = "/rest/agile/1.0";
const ORDER = "Order is set by Jira and is undocumented.";
const FULL_LIST = "Not paginated. Jira returns the full list in one response.";
const NO_RESTORE = "Jira's REST API provides no restore operation.";

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function checkOffset(value: string): string {
  if (/^(0|[1-9][0-9]{0,14})$/.test(value)) return value;
  throw invalidValue("--cursor", "be a nonnegative decimal offset", echoable(value), "Use meta.next_cursor from a previous result.");
}

export const offsetPagination: Pagination = {
  detectRepeatedPages: true,
  checkCursor: checkOffset,
  apply({ query }, page) {
    query.set("startAt", page.cursor ?? "0");
    query.set("maxResults", String(page.size));
  },
  read(payload, _key, page, items) {
    if (!isRecord(payload) || !count(payload.startAt) || payload.startAt !== Number(page.cursor ?? "0")) return undefined;
    if (payload.maxResults !== undefined && (!count(payload.maxResults) || payload.maxResults === 0)) return undefined;
    if (payload.total !== undefined && !count(payload.total)) return undefined;
    if (payload.isLast !== undefined && typeof payload.isLast !== "boolean") return undefined;
    const next = payload.startAt + items.length;
    const total = count(payload.total) ? payload.total : undefined;
    if (total !== undefined && typeof payload.isLast === "boolean" && payload.isLast !== (next >= total)) return undefined;
    const more = typeof payload.isLast === "boolean"
      ? !payload.isLast
      : total !== undefined
        ? next < total
        : undefined;
    if (more === undefined || (more && items.length === 0)) return undefined;
    return { nextCursor: more ? String(next) : null, ...(total === undefined ? {} : { provider: { total } }) };
  },
};

const tokenPagination: Pagination = {
  allowEmptyPages: true,
  apply({ query }, page) {
    query.set("maxResults", String(page.size));
    if (page.cursor === null) query.delete("nextPageToken");
    else query.set("nextPageToken", page.cursor);
  },
  read(payload) {
    if (!isRecord(payload)) return undefined;
    if (payload.isLast !== undefined && typeof payload.isLast !== "boolean") return undefined;
    const token = payload.nextPageToken;
    if (payload.isLast === undefined && token === undefined) return undefined;
    if (token !== undefined && token !== null && typeof token !== "string") return undefined;
    const next = typeof token === "string" && token !== "" ? token : null;
    if (payload.isLast === false && next === null) return undefined;
    if (payload.isLast === true && next !== null) return undefined;
    return { nextCursor: next };
  },
};

// User search filters first, then pages the matching users, up to the thousandth match.
const userPagination: Pagination = {
  ...offsetPagination,
  read(payload, _key, page) {
    if (!Array.isArray(payload)) return undefined;
    if (payload.length < page.size) return { nextCursor: null };
    const next = Number(page.cursor ?? "0") + payload.length;
    return next >= 1000 ? { nextCursor: null, hasMore: true } : { nextCursor: String(next) };
  },
};

function pages(style?: Pagination, ordering = ORDER): PaginationSpec {
  return { max: 100, default: 100, maxSource: "tool", ordering, ...(style ? { style } : {}) };
}

function identifier(name: string, description: string): ArgumentSpec {
  return { name, description, check: (value) => validateId(name, value) };
}

const ISSUE = identifier("ISSUE", "Issue ID or key, such as DEMO-1.");
const PROJECT = identifier("PROJECT", "Project ID or key, such as DEMO.");
const BOARD = identifier("BOARD_ID", "Board ID.");
const SPRINT = identifier("SPRINT_ID", "Sprint ID.");

function text(name: string, description: string, extra: Partial<OptionSpec> = {}): OptionSpec {
  return { name, type: "string", placeholder: "TEXT", description, ...extra };
}

function idOption(name: string, description: string, required = false): OptionSpec {
  return text(name, description, { placeholder: name.toUpperCase().replaceAll("-", "_"), required, check: (value) => validateId(`--${name}`, value) });
}

const ISSUE_SCOPE = { ...idOption("issue", "Issue ID or key containing the resource.", true), placeholder: "ISSUE" };
const FIELD = text("field", "Field selector to include, such as summary, *all, or -description. Without it, Jira returns its default fields.", {
  placeholder: "FIELD",
  repeatable: true,
  check(value) {
    if (/^-?(?:[A-Za-z][A-Za-z0-9_]*|\*(?:all|navigable))$/.test(value)) return value;
    throw invalidValue("--field", "be a field name, *all, or *navigable, optionally prefixed with -", echoable(value), "Use --field summary --field status, or --field=-description to exclude a field.");
  },
});
const BODY = text("body", "Plain-text comment body, sent literally as an Atlassian Document Format (ADF) document.");
const BODY_FILE: OptionSpec = {
  name: "body-file", type: "path", placeholder: "PATH", conflicts: ["body"],
  description: "Read the plain-text comment body from PATH. - reads stdin. Blank content is rejected.",
};
const DESCRIPTION_FILE: OptionSpec = {
  ...BODY_FILE,
  conflicts: ["description"],
  description: "Read the plain-text issue description from PATH. - reads stdin. Blank content is rejected.",
};
const DESCRIPTION = text("description", "Plain-text issue description, sent literally as an Atlassian Document Format (ADF) document.");
const LABEL = text("label", "Label. Repeating this option supplies the complete label list.", { placeholder: "LABEL", repeatable: true });
const CLEAR_DESCRIPTION: OptionSpec = {
  name: "clear-description", type: "boolean", conflicts: ["description", "body-file"], description: "Set description to null.",
};
const CLEAR_LABELS: OptionSpec = { name: "clear-labels", type: "boolean", conflicts: ["label"], description: "Set labels to an empty list." };
const ISSUE_FIELDS = [text("summary", "Issue summary."), DESCRIPTION, DESCRIPTION_FILE, idOption("assignee-id", "Assignee account ID."), idOption("priority-id", "Priority ID."), LABEL];

function fileOption(options: OptionSpec[]): OptionSpec {
  return {
    ...FILE_OPTION,
    conflicts: options.map((option) => option.name),
    description: `${FILE_OPTION.description} Holds {"fields":{...}}. Supported fields: ${ISSUE_INPUT_FIELDS.join(", ")}, and customfield_N. See README "Output and errors" for field types and clearing values.`,
  };
}

function query(context: Context, mapping: Record<string, string>): [string, string][] {
  return Object.entries(mapping).flatMap(([option, key]): [string, string][] => {
    const value = context.options.string(option);
    return value === undefined ? [] : [[key, value]];
  });
}

function fieldQuery(context: Context): [string, string][] {
  const fields = context.options.strings("field");
  return fields.length === 0 ? [] : [["fields", fields.join(",")]];
}

function target(context: Context): string {
  return encodeURIComponent(context.args[0] ?? "");
}

function issueScope(context: Context): string {
  return `${API}/issue/${encodeURIComponent(context.options.string("issue") ?? "")}`;
}

function requiredText(subject: string, value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  throw inputError(subject, "be a nonblank string", value, `Supply ${subject} as nonblank text.`);
}

function inputError(subject: string, constraint: string, value: unknown, hint: string) {
  const received = typeof value === "string" ? value : JSON.stringify(redact(value)) ?? "omitted";
  return invalidValue(subject, constraint, echoable(received), hint);
}

function adf(value: string): Record<string, unknown> {
  return {
    type: "doc", version: 1,
    content: value.replace(/\r\n?/g, "\n").split("\n").map((line) => ({
      type: "paragraph", content: line === "" ? [] : [{ type: "text", text: line }],
    })),
  };
}

function plainBody(context: Context, name = "body", required = true): Record<string, unknown> | undefined {
  const file = context.options.string("body-file");
  const value = file === undefined ? context.options.string(name) : readInput("--body-file", file);
  if (value === undefined && !required) return undefined;
  return adf(requiredText(`--${name} or --body-file`, value));
}

function checkDocument(value: unknown, at: string): void {
  if (!isRecord(value) || value.type !== "doc" || value.version !== 1 || !Array.isArray(value.content)) {
    throw inputError(at, "be an ADF document with type \"doc\", version 1, and a content array", value, "Use plain text or a valid ADF document.");
  }
  function node(value: unknown, path: string): void {
    if (!isRecord(value) || typeof value.type !== "string" || value.type === "") {
      throw inputError(path, "be an ADF node with a nonempty type", value, "Supply valid ADF nodes.");
    }
    if (value.type === "text" && (typeof value.text !== "string" || value.text === "")) {
      throw inputError(`${path}.text`, "be a nonempty string", value.text, "Supply text for each ADF text node.");
    }
    if (value.content !== undefined) {
      if (!Array.isArray(value.content)) throw inputError(`${path}.content`, "be an array", value.content, "Supply an array of ADF nodes.");
      value.content.forEach((child, index) => node(child, `${path}.content[${index}]`));
    }
    if (value.attrs !== undefined && !isRecord(value.attrs)) throw inputError(`${path}.attrs`, "be an object", value.attrs, "Supply ADF attributes as an object.");
    if (value.marks !== undefined && (!Array.isArray(value.marks) || !value.marks.every((mark) => isRecord(mark) && typeof mark.type === "string"))) {
      throw inputError(`${path}.marks`, "be an array of marks with a type", value.marks, "Supply valid ADF marks.");
    }
  }
  node(value, at);
}

const ISSUE_INPUT_FIELDS = ["project", "issuetype", "summary", "description", "assignee", "priority", "labels", "parent", "components", "fixVersions", "versions", "reporter", "duedate", "environment"];

function checkIssueFields(fields: Record<string, unknown>, creating: boolean): void {
  for (const [key, value] of Object.entries(fields)) {
    const at = `fields.${key}`;
    if (!ISSUE_INPUT_FIELDS.includes(key) && !/^customfield_[0-9]+$/.test(key)) {
      throw invalidValue("Issue field", "be a documented field or customfield_N", echoable(at), "Use a documented field, customfield_N, or api request for the full provider contract.");
    }
    if (key.startsWith("customfield_")) continue;
    if (key === "description" || key === "environment") {
      if (typeof value === "string") fields[key] = adf(requiredText(at, value));
      else if (value !== null) checkDocument(value, at);
      continue;
    }
    if (key === "summary") requiredText(at, value);
    if (["project", "issuetype", "priority", "parent", "assignee", "reporter"].includes(key)) {
      if (key === "assignee" && value === null) continue;
      const selectors = key === "project" || key === "parent" ? ["id", "key"] : key === "assignee" || key === "reporter" ? ["accountId"] : ["id"];
      if (!isRecord(value) || Object.keys(value).length !== 1 || !selectors.some((selector) => typeof value[selector] === "string" && value[selector] !== "")) {
        throw inputError(at, `contain exactly one of ${selectors.join(", ")} as a nonempty string`, value, `Supply ${at} with an explicit identifier.`);
      }
      for (const [selector, id] of Object.entries(value)) validateId(`${at}.${selector}`, id as string);
    }
    if (key === "labels" && (!Array.isArray(value) || !value.every((label) => typeof label === "string" && label.trim() !== ""))) {
      throw inputError(at, "be an array of nonblank strings", value, "Supply labels as strings, or [] to clear them.");
    }
    if (["components", "fixVersions", "versions"].includes(key)) {
      if (!Array.isArray(value)) {
        throw inputError(at, "be an array of objects containing only a nonempty id string", value, "Supply [{\"id\":\"10001\"}], or [] to clear the list.");
      }
      value.forEach((item, index) => {
        if (!isRecord(item) || Object.keys(item).length !== 1 || typeof item.id !== "string") {
          throw inputError(`${at}[${index}]`, "be an object containing only a nonempty id string", item, "Supply {\"id\":\"10001\"}.");
        }
        validateId(`${at}[${index}].id`, item.id);
      });
    }
    if (key === "duedate" && value !== null) {
      parseCalendarDate(at, requiredText(at, value));
    }
  }
  if (creating) {
    for (const key of ["project", "issuetype", "summary"]) {
      if (fields[key] === undefined) throw inputError(`fields.${key}`, "be supplied to create an issue", undefined, "Supply project, issuetype, and summary in --file or through field options.");
    }
  }
  if (Object.keys(fields).length === 0) throw inputError("fields", "contain at least one field", fields, "Supply a field to change.");
}

function issueBody(context: Context, creating: boolean): { fields: Record<string, unknown> } {
  const file = context.options.string("file");
  if (file !== undefined) {
    const body = readJsonFile("--file", file);
    if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.fields)) {
      throw inputError("--file", "contain an object with only a \"fields\" object", body, "Use {\"fields\":{\"summary\":\"Fix login\"}}; use api request for other provider input.");
    }
    checkIssueFields(body.fields, creating);
    return { fields: body.fields };
  }
  const fields: Record<string, unknown> = {};
  const summary = context.options.string("summary");
  if (summary !== undefined) fields.summary = requiredText("--summary", summary);
  if (context.options.flag("clear-description")) fields.description = null;
  for (const [option, field, selector] of [
    ["project-key", "project", "key"], ["issue-type-id", "issuetype", "id"],
    ["assignee-id", "assignee", "accountId"], ["priority-id", "priority", "id"],
  ] as const) {
    const value = context.options.string(option);
    if (value !== undefined) fields[field] = { [selector]: value };
  }
  if (context.options.has("label")) fields.labels = context.options.strings("label");
  if (context.options.flag("clear-labels")) fields.labels = [];
  if (creating || Object.keys(fields).length > 0) checkIssueFields(fields, creating);
  const description = plainBody(context, "description", false);
  if (description !== undefined) fields.description = description;
  if (!creating && Object.keys(fields).length === 0) {
    throw missingFields("issues update", [...ISSUE_FIELDS.map((option) => option.name), "clear-description", "clear-labels", "file"], true);
  }
  return { fields };
}

export const groups: GroupSpec[] = [
  { path: ["issues"], summary: "Get, search, create, update, delete, assign, and transition issues.", title: "Manage issues." },
  { path: ["issues", "transitions"], summary: "List available issue transitions.", title: "Inspect issue transitions." },
  { path: ["issues", "comments"], summary: "List, get, create, update, and delete comments.", title: "Manage issue comments." },
  { path: ["issues", "worklogs"], summary: "List, get, and create worklogs.", title: "Manage issue worklogs." },
  { path: ["issues", "links"], summary: "Get, create, and delete issue links.", title: "Manage issue links." },
  { path: ["issue-link-types"], summary: "List issue link types.", title: "Inspect issue link types." },
  { path: ["projects"], summary: "List and get projects.", title: "Inspect projects." },
  { path: ["projects", "components"], summary: "List project components.", title: "Inspect project components." },
  { path: ["projects", "versions"], summary: "List project versions.", title: "Inspect project versions." },
  { path: ["users"], summary: "Get and search users.", title: "Inspect users." },
  { path: ["myself"], summary: "Get the authenticated account.", title: "Inspect the authenticated account." },
  { path: ["boards"], summary: "List and get boards.", title: "Inspect boards." },
  { path: ["boards", "sprints"], summary: "List board sprints.", title: "Inspect board sprints." },
  { path: ["sprints"], summary: "List sprint issues and get sprints.", title: "Inspect sprints." },
  { path: ["sprints", "issues"], summary: "List sprint issues.", title: "Inspect sprint issues." },
  ...["fields", "statuses", "priorities", "issue-types"].map((name) => ({ path: [name], summary: `List ${name.replaceAll("-", " ")}.`, title: `Inspect ${name.replaceAll("-", " ")}.` })),
  { path: ["filters"], summary: "List and get saved filters.", title: "Inspect saved filters." },
];

const createOptions = [idOption("project-key", "Project key, such as DEMO."), idOption("issue-type-id", "Issue type ID."), ...ISSUE_FIELDS];
const updateOptions = [...ISSUE_FIELDS, CLEAR_DESCRIPTION, CLEAR_LABELS];
export const commands: RequestCommand[] = [
  {
    path: ["issues", "search"],
    summary: "Search issues using JQL.",
    arguments: [{ name: "JQL", description: "Jira Query Language expression. Quote it as one argument.", check: (value) => requiredText("JQL", value) }],
    options: [FIELD],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "issues",
    pagination: pages(tokenPagination, "Order follows the JQL ORDER BY clause; otherwise Jira chooses the order."),
    output: "Collection envelope. data is an array of issue objects; meta holds profile, next_cursor, and has_more.",
    examples: ["jira issues search \"project = DEMO ORDER BY updated DESC\" --field summary --field status --all --format json"],
    request: (context) => ({ path: `${API}/search/jql`, query: [["jql", context.args[0] ?? ""], ...fieldQuery(context)] }),
  },
  {
    path: ["issues", "get"],
    summary: "Get one issue.",
    arguments: [ISSUE],
    options: [FIELD],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the issue object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira issues get DEMO-1 --field summary --field description --field status"],
    request: (context) => ({ path: `${API}/issue/${target(context)}`, query: fieldQuery(context) }),
  },
  {
    path: ["issues", "create"],
    summary: "Create one issue.",
    arguments: [],
    options: [...createOptions, fileOption(createOptions)],
    effects: { kind: "remote-mutation", summary: "Creates an issue. Requires project, issue type, and summary. Jira may require additional project fields through --file." },
    method: "POST",
    output: "Resource envelope. data is the issue reference object; meta has profile.",
    examples: ["jira issues create --project-key DEMO --issue-type-id 10001 --summary \"Fix login\" --dry-run", "jira issues create --file ./issue.json --yes"],
    request(context) {
      const body = issueBody(context, true);
      const project = body.fields.project as Record<string, string>;
      return { path: `${API}/issue`, body, effect: `Creates an issue in project ${project.key ?? project.id}.` };
    },
  },
  {
    path: ["issues", "update"],
    summary: "Update supplied issue fields.",
    arguments: [ISSUE],
    options: [...updateOptions, fileOption(updateOptions)],
    effects: { kind: "remote-mutation", summary: "Updates supplied fields only. Omitted fields keep their values. Labels replace the complete list; clearing uses --clear-description or --clear-labels." },
    method: "PUT",
    output: "Resource envelope. data is null; meta has profile.",
    examples: ["jira issues update DEMO-1 --summary \"Fix sign-in redirect\" --dry-run", "jira issues update DEMO-1 --clear-description --yes"],
    request: (context) => ({ path: `${API}/issue/${target(context)}`, body: issueBody(context, false), effect: `Updates supplied fields of issue ${context.args[0]}. Omitted fields keep their values.` }),
  },
  {
    path: ["issues", "delete"],
    summary: "Delete an issue.",
    arguments: [ISSUE],
    options: [{ name: "delete-subtasks", type: "boolean", description: "Also delete the issue's subtasks. Without it, Jira refuses issues with subtasks." }],
    effects: { kind: "remote-mutation", summary: `Deletes the issue and optionally its subtasks. ${NO_RESTORE}` },
    method: "DELETE",
    output: "Resource envelope. data is null; meta has profile.",
    examples: ["jira issues delete DEMO-1 --dry-run"],
    request: (context) => ({ path: `${API}/issue/${target(context)}`, query: [["deleteSubtasks", String(context.options.flag("delete-subtasks"))]], effect: `Deletes issue ${context.args[0]}${context.options.flag("delete-subtasks") ? " and its subtasks" : ""}. ${NO_RESTORE}` }),
  },
  {
    path: ["issues", "assign"],
    summary: "Assign or unassign an issue.",
    arguments: [ISSUE],
    options: [idOption("account-id", "Assignee account ID."), { name: "unassign", type: "boolean", conflicts: ["account-id"], description: "Set the assignee to null. The project must allow unassigned issues." }],
    effects: { kind: "remote-mutation", summary: "Changes the assignee. Requires --account-id or --unassign." },
    method: "PUT",
    output: "Resource envelope. data is null; meta has profile.",
    exceptions: [{ rule: "CLI-GRAM-4", reason: "assign preserves Jira's Assign issue operation." }],
    examples: ["jira issues assign DEMO-1 --account-id 5b10a2844c20165700ede21g --dry-run"],
    request(context) {
      if (!context.options.has("account-id") && !context.options.flag("unassign")) throw missingFields("issues assign", ["account-id", "unassign"], false);
      const accountId = context.options.flag("unassign") ? null : context.options.string("account-id");
      return {
        path: `${API}/issue/${target(context)}/assignee`,
        body: { accountId },
        effect: accountId === null ? `Unassigns issue ${context.args[0]}.` : `Assigns issue ${context.args[0]} to account ${accountId}.`,
      };
    },
  },
  {
    path: ["issues", "transitions", "list"],
    summary: "List transitions available for an issue.",
    arguments: [ISSUE],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "transitions",
    unpaginated: FULL_LIST,
    output: "Collection envelope. data is an array of transition objects, including required transition fields; meta has profile.",
    examples: ["jira issues transitions list DEMO-1"],
    request: (context) => ({ path: `${API}/issue/${target(context)}/transitions`, query: [["expand", "transitions.fields"]] }),
  },
  {
    path: ["issues", "transition"],
    summary: "Move an issue through a workflow transition.",
    arguments: [ISSUE],
    options: [idOption("transition-id", "Transition ID from issues transitions list. A status ID is not a transition ID.", true)],
    effects: { kind: "remote-mutation", summary: "Applies a workflow transition. Use api request for transitions that require additional fields." },
    method: "POST",
    output: "Resource envelope. data is null; meta has profile.",
    exceptions: [{ rule: "CLI-GRAM-4", reason: "transition preserves Jira's Transition issue operation and distinguishes workflow movement from a field update." }],
    examples: ["jira issues transition DEMO-1 --transition-id 31 --dry-run"],
    request: (context) => ({
      path: `${API}/issue/${target(context)}/transitions`,
      body: { transition: { id: context.options.string("transition-id") } },
      effect: `Applies transition ${context.options.string("transition-id")} to issue ${context.args[0]}.`,
    }),
  },
  {
    path: ["issues", "comments", "list"],
    summary: "List issue comments.",
    arguments: [ISSUE],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "comments",
    pagination: pages(undefined, "Oldest first, ordered by created."),
    output: "Collection envelope. data is an array of comment objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira issues comments list DEMO-1 --all"],
    request: (context) => ({ path: `${API}/issue/${target(context)}/comment`, query: [["orderBy", "created"]] }),
  },
  {
    path: ["issues", "comments", "get"],
    summary: "Get one issue comment.",
    arguments: [identifier("COMMENT_ID", "Comment ID.")],
    options: [ISSUE_SCOPE],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the comment object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira issues comments get 10010 --issue DEMO-1"],
    request: (context) => ({ path: `${issueScope(context)}/comment/${target(context)}` }),
  },
  {
    path: ["issues", "comments", "create"],
    summary: "Create an issue comment.",
    arguments: [ISSUE],
    options: [BODY, BODY_FILE],
    effects: { kind: "remote-mutation", summary: "Adds a comment. Requires --body or --body-file." },
    method: "POST",
    output: "Resource envelope. data is the comment object; meta has profile.",
    examples: ["jira issues comments create DEMO-1 --body \"Ready for review.\" --dry-run"],
    request: (context) => ({
      path: `${API}/issue/${target(context)}/comment`,
      body: { body: plainBody(context) },
      effect: `Adds a comment to issue ${context.args[0]}.`,
    }),
  },
  {
    path: ["issues", "comments", "update"],
    summary: "Update an issue comment's body.",
    arguments: [identifier("COMMENT_ID", "Comment ID.")],
    options: [ISSUE_SCOPE, BODY, BODY_FILE],
    effects: { kind: "remote-mutation", summary: "Replaces the comment body. Requires --body or --body-file. Other comment fields remain unchanged." },
    method: "PUT",
    output: "Resource envelope. data is the comment object; meta has profile.",
    examples: ["jira issues comments update 10010 --issue DEMO-1 --body \"Review complete.\" --dry-run"],
    request: (context) => ({
      path: `${issueScope(context)}/comment/${target(context)}`,
      body: { body: plainBody(context) },
      effect: `Replaces the body of comment ${context.args[0]} on issue ${context.options.string("issue")}. Other comment fields keep their values.`,
    }),
  },
  {
    path: ["issues", "comments", "delete"],
    summary: "Delete an issue comment.",
    arguments: [identifier("COMMENT_ID", "Comment ID.")],
    options: [ISSUE_SCOPE],
    effects: { kind: "remote-mutation", summary: `Deletes the comment. ${NO_RESTORE}` },
    method: "DELETE",
    output: "Resource envelope. data is null; meta has profile.",
    examples: ["jira issues comments delete 10010 --issue DEMO-1 --dry-run"],
    request: (context) => ({ path: `${issueScope(context)}/comment/${target(context)}`, effect: `Deletes comment ${context.args[0]} on issue ${context.options.string("issue")}. ${NO_RESTORE}` }),
  },
  {
    path: ["issues", "worklogs", "list"],
    summary: "List issue worklogs.",
    arguments: [ISSUE],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "worklogs",
    pagination: pages(undefined, "Oldest first, ordered by created."),
    output: "Collection envelope. data is an array of worklog objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira issues worklogs list DEMO-1 --all"],
    request: (context) => ({ path: `${API}/issue/${target(context)}/worklog` }),
  },
  {
    path: ["issues", "worklogs", "get"],
    summary: "Get one issue worklog.",
    arguments: [identifier("WORKLOG_ID", "Worklog ID.")],
    options: [ISSUE_SCOPE],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the worklog object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira issues worklogs get 10020 --issue DEMO-1"],
    request: (context) => ({ path: `${issueScope(context)}/worklog/${target(context)}` }),
  },
  {
    path: ["issues", "worklogs", "create"],
    summary: "Create an issue worklog.",
    arguments: [ISSUE],
    options: [
      { name: "time-spent-seconds", type: "integer", placeholder: "N", min: 1, required: true, description: "Time spent, in positive whole seconds." },
      { name: "started", type: "date", placeholder: "DATE", required: true, description: `Work start instant. Accepts YYYY-MM-DD (00:00 UTC) or ${DATE_TIME_FORM}.` },
      text("comment", "Plain-text worklog comment, sent literally as an Atlassian Document Format (ADF) document."),
      {
        ...BODY_FILE,
        conflicts: ["comment"],
        description: "Read the plain-text worklog comment from PATH. - reads stdin. Blank content is rejected.",
      },
      { name: "adjust-estimate", type: "enum", placeholder: "MODE", choices: ["auto", "leave"], default: "auto", description: "Adjust the remaining estimate automatically or leave it unchanged." },
    ],
    effects: { kind: "remote-mutation", summary: "Adds a worklog and, with Jira's default auto mode, adjusts the remaining estimate. --adjust-estimate leave keeps it unchanged. --started is an instant, not a filter boundary; date-only input means 00:00 UTC." },
    method: "POST",
    output: "Resource envelope. data is the worklog object; meta has profile.",
    examples: ["jira issues worklogs create DEMO-1 --time-spent-seconds 3600 --started 2026-10-21T09:00:00Z --adjust-estimate leave --dry-run"],
    request(context) {
      const comment = plainBody(context, "comment", false);
      return {
        path: `${API}/issue/${target(context)}/worklog`,
        query: query(context, { "adjust-estimate": "adjustEstimate" }),
        body: {
          timeSpentSeconds: context.options.number("time-spent-seconds"),
          started: new Date(context.options.string("started") ?? "").toISOString().replace(/Z$/, "+0000"),
          ...(comment === undefined ? {} : { comment }),
        },
        effect: `Records ${context.options.number("time-spent-seconds")} seconds on issue ${context.args[0]}. ${context.options.string("adjust-estimate") === "leave" ? "Keeps" : "Automatically adjusts"} the remaining estimate.`,
      };
    },
  },
  {
    path: ["issues", "links", "get"],
    summary: "Get one issue link.",
    arguments: [identifier("LINK_ID", "Issue link ID from an issue's issuelinks field.")],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the issue link object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira issues links get 10030"],
    request: (context) => ({ path: `${API}/issueLink/${target(context)}` }),
  },
  {
    path: ["issues", "links", "create"],
    summary: "Create a link between two issues.",
    arguments: [identifier("ISSUE_KEY", "Outward issue key, such as DEMO-1.")],
    options: [idOption("type-id", "Issue link type ID from issue-link-types list.", true), idOption("inward-issue-key", "Inward issue key. The positional issue is the outward issue.", true)],
    effects: { kind: "remote-mutation", summary: "Creates an issue link with ISSUE_KEY as outwardIssue and --inward-issue-key as inwardIssue." },
    method: "POST",
    output: "Resource envelope. data is null; meta has profile.",
    examples: ["jira issues links create DEMO-1 --inward-issue-key DEMO-2 --type-id 10000 --dry-run"],
    request: (context) => ({
      path: `${API}/issueLink`,
      body: {
        type: { id: context.options.string("type-id") },
        outwardIssue: { key: context.args[0] },
        inwardIssue: { key: context.options.string("inward-issue-key") },
      },
      effect: `Creates a link of type ${context.options.string("type-id")} from outward issue ${context.args[0]} to inward issue ${context.options.string("inward-issue-key")}.`,
    }),
  },
  {
    path: ["issues", "links", "delete"],
    summary: "Delete an issue link.",
    arguments: [identifier("LINK_ID", "Issue link ID from an issue's issuelinks field.")],
    options: [],
    effects: { kind: "remote-mutation", summary: `Deletes the link, preserving both issues. ${NO_RESTORE} A new link can be created.` },
    method: "DELETE",
    output: "Resource envelope. data is null; meta has profile.",
    examples: ["jira issues links delete 10030 --dry-run"],
    request: (context) => ({ path: `${API}/issueLink/${target(context)}`, effect: `Deletes link ${context.args[0]}, preserving both issues. ${NO_RESTORE} A new link can be created.` }),
  },
  {
    path: ["issue-link-types", "list"],
    summary: "List issue link types.",
    arguments: [],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "issueLinkTypes",
    unpaginated: FULL_LIST,
    output: "Collection envelope. data is an array of issue link types; meta has profile.",
    examples: ["jira issue-link-types list"],
    request: () => ({ path: `${API}/issueLinkType` }),
  },
  {
    path: ["projects", "list"],
    summary: "List projects.",
    arguments: [],
    options: [text("query", "Match project name or key.")],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "values",
    pagination: pages(),
    output: "Collection envelope. data is an array of project objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira projects list --all"],
    request: (context) => ({ path: `${API}/project/search`, query: query(context, { query: "query" }) }),
  },
  {
    path: ["projects", "get"],
    summary: "Get one project.",
    arguments: [PROJECT],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the project object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira projects get DEMO"],
    request: (context) => ({ path: `${API}/project/${target(context)}` }),
  },
  ...["components", "versions"].map((name): RequestCommand => ({
    path: ["projects", name, "list"],
    summary: `List project ${name}.`,
    arguments: [PROJECT],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "values",
    pagination: pages(),
    output: `Collection envelope. data is an array of ${name === "components" ? "component" : "version"} objects; meta holds profile, next_cursor, has_more, and provider.total when returned.`,
    examples: [`jira projects ${name} list DEMO --all`],
    request: (context) => ({ path: `${API}/project/${target(context)}/${name === "components" ? "component" : "version"}` }),
  })),
  {
    path: ["users", "get"],
    summary: "Get one user.",
    arguments: [identifier("ACCOUNT_ID", "Account ID, not email or username.")],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the user object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira users get 5b10a2844c20165700ede21g"],
    request: (context) => ({ path: `${API}/user`, query: [["accountId", context.args[0] ?? ""]] }),
  },
  {
    path: ["users", "search"],
    summary: "Search users by display name or email.",
    arguments: [{ name: "QUERY", description: "Text matched against display name or email, subject to privacy settings.", check: (value) => requiredText("QUERY", value) }],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    collection: true,
    pagination: { ...pages(userPagination, "Jira filters users before paging matches. Only the first 1,000 matches are available; a full page reaching that boundary reports has_more true with no cursor."), window: 1000 },
    output: "Collection envelope. data is an array of user objects; meta holds profile, next_cursor, and has_more.",
    examples: ["jira users search \"Ada\" --all"],
    request: (context) => ({ path: `${API}/user/search`, query: [["query", context.args[0] ?? ""]] }),
  },
  {
    path: ["myself", "get"],
    summary: "Get the authenticated account.",
    arguments: [],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the account object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira myself get"],
    request: () => ({ path: `${API}/myself` }),
  },
  {
    path: ["boards", "list"],
    summary: "List boards.",
    arguments: [],
    options: [text("name", "Filter by board name."), { name: "type", type: "enum", placeholder: "TYPE", choices: ["scrum", "kanban", "simple"], description: "Board type." }, idOption("project", "Project ID or key.")],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "values",
    pagination: pages(),
    output: "Collection envelope. data is an array of board objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira boards list --type scrum --all"],
    request: (context) => ({ path: `${AGILE}/board`, query: query(context, { name: "name", type: "type", project: "projectKeyOrId" }) }),
  },
  {
    path: ["boards", "get"],
    summary: "Get one board.",
    arguments: [BOARD],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the board object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira boards get 10"],
    request: (context) => ({ path: `${AGILE}/board/${target(context)}` }),
  },
  {
    path: ["boards", "sprints", "list"],
    summary: "List a board's sprints.",
    arguments: [BOARD],
    options: [{ name: "state", type: "enum", placeholder: "STATE", choices: ["future", "active", "closed"], repeatable: true, description: "Sprint state to include." }],
    effects: { kind: "read", summary: "The board must support sprints." },
    method: "GET",
    collectionKey: "values",
    pagination: pages(undefined, "Jira orders sprints by state, then position."),
    output: "Collection envelope. data is an array of sprint objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira boards sprints list 10 --state active --state future --all"],
    request: (context) => ({ path: `${AGILE}/board/${target(context)}/sprint`, query: context.options.has("state") ? [["state", context.options.strings("state").join(",")]] : [] }),
  },
  {
    path: ["sprints", "get"],
    summary: "Get one sprint.",
    arguments: [SPRINT],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the sprint object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira sprints get 20"],
    request: (context) => ({ path: `${AGILE}/sprint/${target(context)}` }),
  },
  {
    path: ["sprints", "issues", "list"],
    summary: "List issues in a sprint.",
    arguments: [SPRINT],
    options: [FIELD, text("jql", "Additional JQL filter.", { placeholder: "JQL" })],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "issues",
    pagination: pages(tokenPagination, "Ordered by rank unless the JQL specifies another order."),
    output: "Collection envelope. data is an array of issue objects; meta holds profile, next_cursor, and has_more.",
    examples: ["jira sprints issues list 20 --field summary --field status --all"],
    request: (context) => ({ path: `/rest/software/1.0/sprint/${target(context)}/issue`, query: [...fieldQuery(context), ...query(context, { jql: "jql" })] }),
  },
  ...([
    ["fields", "field", "field"], ["statuses", "status", "status"],
    ["priorities", "priority/search", "priority"], ["issue-types", "issuetype", "issue type"],
  ] as const).map(([name, route, noun]): RequestCommand => ({
    path: [name, "list"],
    summary: `List ${name.replaceAll("-", " ")}.`,
    arguments: [],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    ...(name === "priorities" ? { collectionKey: "values", pagination: pages() } : { collection: true, unpaginated: FULL_LIST }),
    output: name === "priorities"
      ? "Collection envelope. data is an array of priority objects; meta holds profile, next_cursor, has_more, and provider.total when returned."
      : `Collection envelope. data is an array of ${noun} objects; meta has profile.`,
    examples: [`jira ${name} list`],
    request: () => ({ path: `${API}/${route}` }),
  })),
  {
    path: ["filters", "list"],
    summary: "List saved filters.",
    arguments: [],
    options: [text("name", "Filter name to match."), idOption("owner-id", "Filter owner's account ID.")],
    effects: { kind: "read" },
    method: "GET",
    collectionKey: "values",
    pagination: pages(),
    output: "Collection envelope. data is an array of saved filter objects; meta holds profile, next_cursor, has_more, and provider.total when returned.",
    examples: ["jira filters list --all"],
    request: (context) => ({ path: `${API}/filter/search`, query: query(context, { name: "filterName", "owner-id": "accountId" }) }),
  },
  {
    path: ["filters", "get"],
    summary: "Get one saved filter.",
    arguments: [identifier("FILTER_ID", "Saved filter ID.")],
    options: [],
    effects: { kind: "read" },
    method: "GET",
    output: "Resource envelope. data is the saved filter object; meta has profile.",
    emptyIsNotFound: true,
    examples: ["jira filters get 10040"],
    request: (context) => ({ path: `${API}/filter/${target(context)}` }),
  },
];
