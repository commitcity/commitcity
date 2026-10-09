/**
 * The normalized, source-independent input to generation (ARCHITECTURE.md §4.1).
 * Adapters (fixtures, GitHub) produce it; generation never sees raw API data.
 */
export interface CityInput {
  /** GitHub login, used for the city seed. */
  owner: string;
  /** ISO 8601 date-time the data was fetched. */
  snapshotAt: string;
  repos: RepoInput[];
}

export interface RepoInput {
  /** Stable GitHub node id. */
  id: string;
  name: string;
  description: string | null;
  /** ISO 8601 date-time. Drives placement order. */
  createdAt: string;
  /** ISO 8601 date-time of the last push, if any. */
  pushedAt: string | null;
  primaryLanguage: string | null;
  stars: number;
  /** May be unavailable (ARCHITECTURE.md §10). */
  commitCount: number | null;
  isFork: boolean;
  isArchived: boolean;
}

export class CityInputError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "CityInputError";
  }
}

// UTC only, so parsing never depends on the machine's time zone.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * Checks that `value` is a valid `CityInput` and returns it typed. Throws a
 * `CityInputError` naming the first invalid field. Unknown fields are rejected so
 * typos in fixtures fail loudly.
 */
export function parseCityInput(value: unknown): CityInput {
  const city = record(value, "$", ["owner", "snapshotAt", "repos"]);
  nonEmptyString(city.owner, "$.owner");
  isoDateTime(city.snapshotAt, "$.snapshotAt");
  if (!Array.isArray(city.repos)) throw new CityInputError("$.repos", "expected an array");

  const ids = new Set<string>();
  city.repos.forEach((repo: unknown, i: number) => {
    const path = `$.repos[${i}]`;
    const r = record(repo, path, REPO_KEYS);
    nonEmptyString(r.id, `${path}.id`);
    if (ids.has(r.id as string)) throw new CityInputError(`${path}.id`, `duplicate id "${r.id}"`);
    ids.add(r.id as string);
    nonEmptyString(r.name, `${path}.name`);
    nullable(r.description, `${path}.description`, stringValue);
    isoDateTime(r.createdAt, `${path}.createdAt`);
    nullable(r.pushedAt, `${path}.pushedAt`, isoDateTime);
    nullable(r.primaryLanguage, `${path}.primaryLanguage`, nonEmptyString);
    count(r.stars, `${path}.stars`);
    nullable(r.commitCount, `${path}.commitCount`, count);
    boolean(r.isFork, `${path}.isFork`);
    boolean(r.isArchived, `${path}.isArchived`);
  });

  return value as CityInput;
}

const REPO_KEYS = [
  "id",
  "name",
  "description",
  "createdAt",
  "pushedAt",
  "primaryLanguage",
  "stars",
  "commitCount",
  "isFork",
  "isArchived",
];

function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CityInputError(path, "expected an object");
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new CityInputError(`${path}.${key}`, "unknown field");
  }
  for (const key of keys) {
    if (!(key in value)) throw new CityInputError(`${path}.${key}`, "missing field");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string) {
  if (typeof value !== "string") throw new CityInputError(path, "expected a string");
}

function nonEmptyString(value: unknown, path: string) {
  stringValue(value, path);
  if ((value as string).length === 0) throw new CityInputError(path, "expected a non-empty string");
}

function isoDateTime(value: unknown, path: string) {
  stringValue(value, path);
  if (!ISO_DATE_TIME.test(value as string) || Number.isNaN(Date.parse(value as string))) {
    throw new CityInputError(path, "expected a UTC ISO 8601 date-time like 2024-01-31T12:00:00Z");
  }
}

function count(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new CityInputError(path, "expected a non-negative integer");
  }
}

function boolean(value: unknown, path: string) {
  if (typeof value !== "boolean") throw new CityInputError(path, "expected a boolean");
}

function nullable(value: unknown, path: string, check: (value: unknown, path: string) => void) {
  if (value !== null) check(value, path);
}
