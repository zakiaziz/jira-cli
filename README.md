# jira-cli

Command-line interface for the Jira Cloud API. It reads and manages issues, comments, worklogs, and issue links, and inspects projects, users, boards, sprints, fields, and saved filters. Each profile is locked to read or write access, so a read-only profile never changes Jira state. It is not an official Jira product.

## Install

Requires Node.js 22 or newer.

```bash
npm install -g @zakiaziz/jira-cli
bun add -g @zakiaziz/jira-cli
cd jira-cli && bun run build && bun link
```

## Quick start

```bash
jira setup work --site acme --email ada@example.com --access read
# Verify the account email and API token.
jira auth verify
# Search issues using JQL.
jira issues search 'project = PROJ ORDER BY updated DESC' --field summary --field status
# Get one issue.
jira issues get PROJ-1
```

Shell completion: `jira completions bash > ~/.bash/profile.d/jira.sh`.

## Commands

### boards

| Command | Description | Options |
| --- | --- | --- |
| jira boards list | List boards. | --name TEXT, --type TYPE, --project PROJECT, --page-size N, --cursor TOKEN, --all, --max-items N |
| jira boards get BOARD_ID | Get one board. | None |
| jira boards columns list BOARD_ID | List board columns and statuses. | --status NAME |
| jira boards sprints list BOARD_ID | List a board's sprints. | --state STATE, --page-size N, --cursor TOKEN, --all, --max-items N |

### fields

| Command | Description | Options |
| --- | --- | --- |
| jira fields list | List fields. | None |

### filters

| Command | Description | Options |
| --- | --- | --- |
| jira filters list | List saved filters. | --name TEXT, --owner-id OWNER_ID, --page-size N, --cursor TOKEN, --all, --max-items N |
| jira filters get FILTER_ID | Get one saved filter. | None |

### issue-link-types

| Command | Description | Options |
| --- | --- | --- |
| jira issue-link-types list | List issue link types. | None |

### issue-types

| Command | Description | Options |
| --- | --- | --- |
| jira issue-types list | List issue types. | None |

### issues

| Command | Description | Options |
| --- | --- | --- |
| jira issues get ISSUE | Get one issue. | --field FIELD |
| jira issues search JQL | Search issues using JQL. | --field FIELD, --in-current-status-for DURATION, --no-parent, --parent KEY, --page-size N, --cursor TOKEN, --all, --max-items N |
| jira issues create | Create one issue. | --project-key PROJECT_KEY, --issue-type-id ISSUE_TYPE_ID, --summary TEXT, --description TEXT, --body-file PATH, --assignee-id ASSIGNEE_ID, --priority-id PRIORITY_ID, --label LABEL, --file PATH, --yes, --dry-run |
| jira issues update ISSUE | Update supplied issue fields. | --summary TEXT, --description TEXT, --body-file PATH, --assignee-id ASSIGNEE_ID, --priority-id PRIORITY_ID, --label LABEL, --clear-description, --clear-labels, --file PATH, --yes, --dry-run |
| jira issues delete ISSUE | Delete an issue. | --delete-subtasks, --yes, --dry-run |
| jira issues assign ISSUE | Assign or unassign an issue. | --account-id ACCOUNT_ID, --unassign, --yes, --dry-run |
| jira issues transition ISSUE_KEY... | Move issues through workflow transitions. | --transition-id TRANSITION_ID, --to-status NAME, --yes, --dry-run |
| jira issues changelog list ISSUE_KEY | List issue changelogs. | None |
| jira issues children list PARENT_KEY | List child issues. | None |
| jira issues comments list ISSUE | List issue comments. | --page-size N, --cursor TOKEN, --all, --max-items N |
| jira issues comments get COMMENT_ID | Get one issue comment. | --issue ISSUE |
| jira issues comments create ISSUE | Create an issue comment. | --body TEXT, --body-file PATH, --yes, --dry-run |
| jira issues comments update COMMENT_ID | Update an issue comment's body. | --issue ISSUE, --body TEXT, --body-file PATH, --yes, --dry-run |
| jira issues comments delete COMMENT_ID | Delete an issue comment. | --issue ISSUE, --yes, --dry-run |
| jira issues links get LINK_ID | Get one issue link. | None |
| jira issues links create ISSUE_KEY | Create a link between two issues. | --type-id TYPE_ID, --inward-issue-key INWARD_ISSUE_KEY, --yes, --dry-run |
| jira issues links delete LINK_ID | Delete an issue link. | --yes, --dry-run |
| jira issues status-history list ISSUE_KEY... | List issue status changes. | None |
| jira issues transitions list ISSUE | List transitions available for an issue. | None |
| jira issues worklogs list ISSUE | List issue worklogs. | --page-size N, --cursor TOKEN, --all, --max-items N |
| jira issues worklogs get WORKLOG_ID | Get one issue worklog. | --issue ISSUE |
| jira issues worklogs create ISSUE | Create an issue worklog. | --time-spent-seconds N, --started DATE, --comment TEXT, --body-file PATH, --adjust-estimate MODE, --yes, --dry-run |

