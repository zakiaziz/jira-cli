// Vendored from cli-core. Do not edit here; change cli-core and run its sync script.
import { asCliError, CliError } from "./errors.js";
import { invalidResponse, performRequest, rememberUrlSecrets, scrubSecrets, type Exchange, type RequestPlan } from "./http.js";
import type { PagedRequest, PageInfo, Pagination } from "./provider.js";
import type { Context, PaginationSpec } from "./registry.js";
import { collectionOf, responseNotices, retainedKeys, unwrap, type ShapeCall, type Shaped } from "./shape.js";
import { echoable, isRecord, redactUrlInput, sameOriginUrl } from "./values.js";

export interface Traversal {
  pageSize: number;
  all: boolean;
  maxItems?: number | undefined;
  cursor?: string | undefined;
  /** The provider window: the cursor is a decimal offset and the provider serves no item at or beyond it. */
  window?: number | undefined;
  boundary?: PaginationSpec["boundary"];
  min?: number;
  max?: number;
}

interface Page {
  items: unknown[];
  nextCursor: string | null;
  hasMore: boolean;
  provider?: Record<string, unknown>;
  exchange: Exchange;
}

/**
 * Reads a collection page by page (STYLE-PAGE-*): one page by default, every page with --all, bounded by --max-items.
 * Guards fail INVALID_RESPONSE on the first page and PARTIAL_FAILURE, resumable from the failed cursor, on a later one.
 */
