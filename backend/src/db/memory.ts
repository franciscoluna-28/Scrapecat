import { createHash, randomUUID } from "crypto";
import type {
  ChatCitation,
  CommitChunkMetadata,
  GitProvider,
} from "@/db/schema";

export type ProjectRow = {
  id: string;
  gitProvider: GitProvider;
  providerProjectId: string;
  providerOwner: string;
  repositoryName: string;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CommitChunkRow = {
  id: string;
  projectId: string;
  commitSha: string;
  branch: string;
  commitMessage: string;
  author: string | null;
  embedded?: number[] | null;
  contentHash: string | null;
  embeddingHash: string | null;
  metadata: CommitChunkMetadata;
  committedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatSessionRow = {
  id: string;
  projectId: string;
  anonymousId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatMessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  branch: string | null;
  citations: ChatCitation[];
  createdAt: Date;
};

export type SettingsRow = {
  id: string;
  reportProvider: string;
  reportModel: string;
  embeddingProvider: string;
  embeddingModel: string;
  updatedAt: Date;
};

export type CredentialRow = {
  id: string;
  provider: string;
  encryptedKey: string;
  keyHint: string;
  createdAt: Date;
  updatedAt: Date;
};

const projects = new Map<string, ProjectRow>();
const chunks = new Map<string, CommitChunkRow>();
const sessions = new Map<string, ChatSessionRow>();
const chatMessages = new Map<string, ChatMessageRow>();
const appSettings = new Map<string, SettingsRow>();
const credentials = new Map<string, CredentialRow>();

export function resetStore() {
  projects.clear();
  chunks.clear();
  sessions.clear();
  chatMessages.clear();
  appSettings.clear();
  credentials.clear();
}

function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// === Projects ===

export async function upsertProject({
  input,
}: {
  input: {
    gitProvider?: GitProvider;
    providerProjectId: string;
    providerOwner: string;
    repositoryName: string;
    defaultBranch?: string;
  };
}) {
  const gitProvider = input.gitProvider ?? "github";
  const now = new Date();
  let row = [...projects.values()].find(
    (p) =>
      p.gitProvider === gitProvider &&
      p.providerProjectId === input.providerProjectId,
  );
  let created = false;
  if (!row) {
    created = true;
    row = {
      id: randomUUID(),
      gitProvider,
      providerProjectId: input.providerProjectId,
      providerOwner: input.providerOwner,
      repositoryName: input.repositoryName,
      defaultBranch: input.defaultBranch ?? "main",
      createdAt: now,
      updatedAt: now,
    };
  } else {
    row = {
      ...row,
      providerOwner: input.providerOwner,
      repositoryName: input.repositoryName,
      updatedAt: now,
    };
  }
  projects.set(row.id, row);
  return { project: { ...row }, created };
}

export async function listProjects() {
  return [...projects.values()]
    .sort((a, b) => a.repositoryName.localeCompare(b.repositoryName))
    .map((r) => ({ ...r }));
}

export async function listIndexedBranches(projectId: string) {
  const branches = new Set<string>();
  for (const c of chunks.values()) {
    if (c.projectId === projectId && c.branch) branches.add(c.branch);
  }
  return [...branches].sort();
}

export async function getProjectById({ id }: { id: string }) {
  return projects.get(id) ? { ...projects.get(id)! } : null;
}

export async function getProjectByProviderId({
  gitProvider,
  providerProjectId,
}: {
  gitProvider: GitProvider;
  providerProjectId: string;
}) {
  const row = [...projects.values()].find(
    (p) =>
      p.gitProvider === gitProvider &&
      p.providerProjectId === providerProjectId,
  );
  return row ? { ...row } : null;
}

export async function getProjectsByIds({ ids }: { ids: string[] }) {
  return ids
    .map((id) => projects.get(id))
    .filter((p): p is ProjectRow => !!p)
    .map((r) => ({ ...r }));
}

// === Commit chunks ===

export type MemoryCommitChunkInput = {
  projectId: string;
  commitSha: string;
  branch?: string;
  commitMessage: string;
  author?: string | null;
  metadata?: CommitChunkMetadata;
  committedAt: Date;
};

export async function upsertCommitChunks({
  inputs,
}: {
  inputs: MemoryCommitChunkInput[];
}) {
  if (inputs.length === 0) return;
  for (const i of inputs) {
    const branch = i.branch ?? "main";
    const now = new Date();
    const existing = [...chunks.values()].find(
      (c) =>
        c.projectId === i.projectId &&
        c.commitSha === i.commitSha &&
        c.branch === branch,
    );
    const contentHash = contentHashOf(i.commitMessage);
    if (existing) {
      chunks.set(existing.id, {
        ...existing,
        commitMessage: i.commitMessage,
        author: i.author ?? null,
        contentHash,
        metadata: i.metadata ?? {},
        committedAt: i.committedAt,
        updatedAt: now,
      });
    } else {
      const id = randomUUID();
      chunks.set(id, {
        id,
        projectId: i.projectId,
        commitSha: i.commitSha,
        branch,
        commitMessage: i.commitMessage,
        author: i.author ?? null,
        contentHash,
        embeddingHash: null,
        metadata: i.metadata ?? {},
        committedAt: i.committedAt,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function countChunksForProject({
  projectId,
  branch,
  embeddedOnly = false,
}: {
  projectId: string;
  branch?: string;
  embeddedOnly?: boolean;
}) {
  let count = 0;
  for (const c of chunks.values()) {
    if (c.projectId !== projectId) continue;
    if (branch && c.branch !== branch) continue;
    if (embeddedOnly && !c.embedded) continue;
    count += 1;
  }
  return count;
}

export async function getLatestCommitDate({
  projectId,
  branch,
}: {
  projectId: string;
  branch?: string;
}) {
  let latest: Date | null = null;
  for (const c of chunks.values()) {
    if (c.projectId !== projectId) continue;
    if (branch && c.branch !== branch) continue;
    if (!latest || c.committedAt > latest) latest = c.committedAt;
  }
  return latest;
}

export async function getChunksByShas({
  projectId,
  shas,
  branch,
}: {
  projectId: string;
  shas: string[];
  branch?: string;
}) {
  const result = new Map<
    string,
    { commitSha: string; metadata: CommitChunkMetadata; contentHash: string | null }
  >();
  for (const c of chunks.values()) {
    if (c.projectId !== projectId) continue;
    if (branch && c.branch !== branch) continue;
    if (shas.includes(c.commitSha)) {
      result.set(c.commitSha, {
        commitSha: c.commitSha,
        metadata: c.metadata ?? {},
        contentHash: c.contentHash,
      });
    }
  }
  return result;
}

export async function listCommitsForProject({
  projectId,
  startDate,
  endDate,
  branch,
}: {
  projectId: string;
  startDate?: Date;
  endDate?: Date;
  branch?: string;
}) {
  const rows = [...chunks.values()].filter((c) => {
    if (c.projectId !== projectId) return false;
    if (startDate && c.committedAt < startDate) return false;
    if (endDate && c.committedAt > endDate) return false;
    if (branch && c.branch !== branch) return false;
    return true;
  });
  rows.sort((a, b) => b.committedAt.getTime() - a.committedAt.getTime());
  return rows.map((r) => ({ ...r }));
}

export type MemoryCommitSearchResult = {
  id: string;
  commitSha: string;
  commitMessage: string;
  author: string | null;
  committedAt: Date;
  metadata: CommitChunkMetadata;
  distance: number | null;
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function semanticSearchCommits({
  projectId,
  embedding,
  limit,
  branch,
  startDate,
  endDate,
}: {
  projectId: string;
  embedding: number[];
  limit: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<MemoryCommitSearchResult[]> {
  const candidates = [...chunks.values()].filter((c) => {
    if (c.projectId !== projectId) return false;
    if (!c.embedded || c.embedded.length === 0) return false;
    if (branch && c.branch !== branch) return false;
    if (startDate && c.committedAt < startDate) return false;
    if (endDate && c.committedAt > endDate) return false;
    return true;
  });

  const scored = candidates.map((c) => ({
    c,
    distance: 1 - cosineSimilarity(embedding, c.embedded!),
  }));

  scored.sort((a, b) => a.distance - b.distance);

  return scored.slice(0, limit).map(({ c, distance }) => ({
    id: c.id,
    commitSha: c.commitSha,
    commitMessage: c.commitMessage,
    author: c.author,
    committedAt: c.committedAt,
    metadata: c.metadata ?? {},
    distance,
  }));
}

// Demo keyword matching: tokenize the query, drop stopwords, stem, and score a
// commit by how many significant tokens appear in its message or file paths.
// (The product's Postgres path uses embeddings first; the in-memory demo has
// none, so matching the whole phrase would almost always miss — "what broke and
// got fixed" is not in any commit message verbatim.)
const STOPWORDS = new Set([
  "what", "which", "when", "where", "why", "how", "who", "whom",
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to",
  "for", "with", "from", "by", "is", "are", "was", "were", "be", "been",
  "being", "do", "does", "did", "this", "that", "these", "those", "it",
  "its", "we", "they", "he", "she", "there", "here", "your", "you",
  "could", "would", "should", "can", "will", "may", "might", "all",
  "any", "not", "get", "got", "over", "under", "into", "out", "up",
  "about", "than", "then", "them", "their", "his", "her", "our",
]);

// Minimal stemming + irregular roots so "shipped", "fixing", "broke" match
// "ship", "fix", "break" without an API call.
const IRREGULAR: Record<string, string> = {
  broke: "break", broken: "break", breaks: "break",
  fixed: "fix", fixes: "fix", fixing: "fix",
  shipped: "ship", shipping: "ship", ships: "ship",
  landed: "land", released: "release", releases: "release", releasing: "release",
  merged: "merge", merges: "merge", merging: "merge",
  added: "add", adds: "add", adding: "add",
  removed: "remove", removes: "remove", removing: "remove",
  changed: "change", changes: "change", changing: "change",
  created: "create", creates: "create", creating: "create",
  deleted: "delete", deletes: "delete", deleting: "delete",
  updated: "update", updates: "update", updating: "update",
  implemented: "implement", introduced: "introduce", fixedbugs: "fix",
};

function stemWord(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  return lower.replace(/(ing|ed|es|s)$/, "");
}

function significantTokens(query: string): string[] {
  const tokens: string[] = [];
  for (const raw of query.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    const stem = stemWord(raw);
    if (stem.length < 3) continue;
    if (!tokens.includes(stem)) tokens.push(stem);
  }
  return tokens;
}

function commitSearchText(c: CommitChunkRow): string {
  const files = c.metadata?.filesChanged ?? [];
  return [c.commitMessage, ...files].join(" \n ").toLowerCase();
}

export async function keywordSearchCommits({
  projectId,
  query,
  limit,
  branch,
  startDate,
  endDate,
}: {
  projectId: string;
  query: string;
  limit: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<MemoryCommitSearchResult[]> {
  const tokens = significantTokens(query);

  const rows = [...chunks.values()].filter((c) => {
    if (c.projectId !== projectId) return false;
    if (branch && c.branch !== branch) return false;
    if (startDate && c.committedAt < startDate) return false;
    if (endDate && c.committedAt > endDate) return false;
    return true;
  });

  const scored: { c: CommitChunkRow; hits: number }[] = [];
  if (tokens.length === 0) {
    // Pure stopword/date question (e.g. "what happened last week") — rank by
    // recency inside any applied window rather than returning nothing.
    scored.push(...rows.map((c) => ({ c, hits: 1 })));
  } else {
    for (const c of rows) {
      const text = commitSearchText(c);
      const wordStems = new Set(text.split(/[^a-z0-9]+/).map(stemWord));
      let hits = 0;
      for (const t of tokens) {
        if (wordStems.has(t) || text.includes(t)) hits += 1;
      }
      if (hits > 0) scored.push({ c, hits });
    }
  }

  scored.sort(
    (a, b) => b.hits - a.hits || b.c.committedAt.getTime() - a.c.committedAt.getTime(),
  );

  return scored.slice(0, limit).map(({ c }) => ({
    id: c.id,
    commitSha: c.commitSha,
    commitMessage: c.commitMessage,
    author: c.author,
    committedAt: c.committedAt,
    metadata: c.metadata ?? {},
    distance: null,
  }));
}

// === Credentials ===

export async function upsertCredential(input: {
  provider: string;
  encryptedKey: string;
  keyHint: string;
}) {
  const now = new Date();
  const existing = [...credentials.values()].find(
    (c) => c.provider === input.provider,
  );
  const row = existing
    ? {
        ...existing,
        encryptedKey: input.encryptedKey,
        keyHint: input.keyHint,
        updatedAt: now,
      }
    : {
        id: randomUUID(),
        provider: input.provider,
        encryptedKey: input.encryptedKey,
        keyHint: input.keyHint,
        createdAt: now,
        updatedAt: now,
      };
  credentials.set(row.id, row);
  return { ...row };
}

export async function listCredentials(provider?: string) {
  return [...credentials.values()]
    .filter((c) => !provider || c.provider === provider)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({ ...r }));
}

export async function getCredentialById(id: string) {
  return credentials.get(id) ? { ...credentials.get(id)! } : null;
}

export async function deleteCredentialById(id: string) {
  return credentials.delete(id);
}

export async function getLatestCredential(provider: string) {
  const rows = [...credentials.values()]
    .filter((c) => c.provider === provider)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows[0] ? { ...rows[0] } : null;
}

// === Settings ===

export async function getSettings(id: string) {
  return appSettings.get(id) ? { ...appSettings.get(id)! } : null;
}

export async function upsertSettings(input: {
  id: string;
  reportProvider: string;
  reportModel: string;
  embeddingProvider: string;
  embeddingModel: string;
}) {
  const existing = appSettings.get(input.id);
  const row = existing
    ? { ...existing, ...input, updatedAt: new Date() }
    : { ...input, updatedAt: new Date() };
  appSettings.set(row.id, row);
  return { ...row };
}

// === Chat sessions ===

export async function createSession({
  projectId,
  title,
  anonymousId,
}: {
  projectId: string;
  title: string;
  anonymousId: string;
}) {
  const now = new Date();
  const row: ChatSessionRow = {
    id: randomUUID(),
    projectId,
    anonymousId,
    title,
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(row.id, row);
  return { ...row };
}

export async function listSessions({ projectId, anonymousId }: { projectId?: string; anonymousId?: string }) {
  return [...sessions.values()]
    .filter((s) => !projectId || s.projectId === projectId)
    .filter((s) => !anonymousId || s.anonymousId === anonymousId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((r) => ({ ...r }));
}

export async function getSession({ id }: { id: string }) {
  return sessions.get(id) ? { ...sessions.get(id)! } : null;
}

export async function touchSession({ id }: { id: string }) {
  const row = sessions.get(id);
  if (!row) return;
  sessions.set(id, { ...row, updatedAt: new Date() });
}

export async function deleteSession({ id }: { id: string }) {
  sessions.delete(id);
  for (const [msgId, m] of chatMessages) {
    if (m.sessionId === id) chatMessages.delete(msgId);
  }
}

export async function addMessage({
  sessionId,
  role,
  content,
  branch,
  citations = [],
}: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  branch?: string | null;
  citations?: ChatCitation[];
}) {
  const row: ChatMessageRow = {
    id: randomUUID(),
    sessionId,
    role,
    content,
    branch: branch ?? null,
    citations,
    createdAt: new Date(),
  };
  chatMessages.set(row.id, row);
  return { ...row };
}

export async function listMessages({ sessionId }: { sessionId: string }) {
  return [...chatMessages.values()]
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({ ...r }));
}

// === Demo snapshot seeding ===

/**
 * A pre-built commit dataset used to seed bundled demo repos into the
 * in-memory store at boot (no runtime git/network needed).
 */
export type DemoSnapshot = {
  provider: GitProvider;
  owner: string;
  repo: string;
  defaultBranch: string;
  commits: {
    commitSha: string;
    commitMessage: string;
    author: string | null;
    committedAt: string;
    metadata: CommitChunkMetadata;
  }[];
};

export function seedDemoSnapshot(snapshot: DemoSnapshot): {
  project: ProjectRow;
  chunks: number;
} {
  const project = projectForSeed(snapshot);
  const inputs: MemoryCommitChunkInput[] = snapshot.commits.map((c) => ({
    projectId: project.id,
    commitSha: c.commitSha,
    branch: snapshot.defaultBranch,
    commitMessage: c.commitMessage,
    author: c.author,
    metadata: {
      commitUrl: `https://github.com/${snapshot.owner}/${snapshot.repo}/commit/${c.commitSha}`,
      filesChanged: c.metadata?.filesChanged ?? [],
      ...c.metadata,
    },
    committedAt: new Date(c.committedAt),
  }));
  for (const i of inputs) {
    const now = new Date();
    const id = randomUUID();
    chunks.set(id, {
      id,
      projectId: i.projectId,
      commitSha: i.commitSha,
      branch: i.branch ?? "main",
      commitMessage: i.commitMessage,
      author: i.author ?? null,
      contentHash: contentHashOf(i.commitMessage),
      embeddingHash: null,
      metadata: i.metadata ?? {},
      committedAt: i.committedAt,
      createdAt: now,
      updatedAt: now,
    });
  }
  return { project: { ...project }, chunks: inputs.length };
}

/**
 * Embeds all unembedded chunks in the in-memory store via OpenRouter.
 * Called at startup after demo seeding so retrieval works immediately.
 */
export async function embedDemoChunks(): Promise<{ embedded: number }> {
  const pending = [...chunks.values()].filter((c) => !c.embedded || c.embedded.length === 0);
  if (pending.length === 0) return { embedded: 0 };

  // Lazy import to avoid circular deps at module scope
  const { embedTexts } = await import("@/projects/embeddings");
  const BATCH = 50;
  let embedded = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    try {
      const vectors = await embedTexts(batch.map((c) => c.commitMessage));
      for (let j = 0; j < batch.length; j++) {
        const c = chunks.get(batch[j].id);
        if (c) {
          chunks.set(batch[j].id, {
            ...c,
            embedded: vectors[j],
            embeddingHash: c.contentHash,
          });
        }
      }
      embedded += batch.length;
    } catch (err) {
      // If embedding fails (no API key, rate limit), log and continue —
      // keyword search will still work as fallback.
      console.warn("Demo embedding batch failed, falling back to keyword search:", (err as Error).message);
      break;
    }
  }

  return { embedded };
}

function projectForSeed(snapshot: DemoSnapshot) {
  const gitProvider = snapshot.provider ?? "github";
  const now = new Date();
  const existing = [...projects.values()].find(
    (p) =>
      p.gitProvider === gitProvider &&
      p.providerProjectId === snapshot.repo,
  );
  if (existing) {
    return { ...existing };
  }
  const row: ProjectRow = {
    id: randomUUID(),
    gitProvider,
    providerProjectId: snapshot.repo,
    providerOwner: snapshot.owner,
    repositoryName: snapshot.repo,
    defaultBranch: snapshot.defaultBranch,
    createdAt: now,
    updatedAt: now,
  };
  projects.set(row.id, row);
  return { ...row };
}