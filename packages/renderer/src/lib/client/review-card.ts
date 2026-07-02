// Two-phase review: the shared card that lets a human validate/reject an agent's edits
// after seeing the real diff. Mounted identically on /review and on /comments (under the
// "to validate" filter). Browser-side. Data flow:
//   comments (?all=1) + journal (/api/journal) → for each `addressed` comment, invert the
//   journal to its changed pages (cascade included) → diffs (/api/diff, one batched call).
import { createApi, esc, type Comment } from "./comments-client";
import { type DiffMode, getDiffMode, renderDiff, setDiffMode } from "./diff";

interface JournalChange {
  page: string;
  commentIds: string[];
  what: string;
  why: string;
}
interface JournalEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  changes: JournalChange[];
}
interface DiffResult {
  page: string;
  file: string | null;
  diff: string | null;
  error?: string;
}
interface ReviewChange {
  page: string;
  what: string;
  why: string;
  otherCommentIds: string[];
}
type Msgs = Record<string, string>;
type RouteFor = (page: string) => string;

/** All changes attributed to a comment = its journal entry's changes that reference it
 *  (an entry lists one change per touched page → this is the cascade set). */
export function changesForComment(c: Comment, journal: JournalEntry[]): ReviewChange[] {
  const entry = journal.find((e) => e.id === c.resolution?.journalEntryId);
  if (!entry) return [];
  return entry.changes
    .filter((ch) => ch.commentIds.includes(c.id))
    .map((ch) => ({
      page: ch.page,
      what: ch.what,
      why: ch.why,
      otherCommentIds: ch.commentIds.filter((id) => id !== c.id),
    }));
}