### myself

| Command | Description | Options |
| --- | --- | --- |
| jira myself get | Get the authenticated account. | None |

### priorities

| Command | Description | Options |
| --- | --- | --- |
| jira priorities list | List priorities. | --page-size N, --cursor TOKEN, --all, --max-items N |

### projects

| Command | Description | Options |
| --- | --- | --- |
| jira projects list | List projects. | --query TEXT, --page-size N, --cursor TOKEN, --all, --max-items N |
| jira projects get PROJECT | Get one project. | None |
| jira projects components list PROJECT | List project components. | --page-size N, --cursor TOKEN, --all, --max-items N |
| jira projects versions list PROJECT | List project versions. | --page-size N, --cursor TOKEN, --all, --max-items N |

### sprints

| Command | Description | Options |
| --- | --- | --- |
| jira sprints get SPRINT_ID | Get one sprint. | None |
| jira sprints issues list SPRINT_ID | List issues in a sprint. | --field FIELD, --jql JQL, --page-size N, --cursor TOKEN, --all, --max-items N |

### statuses

| Command | Description | Options |
| --- | --- | --- |
| jira statuses list | List statuses. | None |

### users

| Command | Description | Options |
| --- | --- | --- |
| jira users get ACCOUNT_ID | Get one user. | None |
| jira users search QUERY | Search users by display name or email. | --page-size N, --cursor TOKEN, --all, --max-items N |

### setup

| Command | Description | Options |
| --- | --- | --- |
| jira setup [NAME] | Create and activate a profile. | --email EMAIL, --api-token-file PATH, --base-url URL, --site NAME, --access ACCESS |

### profiles

| Command | Description | Options |
| --- | --- | --- |
| jira profiles list | List saved profiles. | None |
| jira profiles get NAME | Get one saved profile with secrets redacted. | None |
| jira profiles create NAME | Create a profile without activating it. | --email EMAIL, --api-token-file PATH, --base-url URL, --site NAME, --access ACCESS |
| jira profiles update NAME | Update fields of a profile. | --email EMAIL, --api-token-file PATH, --base-url URL, --site NAME, --clear-base-url, --clear-site, --access ACCESS |
| jira profiles delete NAME | Delete a profile. | None |
| jira profiles use NAME | Make a profile the active profile. | None |

### config

| Command | Description | Options |
| --- | --- | --- |
| jira config list | List every configuration key. | None |
| jira config get KEY | Get one configuration value. | None |
| jira config path | Get the configuration paths. | None |

### auth

| Command | Description | Options |
| --- | --- | --- |
| jira auth verify | Verify the email and API token. | None |

### api

| Command | Description | Options |
| --- | --- | --- |
| jira api request METHOD PATH | Send a raw API request. | --query KEY=VALUE, --file PATH, --yes, --dry-run |

### completions

| Command | Description | Options |
| --- | --- | --- |
| jira completions SHELL | Print a shell completion script. | None |

## Global options

| Option | Description |
| --- | --- |
| -h, --help | Show help. Uses no credentials or network. |
| --version | Print the executable name and version. |
| --profile NAME | Select a saved profile. |
| --format FORMAT | Output format. Allowed: json, pretty, human. Default: human. |
| --color WHEN | Color for pretty and human output. Allowed: auto, always, never. Default: auto. |
| -q, --quiet | Suppress progress and notices. Results and errors still print. |
| -v, --verbose | Print redacted diagnostics to stderr. |
| --no-input | Never prompt. Fail when input is missing. |
| --timeout DURATION | Per-request timeout in ms, s, or m, from 1ms to 10m. Default: 30s. |

