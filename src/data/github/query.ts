// The GraphQL query behind the adapter, and the shape of its response
// (ARCHITECTURE.md §10). Only the fields we read are typed.

export const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

/** Repositories per page; the API maximum. */
export const PAGE_SIZE = 100;

/**
 * Public repositories owned by a user or organization, oldest first so pages
 * stay stable while new repositories are created. `history.totalCount` is the
 * commit count of the default branch; it is the costly part of the query.
 */
export const OWNER_REPOSITORIES_QUERY = `
query OwnerRepositories($login: String!, $first: Int!, $after: String) {
  repositoryOwner(login: $login) {
    login
    repositories(
      first: $first
      after: $after
      privacy: PUBLIC
      ownerAffiliations: [OWNER]
      orderBy: { field: CREATED_AT, direction: ASC }
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        description
        createdAt
        pushedAt
        primaryLanguage { name }
        stargazerCount
        isFork
        isArchived
        defaultBranchRef {
          target {
            ... on Commit { history { totalCount } }
          }
        }
      }
    }
  }
}
`;

export interface RepoNode {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  pushedAt: string | null;
  primaryLanguage: { name: string } | null;
  stargazerCount: number;
  isFork: boolean;
  isArchived: boolean;
  /** Null for empty repositories; `target` lacks `history` when it is not a commit. */
  defaultBranchRef: { target: { history?: { totalCount: number } } | null } | null;
}

export interface OwnerPage {
  login: string;
  repositories: {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: (RepoNode | null)[];
  };
}

export interface GraphQLError {
  type?: string;
  message: string;
  path?: (string | number)[];
}

export interface OwnerResponse {
  data?: { repositoryOwner: OwnerPage | null } | null;
  errors?: GraphQLError[];
}

/** Years the owner has contributions in, newest first. Null for an organization. */
export const ACTIVITY_YEARS_QUERY = `
query ActivityYears($login: String!) {
  user(login: $login) {
    contributionsCollection { contributionYears }
  }
}
`;

/**
 * One year of the contribution calendar, month by month: an aliased
 * `contributionsCollection` per month (`m01` to `m12`). Months are UTC calendar
 * months; `restrictedContributionsCount` is what the owner shares of private work,
 * as a count only. Months after `until` are left out.
 */
export function activityYearQuery(year: number, until: Date): string {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const from = new Date(Date.UTC(year, m - 1, 1));
    if (from > until) break;
    const to = new Date(Date.UTC(year, m, 1) - 1000);
    months.push(
      `m${String(m).padStart(2, "0")}: contributionsCollection(from: "${from.toISOString()}", to: "${to.toISOString()}") {
      contributionCalendar { totalContributions }
      restrictedContributionsCount
    }`,
    );
  }
  return `
query ActivityYear($login: String!) {
  user(login: $login) {
    ${months.join("\n    ")}
  }
}
`;
}

export interface ActivityYearsResponse {
  data?: { user: { contributionsCollection: { contributionYears: number[] } } | null } | null;
  errors?: GraphQLError[];
}

export interface MonthNode {
  contributionCalendar: { totalContributions: number };
  restrictedContributionsCount: number;
}

export interface ActivityYearResponse {
  data?: { user: Record<string, MonthNode | null> | null } | null;
  errors?: GraphQLError[];
}