export async function traverse(
  plan: RequestPlan,
  call: ShapeCall,
  style: Pagination,
  traversal: Traversal,
  context: Context,
): Promise<Shaped> {
  if (style.continuation === "url") plan.urlContinuation = true;
  let cursor = traversal.cursor ?? null;
  let pagesRead = 0;
  const seenCursors = new Set<string>(cursor ? [cursor] : []);
  const seenPages = new Set<string>();
  const items: unknown[] = [];
  let provider: Record<string, unknown> | undefined;
  while (true) {
    let page: Page;
    try {
      const next = style.continuation === "url" && cursor !== null ? continuation(plan, cursor, style, traversal) : undefined;
      const requested = next?.size ?? requestedSize(traversal, cursor, items.length);
      const url = next?.url ?? new URL(plan.url);
      const target = { url, query: url.searchParams, body: structuredClone(plan.body) };
      style.apply(target, { size: requested, cursor });
      if (style.continuation === "url") {
        if (!sameOriginUrl(target.url.toString(), plan.url)) {
          throw new CliError("INVALID_RESPONSE", `Pagination request URL must stay on ${new URL(plan.url).origin} without credentials or a fragment; received "${echoable(scrubSecrets(redactUrlInput(target.url.toString()), plan))}".`, {
            hint: "Check the pagination adapter's apply hook.",
          });
        }
        rememberUrlSecrets(plan, target.url.toString());
        seenCursors.add(target.url.toString());
      }
      if (traversal.boundary && traversal.maxItems !== undefined && requested > traversal.maxItems - items.length) {
        return outcome({ nextCursor: cursor ?? target.url.toString(), hasMore: true }, items, provider);
      }
      page = await readPage(plan, call, style, { size: requested, cursor }, target, traversal, context);
      guard(page, { plan, call, seenCursors, seenPages, style });
    } catch (error) {
      throw pagesRead > 0 && cursor !== null ? withPartial(error, items, cursor, style.continuation === "url" ? plan : undefined) : error;
    }
    pagesRead += 1;
    provider = mergedProvider(style, provider, page.provider);
    if (!traversal.all) return outcome(page, page.items, provider);
    items.push(...page.items);
    const filled = traversal.maxItems !== undefined && items.length >= traversal.maxItems;
    if (page.nextCursor === null || filled) return outcome(page, items, provider);
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

function startOffset(cursor: string | null): number {
  return cursor === null ? 0 : Number(cursor);
}

function requestedSize(traversal: Traversal, cursor: string | null, read: number): number {
  const remaining = traversal.maxItems === undefined ? traversal.pageSize : traversal.maxItems - read;
  const windowLeft = traversal.window === undefined ? Number.POSITIVE_INFINITY : traversal.window - startOffset(cursor);
  return Math.max(traversal.min ?? 0, Math.min(traversal.pageSize, remaining, windowLeft));
}

/** Validates every continuation, including one returned without --all, before it can carry credentials. */
function continuation(plan: RequestPlan, cursor: string, style: Pagination, traversal: Traversal, exchange?: Exchange): { url: URL; size?: number } {
  rememberUrlSecrets(plan, cursor);
  if (exchange?.requestId) exchange.requestId = scrubSecrets(exchange.requestId, plan);
  const received = echoable(scrubSecrets(redactUrlInput(cursor), plan));
  const field = exchange ? "next_cursor" : "--cursor";
  const fail = (constraint: string): never => {
    const message = `${field} must ${constraint}; received "${received}".`;
    if (exchange) throw invalidResponse(plan, message, exchange);
    throw new CliError("INVALID_ARGUMENT", message, { hint: "Use a meta.next_cursor value from a previous page on the configured API origin." });
  };
  const url = sameOriginUrl(cursor, plan.url);
  if (!url) return fail(`be an absolute HTTP(S) URL on ${new URL(plan.url).origin} without credentials, whitespace, backslashes, or a fragment`);
  if (!traversal.boundary) return { url };
  const size = style.cursorSize?.(new URL(url));
  const min = traversal.min ?? 1;
  const max = traversal.max ?? Number.MAX_SAFE_INTEGER;
  if (size === undefined || !Number.isSafeInteger(size) || size < min || size > max) {
    return fail(`include a valid page size from ${min} to ${max}`);
  }
  return { url, size };
}

async function readPage(
  plan: RequestPlan,
  call: ShapeCall,
  style: Pagination,
  request: { size: number; cursor: string | null },
  target: PagedRequest,
  traversal: Traversal,
  context: Context,
): Promise<Page> {
  const pageFrom = (exchange: Exchange): Page => {
    const unwrapped = unwrap(exchange, call, plan, style.continuation === "url");
    const { items, container } = collectionOf(unwrapped, call, plan, exchange, context);
    const read = style.read(container, call.collectionKey, request, items);
    if (!read) {
      throw invalidResponse(plan, `${plan.provider.name} returned invalid pagination fields for ${call.name}.`, exchange);
    }
    if (style.continuation === "url" && read.nextCursor !== null) continuation(plan, read.nextCursor, style, traversal, exchange);
    const retained = retainedKeys(call.select ? unwrapped.input : container, call.providerMeta);
    const notices = responseNotices(unwrapped.body, plan);
    const info = retained || notices ? { ...read, provider: { ...retained, ...notices, ...read.provider } } : read;
    if (items.length > request.size) {
      throw invalidResponse(plan, `${plan.provider.name} returned ${items.length} items for ${call.name}; the page size was ${request.size}.`, exchange);
    }
    if (traversal.window !== undefined && info.nextCursor !== null && !/^[0-9]{1,15}$/.test(info.nextCursor)) {
      throw invalidResponse(plan, `${plan.provider.name} returned a next cursor that is not a decimal offset for ${call.name}.`, exchange);
    }
    if (info.nextCursor !== null && items.length === 0 && !style.allowEmptyPages) {
      throw invalidResponse(plan, `${plan.provider.name} returned an empty page with more results for ${call.name}.`, exchange);
    }
    return buildPage(items, info, traversal, request.cursor, exchange);
  };
  let page: Page | undefined;
  const exchange = await performRequest(
    { ...plan, url: target.url.toString(), ...(target.body === undefined ? {} : { body: target.body }) },
    undefined,
    style.continuation === "url" ? (response) => { page = pageFrom(response); } : undefined,
  );
  return page ?? pageFrom(exchange);
}

function buildPage(items: unknown[], info: PageInfo, traversal: Traversal, cursor: string | null, exchange: Exchange): Page {
  const capped =
    traversal.window !== undefined && info.nextCursor !== null && startOffset(cursor) + items.length >= traversal.window;
  const nextCursor = capped ? null : info.nextCursor;
  return {
    items,
    nextCursor,
    hasMore: capped ? true : (info.hasMore ?? nextCursor !== null),
    ...(info.provider && Object.keys(info.provider).length > 0 ? { provider: info.provider } : {}),
    exchange,
  };
}

interface Guards {
  plan: RequestPlan;
  call: ShapeCall;
  seenCursors: Set<string>;
  seenPages: Set<string>;
  style: Pagination;
}

function guard(page: Page, guards: Guards): void {
  const { plan, call, seenCursors, seenPages, style } = guards;
  const name = plan.provider.name;
  const next = page.nextCursor !== null && style.continuation === "url" ? new URL(page.nextCursor).toString() : page.nextCursor;
  if (next !== null && seenCursors.has(next)) {
    const received = style.continuation === "url" ? echoable(scrubSecrets(redactUrlInput(next), plan)) : page.nextCursor;
    throw invalidResponse(plan, `${name} repeated pagination cursor "${received}" for ${call.name}.`, page.exchange);
  }
  if (!style.detectRepeatedPages || page.items.length === 0) return;
  const fingerprint = JSON.stringify(page.items);
  if (seenPages.has(fingerprint)) {
    throw invalidResponse(plan, `${name} returned the same page of items again for ${call.name}.`, page.exchange);
  }
  seenPages.add(fingerprint);
}

function mergedProvider(
  style: Pagination,
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (next === undefined) return previous;
  if (previous === undefined) return next;
  return style.mergeProvider ? style.mergeProvider(previous, next) : mergeRetained(previous, next);
}

/**
 * The default merge of meta.provider across --all pages. A key that holds an array on both pages concatenates the
 * arrays and drops a later item when an earlier one matches: objects with a string or number id match by type (when they
 * have a string one) and id, anything else by its JSON text. Any other value, such as a total count, takes the last page's value.
 */
export function mergeRetained(previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    const earlier = merged[key];
    merged[key] = Array.isArray(earlier) && Array.isArray(value) ? mergeArrays(earlier, value) : value;
  }
  return merged;
}

function mergeArrays(earlier: unknown[], later: unknown[]): unknown[] {
  const merged = [...earlier];
  const seen = new Set(earlier.map(identityOf));
  for (const item of later) {
    const identity = identityOf(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    merged.push(item);
  }
  return merged;
}

function identityOf(item: unknown): string {
  if (isRecord(item) && (typeof item.id === "string" || typeof item.id === "number")) {
    return `id:${JSON.stringify([typeof item.type === "string" ? item.type : null, item.id])}`;
  }
  return `json:${JSON.stringify(item) ?? "undefined"}`;
}

function outcome(page: Pick<Page, "nextCursor" | "hasMore">, items: unknown[], provider: Record<string, unknown> | undefined): Shaped {
  return {
    data: items,
    meta: {
      next_cursor: page.nextCursor,
      has_more: page.hasMore,
      ...(provider ? { provider } : {}),
    },
  };
}

function withPartial(error: unknown, items: unknown[], cursor: string, plan?: RequestPlan): CliError {
  const failure = asCliError(error);
  const shownCursor = plan ? echoable(scrubSecrets(redactUrlInput(cursor), plan)) : cursor;
  return new CliError("PARTIAL_FAILURE", `Read ${items.length} items before the failure: ${failure.message}`, {
    hint: shownCursor === cursor ? `Resume with --cursor "${cursor}".` : "Resume with the cursor in partial.next_cursor; its sensitive values are omitted from this hint.",
    retryable: false,
    ...(failure.extra.provider ? { provider: failure.extra.provider } : {}),
    details: { cause: failure.code },
    partial: { data: items, next_cursor: cursor },
  });
}