function snippet(c: Comment | undefined): string {
  const s = c?.anchor?.quote || c?.thread[0]?.body || "";
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function renderChange(
  ch: ReviewChange,
  diffs: Map<string, DiffResult>,
  byId: Map<string, Comment>,
  m: Msgs,
  mode: DiffMode,
): string {
  const d = diffs.get(ch.page);
  let body: string;
  if (d?.diff) body = renderDiff(d.diff, mode);
  else if (d?.error === "git") body = `<p class="cmt-empty">${m.diffUnavailable}</p>`;
  else body = `<p class="cmt-empty">${m.newFileUncommitted}</p>`;
  const others = ch.otherCommentIds.map((id) => byId.get(id)).filter((c): c is Comment => !!c);
  const also = others.length
    ? `<div class="rev-also">ⓘ ${m.alsoAffects} ${others.map((o) => `<span>“${esc(snippet(o))}”</span>`).join(", ")}</div>`
    : "";
  return `<div class="rev-change">
    <div class="rev-change-head">${esc(ch.page)}${ch.what ? ` — ${esc(ch.what)}` : ""}</div>
    ${body}${also}
  </div>`;
}

export function renderReviewCard(
  c: Comment,
  changes: ReviewChange[],
  diffs: Map<string, DiffResult>,
  byId: Map<string, Comment>,
  m: Msgs,
  mode: DiffMode,
  routeFor: RouteFor,
): string {
  const href = `${routeFor(c.page)}?c=${c.id}`;
  const head =
    c.scope === "selection"
      ? `<span class="rev-quote">“${esc((c.anchor?.quote || "").slice(0, 90))}”</span>`
      : `<span class="cmt-scope">${m.scopePage}</span>`;
  return `<article class="rev-card" data-id="${c.id}" data-page="${esc(c.page)}">
    <header class="rev-head"><a class="rev-page" href="${href}">${esc(c.page)}</a> ${head}</header>
    <div class="rev-thread">${c.thread.map((t) => `<div class="rev-msg"><b>${esc(t.author)}</b> ${esc(t.body)}</div>`).join("")}</div>
    <div class="rev-agent">${m.proposedByAgent}${c.resolution?.note ? ` — ${esc(c.resolution.note)}` : ""}</div>
    <div class="rev-diffs">${changes.length ? changes.map((ch) => renderChange(ch, diffs, byId, m, mode)).join("") : `<p class="cmt-empty">${m.noChangesRecorded}</p>`}</div>
    <div class="rev-actions">
      <a class="rev-jump" href="${href}">${m.viewInPage}</a>
      <button data-act="reject" data-id="${c.id}" aria-label="${m.reject}">${m.reject}</button>
      <button data-act="approve" data-id="${c.id}" class="primary" aria-label="${m.approve}">✓ ${m.approve}</button>
    </div>
    <form class="rev-reject-form" data-id="${c.id}" hidden>
      <textarea rows="2" placeholder="${m.rejectReasonPlaceholder}"></textarea><button type="submit">${m.reject}</button>
    </form>
  </article>`;
}

function renderToggle(el: HTMLElement, m: Msgs, mode: DiffMode): void {
  el.innerHTML =
    `<button data-mode="unified" class="${mode === "unified" ? "active" : ""}">${m.diffUnified}</button>` +
    `<button data-mode="split" class="${mode === "split" ? "active" : ""}">${m.diffSplit}</button>`;
}

/**
 * Mount the review queue into `listEl` (+ optional diff-mode `toggleEl`). Fetches
 * comments + journal + diffs, renders one shared card per `addressed` comment (sorted by
 * page), and wires approve/reject/toggle. Returns `{ reload }`.
 */
export async function mountReviewList(
  listEl: HTMLElement,
  toggleEl: HTMLElement | null,
  m: Msgs,
  routeFor: RouteFor,
): Promise<{ reload: () => Promise<void> }> {
  let mode = getDiffMode();
  let comments: Comment[] = [];
  let journal: JournalEntry[] = [];
  let byId = new Map<string, Comment>();
  let diffs = new Map<string, DiffResult>();
  const api = createApi(); // PATCH carries the token from localStorage

  function render(): void {
    const addressed = comments
      .filter((c) => c.status === "addressed")
      .sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : a.createdAt < b.createdAt ? -1 : 1));
    listEl.innerHTML = addressed.length
      ? addressed
          .map((c) => renderReviewCard(c, changesForComment(c, journal), diffs, byId, m, mode, routeFor))
          .join("")
      : `<p class="cmt-empty">${m.reviewEmpty}</p>`;
  }

  async function reload(): Promise<void> {
    comments = await fetch("/api/comments?all=1").then((r) => r.json());
    journal = await fetch("/api/journal")
      .then((r) => r.json())
      .catch(() => []);
    byId = new Map(comments.map((c) => [c.id, c]));
    const pages = new Set<string>();
    for (const c of comments.filter((x) => x.status === "addressed")) {
      for (const ch of changesForComment(c, journal)) pages.add(ch.page);
    }
    diffs = new Map();
    if (pages.size) {
      const qs = [...pages].map((p) => `page=${encodeURIComponent(p)}`).join("&");
      const res: DiffResult[] = await fetch(`/api/diff?${qs}`)
        .then((r) => r.json())
        .catch(() => []);
      for (const d of Array.isArray(res) ? res : []) diffs.set(d.page, d);
    }
    render();
  }

  if (toggleEl) {
    renderToggle(toggleEl, m, mode);
    toggleEl.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-mode]") as HTMLElement | null;
      if (!b) return;
      mode = b.dataset.mode === "split" ? "split" : "unified";
      setDiffMode(mode);
      renderToggle(toggleEl, m, mode);
      render();
    });
  }

  listEl.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-act]") as HTMLElement | null;
    if (!btn) return;
    const card = btn.closest(".rev-card") as HTMLElement;
    const id = btn.dataset.id as string;
    const page = card.dataset.page as string;
    if (btn.dataset.act === "approve") {
      await api("PATCH", { page, id, status: "resolved" });
      await reload();
    } else {
      const form = card.querySelector(".rev-reject-form") as HTMLElement;
      form.hidden = !form.hidden;
      if (!form.hidden) (form.querySelector("textarea") as HTMLTextAreaElement).focus();
    }
  });

  listEl.addEventListener("submit", async (e) => {
    const form = (e.target as HTMLElement).closest(".rev-reject-form") as HTMLElement | null;
    if (!form) return;
    e.preventDefault();
    const ta = form.querySelector("textarea") as HTMLTextAreaElement;
    const body = ta.value.trim();
    if (!body) return;
    const page = (form.closest(".rev-card") as HTMLElement).dataset.page as string;
    await api("PATCH", { page, id: form.dataset.id, status: "open", reply: { body } });
    await reload();
  });

  await reload();
  return { reload };
}
