import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/*
 * Grows a survey corpus with `.qvs` files found by GitHub code search.
 *
 * Usage: npm run survey:fetch -w @qlinter/core -- <corpus-dir> [--max 100] [--per-repo 5] [--query "LOAD extension:qvs"]
 *
 * Files land directly in <corpus-dir>, numbered on from the highest number
 * already anywhere in the corpus, and are downloaded byte for byte so encoding,
 * BOM and line endings survive. A file whose content the corpus already holds
 * is skipped. Where each one came from is appended to github-sources.jsonl
 * beside them, which is what licence questions and a finding's origin are
 * answered from.
 *
 * Authenticates with GITHUB_TOKEN, or with the token of a logged-in `gh`.
 */

const USAGE = 'usage: npm run survey:fetch -w @qlinter/core -- <corpus-dir> [--max 100] [--per-repo 5] [--query "..."]';

const API = 'https://api.github.com';

/* Code search allows ten requests a minute; a page every seven seconds stays under it. */
const SEARCH_INTERVAL_MS = 7000;

/* GitHub serves at most this many results for one query, whatever the total says. */
const SEARCH_RESULT_CAP = 1000;

interface SearchItem {
  path: string;
  sha: string;
  html_url: string;
  repository: { full_name: string };
}

interface Source {
  file: string;
  repo: string;
  path: string;
  blob: string;
  url: string;
}

function token(): string {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('set GITHUB_TOKEN or log in with `gh auth login`');
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/* A GET that waits out a rate limit once instead of failing the whole run on it. */
async function get(url: string, accept: string, auth: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${auth}`, 'X-GitHub-Api-Version': '2022-11-28', Accept: accept },
    });

    if (response.ok) {
      return response;
    }

    const limited =
      response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');

    if (!limited || attempt > 0) {
      throw new Error(`${response.status} ${response.statusText} for ${url}: ${await response.text()}`);
    }

    const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000;
    const wait = Math.max(reset - Date.now(), Number(response.headers.get('retry-after') ?? 60) * 1000);
    console.log(`rate limited, waiting ${Math.ceil(wait / 1000)}s`);
    await sleep(wait);
  }
}

function scripts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return scripts(path);
    }

    return entry.name.endsWith('.qvs') ? [path] : [];
  });
}

const hashOf = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/* The number a `0026.qvs` carries, or 0 for a file named otherwise. */
function numberOf(path: string): number {
  const match = /(?:^|[\\/])(\d+)\.qvs$/.exec(path);

  return match === null ? 0 : Number(match[1]);
}

function readSources(manifest: string): Source[] {
  if (!existsSync(manifest)) {
    return [];
  }

  return readFileSync(manifest, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Source);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      max: { type: 'string', default: '100' },
      'per-repo': { type: 'string', default: '5' },
      query: { type: 'string', default: 'LOAD extension:qvs' },
    },
  });

  const [corpus] = positionals;

  if (corpus === undefined) {
    throw new Error(USAGE);
  }

  const max = Number(values.max);
  const perRepo = Number(values['per-repo']);
  const auth = token();

  const existing = scripts(corpus);
  const known = new Set(existing.map((path) => hashOf(readFileSync(path))));
  let next = Math.max(0, ...existing.map(numberOf)) + 1;

  const manifest = join(corpus, 'github-sources.jsonl');

  // Earlier runs count against the per-repo cap, and a blob fetched before is not fetched again.
  const earlier = readSources(manifest);
  const knownBlobs = new Set(earlier.map((source) => source.blob));
  const perRepoCount = new Map<string, number>();

  for (const { repo } of earlier) {
    perRepoCount.set(repo, (perRepoCount.get(repo) ?? 0) + 1);
  }

  console.log(`corpus holds ${existing.length} scripts; numbering from ${String(next).padStart(4, '0')}`);

  let fetched = 0;
  let duplicates = 0;

  search: for (let page = 1; page <= SEARCH_RESULT_CAP / 100; page++) {
    if (page > 1) {
      await sleep(SEARCH_INTERVAL_MS);
    }

    const query = new URLSearchParams({ q: values.query, per_page: '100', page: String(page) });
    const response = await get(`${API}/search/code?${query}`, 'application/vnd.github+json', auth);
    const { items } = (await response.json()) as { items: SearchItem[] };

    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      const repo = item.repository.full_name;

      if ((perRepoCount.get(repo) ?? 0) >= perRepo) {
        continue;
      }

      // A fork carries the same blob under another repo name; its sha already says so.
      if (knownBlobs.has(item.sha)) {
        duplicates++;
        continue;
      }

      knownBlobs.add(item.sha);

      const blob = await get(`${API}/repos/${repo}/git/blobs/${item.sha}`, 'application/vnd.github.raw', auth);
      const bytes = Buffer.from(await blob.arrayBuffer());
      const hash = hashOf(bytes);

      if (known.has(hash)) {
        duplicates++;
        continue;
      }

      const file = `${String(next).padStart(4, '0')}.qvs`;
      const source: Source = { file, repo, path: item.path, blob: item.sha, url: item.html_url };
      writeFileSync(join(corpus, file), bytes);
      appendFileSync(manifest, `${JSON.stringify(source)}\n`);

      known.add(hash);
      perRepoCount.set(repo, (perRepoCount.get(repo) ?? 0) + 1);
      next++;
      fetched++;
      console.log(`${file}  ${repo}/${item.path}`);

      if (fetched >= max) {
        break search;
      }
    }
  }

  console.log(
    `\n${fetched} fetched, ${duplicates} already in the corpus; GitHub files come from ${perRepoCount.size} repos`,
  );
}

await main();