Network commands (the resource commands, `auth verify`, and `api request`) accept every option except `--version`. Local commands (`setup`, `profiles`, and `config`) accept `--help`, `--format`, `--color`, `--quiet`, `--verbose`, and `--no-input`. `completions` accepts only `--help`. With no command, only `--help`, `--version`, `--verbose`, and `--quiet` apply, and `--version` with a command word fails.

## Authentication

The CLI uses an Atlassian account email and API token as HTTP Basic authentication. Create a token for direct access to your Jira site:

1. Open [API tokens in your account security settings](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Choose **Create API token**, enter a label, choose an expiration date, and create the token. Choose the token without scopes for this site's authentication flow.
3. Copy the token. Run `jira setup work --site acme --email ada@example.com --access read` and paste it at the hidden prompt.
4. Run `jira auth verify --profile work`.

`setup [NAME]` creates a profile (default name: `default`) and makes it the active profile. It fails when the profile exists. If activation fails after the profile is written, the profile stays saved and `setup` exits 8 with `PARTIAL_FAILURE`. In a terminal without `--no-input`, `setup` prompts for the missing fields: the email and access level with visible input, and the API token with hidden input. Without a terminal, missing credentials or access fail. Secrets are never command-line values: pass `--api-token-file PATH` (`-` reads stdin) or enter the API token at the prompt. The email is not secret: pass `--email EMAIL` or enter it at the prompt.

```bash
jira profiles create automation --site acme --email ada@example.com --api-token-file ./token.txt --access read --no-input
jira profiles use automation
jira auth verify --profile automation --format json
```

`--site NAME` derives `https://NAME.atlassian.net`. Supply the name only, such as `acme`. An optional `--base-url URL` replaces site derivation. These options conflict on creation; a stored base URL takes precedence over a stored site. `profiles update NAME --clear-base-url` resumes site derivation. This client uses site URLs, not the gateway path required by scoped tokens.

Every profile stores an access level, `read` or `write`, and `setup` and `profiles create` require it; there is no default. With `read`, every mutation fails with `PERMISSION_DENIED` (exit 4) before anything is sent, `--dry-run` included, and the error names the profile and the command that allows mutations. With `write`, mutations run after confirmation. The access level is a local lock; Jira still enforces the account's project permissions, issue security, and application access. Change access explicitly with `jira profiles update work --access write`.

An unscoped Atlassian API token carries the account's permissions. A read profile does not restrict the token outside this CLI. Jira also enforces account privacy settings.

Credentials and endpoint settings come only from a profile. No environment variable supplies them or selects a profile, so a scheduled job passes `--profile NAME` explicitly. Profile selection is `--profile NAME`, otherwise `activeProfile` in `config.json`. A selected or active profile that does not exist, and no profile at all, fail with `CONFIGURATION_ERROR` and no fallback. The hint points to `jira setup NAME` or `jira profiles use NAME`.

The CLI reads three environment variables, and none supplies credentials, endpoints, or a profile:

| Variable | Purpose |
| --- | --- |
| `XDG_CONFIG_HOME` | Configuration root when it is an absolute path. Otherwise `~/.config`. |
| `NO_COLOR` | Disables color with `--color auto` when set and nonempty. |
| `CI` | Disables prompts when nonempty and not `0` or `false`. |

Stored in the profile:

- Account email: `email`, from the visible prompt or `--email EMAIL`.
- API token: `apiToken`, from the hidden prompt or `--api-token-file PATH`.
- Access level: `access`, `read` or `write`.
- Endpoint: `baseUrl` or `site` in the profile. A stored base URL beats the site. Jira has no shared host, so the base URL has no default: a profile with neither fails requests and `--dry-run` with `CONFIGURATION_ERROR`.

`jira auth verify` sends `GET /rest/api/3/myself`. Success proves that Jira accepted the account email and API token and identifies the account (`accountId`, `displayName`, `emailAddress`, `active`, `accountType`, when returned). It does not prove complete permission coverage.

## Output and errors

The default output format is `human`: tables for collections and labeled fields for one resource, whatever the terminal. Nested objects and arrays inside one resource print as indented fields and lists, and a table cell shows a short summary such as a name or `N items`, never raw JSON. A dry run prints `dry_run` and `validation`, then each request on its own lines. `--format json` prints one compact, uncolored line on stdout with the envelope `{"data":...,"meta":{...}}`, and scripts and agents pass it explicitly. `--format pretty` prints the same document indented, with syntax highlighting when color applies. With `--format pretty` or the default `human` format and stderr on a terminal, a command that sends a request first prints one gray line, `Profile: NAME`, to stderr. `--quiet` suppresses it, and `--format json` never prints it. Errors go to stderr in the selected format, so the default error is the `human` text. Help, `--version`, and `completions` print plain text. The bare command and a command group with no action print the same help as `--help` on stdout, exit 0; an unknown action fails with exit 2.

`data` is an object for one resource, an array for a collection, or `null` when Jira returns no content, and keeps Jira's field names. `meta` is always present.

| `meta` key | When |
| --- | --- |
| `profile` | Every command that sends a request. The name of the profile that served it. |
| `next_cursor` | Paginated collection reads. A string, or `null` when no page remains. |
| `has_more` | Paginated collection reads. |
| `provider` | `total` for offset-paginated collections, when Jira returns it. |
| `dry_run`, `validation` | Dry-run previews. `validation` is `local`. |

Errors go to stderr. Jira `errorMessages` are combined with `errors` entries prefixed by the field name. `x-arequestid`, `atl-traceid`, or `x-request-id` supplies the request ID. HTTP 400/422 map to `INVALID_REQUEST`, 401 to `AUTHENTICATION_FAILED`, 403 to `PERMISSION_DENIED`, 404 to `NOT_FOUND`, 409/412 to `CONFLICT`, and 429 to `RATE_LIMITED`. HTTP 500/502/503/504, timeouts, and network failures map to `TRANSIENT_FAILURE`; unmapped failures use `PROVIDER_ERROR`.

With `--format json`, errors print one compact document on stderr, for example `{"error":{"code":"RATE_LIMITED","message":"...","hint":"...","retryable":true,"provider":{"status":429}}}`. Optional keys are `hint`, `outcome` (`unknown` when a mutation may have applied), `provider` (`status`, `code`, `request_id`, `retry_after_seconds`), `details`, and `partial`. The default `human` format prints `Error [CODE]: message` and `Hint: ...`. Credentials and encoded Basic authentication values are scrubbed from errors and previews.

| Exit | Error codes |
| --- | --- |
| 0 | Success, including empty collections. |
| 1 | `UNEXPECTED_ERROR`, `PROVIDER_ERROR`, `INVALID_RESPONSE`, `UNSUPPORTED_RESPONSE` |
| 2 | `INVALID_ARGUMENT`, `INVALID_REQUEST` |
| 3 | `CONFIGURATION_ERROR`, `AUTHENTICATION_REQUIRED`, `AUTHENTICATION_FAILED` |
| 4 | `PERMISSION_DENIED` |
| 5 | `NOT_FOUND` |
| 6 | `CONFLICT` |
| 7 | `RATE_LIMITED`, `TRANSIENT_FAILURE` |
| 8 | `PARTIAL_FAILURE` |
| 9 | `CONFIRMATION_REQUIRED`, `CONFIRMATION_DECLINED` |
| 130 | `INTERRUPTED` |

Descriptions, comment bodies, and worklog comments accept plain text. The CLI wraps text in a minimal Atlassian Document Format (ADF) document with one paragraph per line. All output formats keep the provider's ADF document structure. Human output renders its nested fields and lists. Raw API requests preserve the provider body.

```bash
jira profiles update work --access write
jira issues create --project-key PROJ --issue-type-id 10001 --summary 'Fix login' --description 'Preserve the redirect.' --dry-run
jira issues update PROJ-1 --body-file ./description.txt --dry-run
jira issues comments create PROJ-1 --body 'Ready for review.' --dry-run
jira issues transitions list PROJ-1
jira issues transition PROJ-1 --transition-id 31 --dry-run
```

IDs are opaque strings. Options accept `--name value` and `--name=value`, and `--` ends options. Unknown commands, options, extra arguments, invalid values, and conflicting options fail with exit code 2 before any request.

`--field FIELD` selects one field, such as `summary`, or a wildcard (`*all`, `*navigable`) or exclusion (`-comment`). Repeat it to select several fields; the values are joined with commas in one request. Use `--field=-comment` for a value that starts with `-`. Issue search defaults to `*navigable`, and issue get defaults to `*all`. Both always request `parent`; excluding it fails before any request. The duration filter also requires `status` and `created` and rejects their exclusion. Sprint issue reads keep Jira's default field selection.

Use `--body-file PATH` for plain-text content; `-` reads stdin. It conflicts with the corresponding text option. Ordinary text is literal, so `@filename` is not a file reference. Blank text fails. On updates, omitted fields remain unchanged. `--clear-description` sends null, and `--clear-labels` sends an empty list. Repeated `--label` values replace the complete list.

Issue creation and update also accept `--file PATH`, which conflicts with every field option. The complete input is an object containing only `fields`:

```json
{
  "fields": {
    "project": {"key": "PROJ"},
    "issuetype": {"id": "10001"},
    "summary": "Fix login",
    "description": "Preserve the redirect.",
    "customfield_10010": {"value": "Customer reported"}
  }
}
```

Supported fields are `project`, `issuetype`, `summary`, `description`, `environment`, `assignee`, `priority`, `labels`, `parent`, `components`, `fixVersions`, `versions`, `reporter`, `duedate`, and `customfield_N`. Creation requires `project`, `issuetype`, and `summary`; project configuration can require more. Updates require at least one field. `description` and `environment` accept plain text, null, or structurally validated ADF. Jira validates node semantics and project-specific custom field values. Custom fields accept explicit JSON values, including null. `duedate` is a calendar date in `YYYY-MM-DD`, with no time or timezone conversion, or null. Assignee null unassigns an issue. Reference objects use `id`, except assignee and reporter use `accountId`; project and parent also accept `key`. Reference lists contain objects with `id`. Other provider inputs, such as `update` operations and transition-specific fields, use `api request`.

`issues assign` requires `--account-id` or `--unassign`. `issues transition` requires exactly one of `--to-status NAME` and `--transition-id TRANSITION_ID`. A transition ID comes from `issues transitions list` and is not a status ID. Comment get/update/delete commands and worklog get use the resource ID as their positional and `--issue ISSUE` for scope. Link creation uses an outward issue key as its positional and `--inward-issue-key` for the inward issue; consult `issue-link-types list` for each type's inward and outward labels.

`issues worklogs create --started` accepts ISO 8601 `YYYY-MM-DD` as 00:00 UTC or `YYYY-MM-DDTHH:MM:SS[.fff](Z|+HH:MM)`. It is a work start instant, not a filter boundary. The CLI sends it in Jira's timestamp format with milliseconds and a numeric UTC offset. `--time-spent-seconds` is a positive whole number. Jira's default `adjustEstimate=auto` adjusts the remaining estimate; `--adjust-estimate leave` preserves it.

Mutations (every `create`, `update`, `delete`, `assign`, and `transition` command, and `api request` with `POST`, `PUT`, `PATCH`, or `DELETE`) need a profile with write access and confirmation. The CLI validates arguments first, then checks the profile's access level (exit 4 for read access, before anything is sent, `--dry-run` included), then resolves credentials (exit 3 when missing), then asks for confirmation. In a terminal, it shows the profile, operation, request, and effect, then prompts. `--yes` confirms without a prompt. With `--no-input`, a non-terminal stdin or stderr, or CI mode, a missing confirmation exits 9. Ctrl-C or end of input at a prompt exits 130 with `INTERRUPTED`. `--dry-run` prints a redacted preview with headers in the order `Authorization`, `Accept`, `Content-Type`, and sends no mutations. Local previews need a profile but no stored credentials. Status-name transition previews also read the target and require credentials, as described below. A profile with no base URL or site fails with `CONFIGURATION_ERROR`. `--dry-run` with `--yes` still sends no mutations. Content read from stdin never supplies confirmation. Preview success does not guarantee that the request succeeds. Issue, comment, and link deletion have no REST restore operation. Links can be recreated. Issue deletion refuses issues with subtasks unless `--delete-subtasks` explicitly includes them.

Reads make up to 3 attempts on HTTP 429, 500, 502, 503, 504, network errors, and timeouts, waiting 250 ms, then 500 ms, or the `Retry-After` value up to 10 seconds. A `Retry-After` above 10 seconds is not waited on: the command fails with `RATE_LIMITED` and `provider.retry_after_seconds`. Mutations make one attempt. When a mutation times out or Jira answers with a server error, the error carries `outcome: "unknown"`: check the current state before you repeat it. `--timeout` applies to each attempt. `--verbose` writes redacted request, response, and retry diagnostics to stderr.

### Search and parent issues

Use `issues search JQL --all` to fetch every enhanced search page. There is no 100-issue total limit. Repeated tokens and duplicate issue IDs fail instead of looping or returning duplicate rows.

`issues search`, `issues get`, and `issues children list` add a top-level `parent` object with `key` and `summary`, or `null` for an issue without a parent. Jira's original `fields` remain intact. Human search and children output show `parent_key` and `parent_summary`; human get output shows the parent fields.

`issues children list PARENT_KEY` runs `parent = KEY ORDER BY key ASC` and fetches every page without pagination flags. It returns each child's key, summary, status, issue type, and parent. It supports any parent relationship exposed by that JQL, including epics. An accessible parent with no children returns an empty list; search cannot distinguish that from a parent with no visible children.

`--parent KEY` and `--no-parent` are mutually exclusive search filters. The CLI wraps the existing JQL expression before adding the parent condition and preserves its `ORDER BY` clause, including quoted text that contains those words.

```bash
jira issues search 'project = PROJ ORDER BY key ASC' --all --no-parent --format json
jira issues search 'project = PROJ ORDER BY key ASC' --parent PROJ-123 --all --format json
jira issues children list PROJ-123 --format json
```

### Status history and duration

`issues status-history list ISSUE_KEY...` returns one `{key, changes}` object per issue, in input order. Each change contains the changelog `id`, `from` and `to` status objects with `id` and `name`, `author.accountId`, and `created`. Timestamps preserve the provider's instant and millisecond precision, normalized to ISO 8601 UTC. An initial status can have a null `from.id` or `from.name`. An unavailable author account ID is null. Changes sort oldest first, with changelog ID breaking timestamp ties. An issue with no status changes has an empty `changes` array.

One issue uses every page of `GET /rest/api/3/issue/KEY/changelog`. Several issues first resolve keys to IDs through enhanced search, then use `POST /rest/api/3/changelog/bulkfetch` with `fieldIds: ["status"]`. Each bulk request contains at most 1,000 issue IDs and requests up to 1,000 changelogs per page. `nextPageToken` continues the same chunk. Missing or inaccessible keys produce per-item failures. Duplicate input keys, ignoring case, fail before any request.

`issues changelog list ISSUE_KEY` returns every raw changelog entry for all fields, ordered oldest first. Both history commands fetch all pages automatically and accept no pagination flags. For a batch failure, stdout is empty and stderr contains `error.partial.completed` with `{step: ISSUE_KEY, result: {key, changes}}`, `error.partial.failed` with `{step, error}`, and `error.partial.not_attempted`. Exit code 8 signals the failure. A failed page retains its collected changelogs and cursor under the item's `error.details.partial`. For a single issue, these are directly under `error.partial`. These cursors identify internal provider reads; rerun the command to rebuild the complete history.

`issues search JQL --in-current-status-for DURATION` filters the JQL candidate issues using their complete status changelogs. Durations must be positive whole days or hours, such as `14d` or `36h`. Other units, decimals, signs, zero, and unsafe integer seconds fail before any request. The threshold is inclusive. The latest entry into the current status determines its age, including leaving and re-entering that status. An issue with no status changes uses `created`. The calculation never uses `updated`.

Every retained issue includes `current_status_since` as ISO 8601 UTC and `time_in_current_status_seconds` as whole seconds. One clock reading applies to the whole result. An entry whose source and target status IDs are equal does not reset the duration. If no entry changes the status ID, the duration starts at issue creation. If the latest changelog status differs from the issue's current status, the command fails rather than reporting a date from an inconsistent read. Retry after the issue stops changing or search indexing catches up.

The search pagination options bound candidates before duration filtering. Use `--all` for every match. `--max-items` limits candidates, so the filtered result can contain fewer items. Continue with `meta.next_cursor` even when the filtered page is empty and `meta.has_more` is true.

```bash
jira issues status-history list PROJ-123 PROJ-124 --format json
jira issues changelog list PROJ-123 --format json
jira issues search 'status = "Ready" ORDER BY key ASC' --all --in-current-status-for 14d --format json
```

### Board columns

`boards columns list BOARD_ID` reads the board configuration and the status catalog. `data.columns` keeps the board's order. Each column has `name`, a zero-based `position`, and `statuses` containing resolved status IDs and names, including an empty array for an unmapped column.

Repeat `--status NAME` to locate statuses. `data.statuses` then contains each match with its `id`, `name`, and `column: {name, position}`. Matching is exact except for case. Multiple statuses with the same name return all their mappings. A requested name with no mapped column fails `INVALID_ARGUMENT`, names the status and board, and exits 2. A configured status ID missing from the catalog fails `INVALID_RESPONSE`.

```bash
jira boards columns list 10 --status 'Ready' --status 'Done' --format json
```

### Batch transitions

`issues transition ISSUE_KEY... --to-status NAME` reads each issue and finds the available transition whose target status name matches exactly, ignoring case. An issue already in that status succeeds with `skipped: true`; it sends no transition lookup or mutation after the initial issue read. No match or more than one match fails that item and lists the reachable status names and transition IDs. Structured errors include the complete list in `error.details.reachable_statuses` for each failed item. Use `--transition-id TRANSITION_ID` to choose a specific transition. The two options are mutually exclusive.

The command checks write access before any request, including a dry run. Confirmation lists every issue and target together. `--yes` confirms the whole batch. With `--to-status`, `--dry-run` reads issues and available transitions, requires credentials, and prints the resolved requests with `validation: "local and remote read"`. It sends no mutations. With `--transition-id`, previews remain local and need no credentials. A planning failure prevents a successful preview.

After each transition, the command reads the issue again and reports its resulting status. Successful output is an array of `{key, skipped, status: {id, name}}` objects in input order, with `transition_id` for applied transitions. Independent issues continue after failures. Nothing is rolled back. Each transition POST is sent at most once, including after a pooled connection disconnects.

Any failed item exits 8 and reports `error.partial.completed`, `error.partial.failed`, and `error.partial.not_attempted` on stderr; stdout is empty. Completed entries contain `{step: ISSUE_KEY, result: RESULT}`. Failed entries contain `{step, error: {code, message, provider when available, details}}`. If the transition succeeded but the final status read failed or returned another status, the item's `error.details.partial` preserves the completed transition. An uncertain mutation outcome carries `outcome: "unknown"` on the batch and in the failed item's details. Inspect that issue before retrying.

```bash
jira issues transition PROJ-123 PROJ-124 --to-status 'Ready' --dry-run --format json
jira issues transition PROJ-123 PROJ-124 --to-status 'Ready' --yes --format json
jira issues transition PROJ-123 --transition-id 31 --yes --format json
```

## Pagination

Commands with pagination flags fetch one page by default. `--page-size` defaults to 100, and this tool caps it at 100. Jira may return fewer items as its endpoint limits change. Search keeps Jira's order. History commands fetch all pages and sort by timestamp; children also fetch all pages automatically.

`--all` follows every cursor. `--max-items N` (with `--all`) shrinks the last request so the read stops on a page boundary, and `meta.next_cursor` resumes it. `--cursor TOKEN` resumes from a previous `meta.next_cursor`, with or without `--all`. Repeat the same filters when you resume.

- Issue search uses `GET /rest/api/3/search/jql` with `nextPageToken`. The deprecated `/search` endpoint is never used. JQL can specify `ORDER BY`; otherwise Jira chooses the order.
- Sprint issues use the enhanced `GET /rest/software/1.0/sprint/SPRINT_ID/issue`, also with `nextPageToken`, ordered by rank unless JQL specifies an order. Board and sprint metadata use `/rest/agile/1.0`.
- Projects, components, versions, comments, worklogs, boards, board sprints, priorities, and filters use `startAt` and `maxResults`. Cursors are decimal offsets. `total` and `isLast` determine continuation; `total`, when returned, is retained in `meta.provider`.
- User search returns an array without pagination metadata. Cursors are decimal offsets into the matching users and advance by the number of returned users. A short or empty page ends traversal. Jira serves only the first 1,000 matching users; a full page that reaches the limit ends with `has_more: true` and `next_cursor: null` because completeness cannot be established. Narrow the query or use a known account ID.
- Fields, statuses, issue types, issue link types, and available transitions return their visible lists in one response. They accept no pagination flags.

```bash
jira projects list --all --max-items 250 --format json > projects.json
jira projects list --all --cursor "$(jq -r '.meta.next_cursor' projects.json)" --format json
```

Tokens stay opaque. Offset pages advance by the number of returned items. Empty token pages with a continuation are allowed.

A repeated cursor, an oversized page, a repeated page, duplicate search issue IDs, or missing or contradictory paging metadata on the first page fails with `INVALID_RESPONSE` and exit 1. A failure on a later page exits 8 with `PARTIAL_FAILURE`. The items read so far are in `error.partial.data`, `error.partial.next_cursor` points at the first unread item, and `error.details.cause` names the underlying error code, such as `INVALID_RESPONSE`. Search page failures report candidates before duration filtering. A duration calculation can instead fail while reading bulk changelogs; its partial data and cursor belong to that internal bulk request. Do not pass a bulk changelog cursor to `issues search --cursor`. Rerun the command to rebuild the result. Children and history commands also require a rerun after an internal page failure, because they accept no cursor flag. Commands without pagination flags describe whether they read one response or traverse all pages. Jira search indexing can lag behind writes; results are not a transactional snapshot.

## Raw API access

```bash
jira api request GET /rest/api/3/issue/PROJ-1 --query fields=summary,status
jira api request PUT /rest/api/3/issue/PROJ-1 --file ./issue.json --dry-run
```

Methods: `GET`, `HEAD`, `OPTIONS`, `POST`, `PUT`, `PATCH`, `DELETE`. `PATH` starts with a single `/` and has no scheme, host, query string, fragment, whitespace, or `.` and `..` segments. Add query parameters with the repeatable `--query KEY=VALUE`, which keeps exact names such as `fields`. `--file PATH` sends a JSON body as `application/json` (`-` reads stdin). `--file`, `--yes`, and `--dry-run` are rejected on `GET`, `HEAD`, and `OPTIONS`. The CLI sends the selected profile's account email and API token only to the configured API origin. JSON responses print as parsed, other text prints as a JSON string, an empty body prints `null`, and binary responses fail with `UNSUPPORTED_RESPONSE`. Non-2xx responses use the same error mapping as other commands. Raw input follows the provider contract, so ADF must already be valid JSON. Methods other than `GET`, `HEAD`, and `OPTIONS` require write access and confirmation, including raw `POST` searches.

## Configuration

Files live in `$XDG_CONFIG_HOME/jira` when `XDG_CONFIG_HOME` is an absolute path, and in `~/.config/jira` otherwise.

```text
jira/
  config.json            {"activeProfile": "work"}
  profiles/NAME.json     {"email": "ada@example.com", "apiToken": "...", "site": "acme", "access": "read"}
```

Keys are camelCase. Files use mode `0600`, directories use mode `0700`, and writes are atomic: the CLI creates a temporary file exclusively with mode `0600` in the same directory, then renames it. Reads reject unknown keys and non-object JSON with `CONFIGURATION_ERROR`. Profile names match `^[A-Za-z0-9._-]+$` and are not `.` or `..`. `config.json` holds one key, `activeProfile` (read-only through `config`; change it with `profiles use`). Credentials and endpoint settings live only in profile files, and a `config.json` with any other key fails with `CONFIGURATION_ERROR`. Profile fields: `email`, `apiToken`, `baseUrl`, `site`, and `access` (`read` or `write`). A profile without `access`, such as one written by hand, can read, and its mutations fail with `CONFIGURATION_ERROR` until `profiles update NAME --access read|write` sets it. Secrets are redacted in previews, diagnostics, `profiles get`, and `config list`. The email is not secret and is shown unredacted.

A site contains letters, digits, and hyphens, and starts and ends with a letter or digit. A base URL, from `--base-url` or a stored file, must be an `https` URL (`http` only for `localhost`, `127.0.0.1`, or `::1`) with no credentials, query string, fragment, or path. Values are stored unchanged, and requests go to the URL's origin.

Completion scripts come from `jira completions bash|zsh|fish` and read only the command registry and local profile names. They complete commands, options, enum values (after `--OPT ` and `--OPT=`), `METHOD`, `SHELL`, and profile names (after `--profile` and for the `NAME` argument of `profiles get|update|delete|use`). They offer nothing after `--` or after an option that takes a free-form value.

## Exceptions

| Rule | Decision | Reason |
| --- | --- | --- |
| `CLI-GRAM-4` | `issues assign` and `issues transition` are domain actions. | They preserve Jira's Assign issue and Transition issue operations. Workflow movement is separate from field updates. |
| `STYLE-PAGE-1` | Page sizes are capped at 100 by the tool. | Jira's endpoint limits can change, and the CLI does not claim a fixed provider-wide maximum. |

## Development

```bash
bun run build
bun run check
bun link
```

`src/core/` is vendored from cli-core and is never edited here. Change cli-core and run its sync script instead. `docs/cli-conventions.md` restates the command-line contract this tool follows.

## API references

- [Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Basic authentication and API tokens](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/)
- [Issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Issues](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
- [Issue comments](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/)
- [Issue worklogs](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/)
- [User search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/)
- [Jira Software boards](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/)
- [Jira Software sprints](https://developer.atlassian.com/cloud/jira/software/rest/api-group-sprint/)
- [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
