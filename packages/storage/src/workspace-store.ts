import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  Kysely,
  SqliteDialect,
  sql,
  type Generated,
  type Transaction,
} from "kysely";
import {
  DomainError,
  canonicalJson,
  type ActorClass,
  type Application,
  type Approval,
  type Artifact,
  type CommandContext,
  type Comparison,
  type DiscoveryLead,
  type DomainEvent,
  type EntityId,
  type Evaluation,
  type EvidenceItem,
  type ImportManifest,
  type Opportunity,
  type Operation,
  type ProfileFact,
  type Rubric,
  type SearchProfile,
  type SourceDocument,
  type UtcTimestamp,
  type Workspace,
  type WorkspaceId,
} from "@career-workbench/domain";
import {
  assertSafeWorkspaceRoot,
  resolveWorkspaceRelative,
} from "./path-safety.js";

interface EntityRow {
  id: string;
  workspace_id: string;
  revision: number;
  state: string | null;
  record_json: string;
  created_at: string;
  updated_at: string;
}

interface DomainEventRow {
  sequence: Generated<number>;
  workspace_id: string;
  event_kind: string;
  schema_version: number;
  aggregate_id: string;
  aggregate_revision: number;
  command_id: string;
  operation_id: string | null;
  payload_json: string;
  timestamp: string;
  actor: string;
}

interface IdempotencyRow {
  workspace_id: string;
  idempotency_key: string;
  command_digest: string;
  result_json: string;
  command_id: string;
  created_at: string;
}

interface MigrationRow {
  version: number;
  name: string;
  applied_at: string;
}

interface DatabaseSchema {
  workspaces: EntityRow;
  sources: EntityRow;
  profile_facts: EntityRow;
  search_profiles: EntityRow;
  discovery_leads: EntityRow;
  opportunities: EntityRow;
  evidence_items: EntityRow;
  rubrics: EntityRow;
  evaluations: EntityRow;
  comparisons: EntityRow;
  applications: EntityRow;
  import_manifests: EntityRow;
  artifacts: EntityRow;
  operations: EntityRow;
  approvals: EntityRow;
  domain_events: DomainEventRow;
  idempotency_commands: IdempotencyRow;
  schema_migrations: MigrationRow;
}

const CURRENT_SCHEMA_VERSION = 6;

export type EntityKind =
  | "workspace"
  | "source"
  | "profileFact"
  | "searchProfile"
  | "discoveryLead"
  | "opportunity"
  | "evidence"
  | "rubric"
  | "evaluation"
  | "comparison"
  | "application"
  | "importManifest"
  | "artifact"
  | "operation"
  | "approval";

export interface EntityByKind {
  workspace: Workspace;
  source: SourceDocument;
  profileFact: ProfileFact;
  searchProfile: SearchProfile;
  discoveryLead: DiscoveryLead;
  opportunity: Opportunity;
  evidence: EvidenceItem;
  rubric: Rubric;
  evaluation: Evaluation;
  comparison: Comparison;
  application: Application;
  importManifest: ImportManifest;
  artifact: Artifact;
  operation: Operation;
  approval: Approval;
}

type RecordEntity = EntityByKind[EntityKind];
type EntityTable =
  | "workspaces"
  | "sources"
  | "profile_facts"
  | "search_profiles"
  | "discovery_leads"
  | "opportunities"
  | "evidence_items"
  | "rubrics"
  | "evaluations"
  | "comparisons"
  | "applications"
  | "import_manifests"
  | "artifacts"
  | "operations"
  | "approvals";

const tableByKind: Readonly<Record<EntityKind, EntityTable>> = {
  workspace: "workspaces",
  source: "sources",
  profileFact: "profile_facts",
  searchProfile: "search_profiles",
  discoveryLead: "discovery_leads",
  opportunity: "opportunities",
  evidence: "evidence_items",
  rubric: "rubrics",
  evaluation: "evaluations",
  comparison: "comparisons",
  application: "applications",
  importManifest: "import_manifests",
  artifact: "artifacts",
  operation: "operations",
  approval: "approvals",
};

const writeTails = new Map<string, Promise<void>>();

async function withWorkspaceWriteLock<Result>(
  root: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  const previous = writeTails.get(root) ?? Promise.resolve();
  let release = (): void => undefined;
  const ticket = new Promise<void>((resolveTicket) => {
    release = resolveTicket;
  });
  const tail = previous.then(() => ticket);
  writeTails.set(root, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (writeTails.get(root) === tail) writeTails.delete(root);
  }
}

export type Mutation =
  | {
      readonly action: "insert";
      readonly kind: EntityKind;
      readonly entity: RecordEntity;
    }
  | {
      readonly action: "update";
      readonly kind: EntityKind;
      readonly entity: RecordEntity;
      readonly expectedRevision: number;
    };

export interface EventToAppend {
  readonly eventKind: string;
  readonly aggregateId: string;
  readonly aggregateRevision: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UtcTimestamp;
  readonly actor: ActorClass;
  readonly operationId?: EntityId;
}

export interface CommitRequest<Result> {
  readonly workspaceId: WorkspaceId;
  readonly context: CommandContext;
  readonly command: unknown;
  readonly mutations: readonly Mutation[];
  readonly events: readonly EventToAppend[];
  readonly result: Result;
}

export interface WorkspaceHealth {
  readonly schemaVersion: number;
  readonly foreignKeys: boolean;
  readonly journalMode: string;
  readonly integrity: "ok" | "corrupt";
  readonly lastSequence: number;
}

function entityState(entity: RecordEntity): string | null {
  if ("state" in entity && typeof entity.state === "string")
    return entity.state;
  if ("status" in entity && typeof entity.status === "string")
    return entity.status;
  if ("decision" in entity && typeof entity.decision === "string")
    return entity.decision;
  if ("workflowState" in entity && typeof entity.workflowState === "string") {
    return entity.workflowState;
  }
  return null;
}

function toRow(entity: RecordEntity): EntityRow {
  const workspaceId = "workspaceId" in entity ? entity.workspaceId : entity.id;
  return {
    id: entity.id,
    workspace_id: workspaceId,
    revision: entity.revision,
    state: entityState(entity),
    record_json: canonicalJson(entity),
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  };
}

function parseEntity(row: EntityRow): RecordEntity {
  return JSON.parse(row.record_json) as RecordEntity;
}

async function migrate(
  db: Kysely<DatabaseSchema>,
  timestamp: UtcTimestamp,
): Promise<void> {
  await sql`PRAGMA foreign_keys = ON`.execute(db);
  await sql`PRAGMA journal_mode = WAL`.execute(db);
  await sql`PRAGMA busy_timeout = 5000`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT
  `.execute(db);
  const existing = await db
    .selectFrom("schema_migrations")
    .select("version")
    .orderBy("version", "desc")
    .executeTakeFirst();
  if ((existing?.version ?? 0) < 1) {
    await db.transaction().execute(async (transaction) => {
      await sql`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL UNIQUE,
        revision INTEGER NOT NULL CHECK(revision > 0),
        state TEXT,
        record_json TEXT NOT NULL CHECK(json_valid(record_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT
    `.execute(transaction);
      for (const table of [
        "sources",
        "profile_facts",
        "opportunities",
        "evidence_items",
        "rubrics",
        "evaluations",
        "applications",
        "artifacts",
        "operations",
        "approvals",
      ]) {
        await sql
          .raw(
            `
        CREATE TABLE ${table} (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
          revision INTEGER NOT NULL CHECK(revision > 0),
          state TEXT,
          record_json TEXT NOT NULL CHECK(json_valid(record_json)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT
      `,
          )
          .execute(transaction);
        await sql
          .raw(
            `CREATE INDEX ${table}_workspace_updated ON ${table}(workspace_id, updated_at, id)`,
          )
          .execute(transaction);
      }
      await sql`
      CREATE TABLE domain_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        event_kind TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK(schema_version > 0),
        aggregate_id TEXT NOT NULL,
        aggregate_revision INTEGER NOT NULL CHECK(aggregate_revision > 0),
        command_id TEXT NOT NULL,
        operation_id TEXT,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL
      ) STRICT
    `.execute(transaction);
      await sql`CREATE INDEX domain_events_workspace_sequence ON domain_events(workspace_id, sequence)`.execute(
        transaction,
      );
      await sql`
      CREATE TABLE idempotency_commands (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        idempotency_key TEXT NOT NULL,
        command_digest TEXT NOT NULL,
        result_json TEXT NOT NULL CHECK(json_valid(result_json)),
        command_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, idempotency_key)
      ) STRICT
    `.execute(transaction);
      await transaction
        .insertInto("schema_migrations")
        .values({ version: 1, name: "001_initial", applied_at: timestamp })
        .execute();
    });
  }
  if ((existing?.version ?? 0) < 2) {
    await db.transaction().execute(async (transaction) => {
      await sql`
        CREATE TABLE IF NOT EXISTS comparisons (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
          revision INTEGER NOT NULL CHECK(revision > 0),
          state TEXT,
          record_json TEXT NOT NULL CHECK(json_valid(record_json)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT
      `.execute(transaction);
      await sql`
        CREATE INDEX IF NOT EXISTS comparisons_workspace_updated
        ON comparisons(workspace_id, updated_at, id)
      `.execute(transaction);
      await transaction
        .insertInto("schema_migrations")
        .values({
          version: 2,
          name: "002_comparisons",
          applied_at: timestamp,
        })
        .execute();
    });
  }
  if ((existing?.version ?? 0) < 3) {
    await db.transaction().execute(async (transaction) => {
      await sql`
        CREATE TABLE IF NOT EXISTS import_manifests (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
          revision INTEGER NOT NULL CHECK(revision > 0),
          state TEXT,
          record_json TEXT NOT NULL CHECK(json_valid(record_json)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT
      `.execute(transaction);
      await sql`
        CREATE INDEX IF NOT EXISTS import_manifests_workspace_updated
        ON import_manifests(workspace_id, updated_at, id)
      `.execute(transaction);
      await transaction
        .insertInto("schema_migrations")
        .values({
          version: 3,
          name: "003_import_manifests",
          applied_at: timestamp,
        })
        .execute();
    });
  }
  if ((existing?.version ?? 0) < 4) {
    await db.transaction().execute(async (transaction) => {
      await sql`
        UPDATE opportunities
        SET record_json = json_set(record_json, '$.legitimacyStatus', 'unknown')
        WHERE json_type(record_json, '$.legitimacyStatus') IS NULL
      `.execute(transaction);
      await transaction
        .insertInto("schema_migrations")
        .values({
          version: 4,
          name: "004_opportunity_legitimacy",
          applied_at: timestamp,
        })
        .execute();
    });
  }
  if ((existing?.version ?? 0) < 5) {
    await db.transaction().execute(async (transaction) => {
      for (const table of ["search_profiles", "discovery_leads"]) {
        await sql
          .raw(
            `
              CREATE TABLE IF NOT EXISTS ${table} (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
                revision INTEGER NOT NULL CHECK(revision > 0),
                state TEXT,
                record_json TEXT NOT NULL CHECK(json_valid(record_json)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              ) STRICT
            `,
          )
          .execute(transaction);
        await sql
          .raw(
            `CREATE INDEX IF NOT EXISTS ${table}_workspace_updated ON ${table}(workspace_id, updated_at, id)`,
          )
          .execute(transaction);
      }
      await transaction
        .insertInto("schema_migrations")
        .values({
          version: 5,
          name: "005_search_discovery",
          applied_at: timestamp,
        })
        .execute();
    });
  }
  if ((existing?.version ?? 0) < 6) {
    await db.transaction().execute(async (transaction) => {
      const inputRows = await transaction
        .selectFrom("search_profiles")
        .select(["id", "revision", "record_json"])
        .execute();
      const opportunityRows = await transaction
        .selectFrom("opportunities")
        .select(["id", "revision", "record_json"])
        .execute();
      const inputs = new Map(
        [...inputRows, ...opportunityRows].map((row) => [row.id, row] as const),
      );
      const operationRows = await transaction
        .selectFrom("operations")
        .select(["id", "record_json"])
        .execute();
      const operations = new Map<string, Operation>();
      for (const row of operationRows) {
        const legacy = JSON.parse(row.record_json) as Omit<
          Operation,
          "inputRevision" | "inputDigest" | "resourceLimits"
        > &
          Partial<
            Pick<Operation, "inputRevision" | "inputDigest" | "resourceLimits">
          >;
        if (
          legacy.inputRevision === undefined ||
          legacy.inputDigest === undefined ||
          legacy.resourceLimits === undefined
        ) {
          const input =
            legacy.inputIdentity === null
              ? undefined
              : inputs.get(legacy.inputIdentity);
          const bound = {
            ...legacy,
            inputRevision: input?.revision ?? null,
            inputDigest:
              input === undefined
                ? null
                : createHash("sha256")
                    .update(canonicalJson(JSON.parse(input.record_json)))
                    .digest("hex"),
            resourceLimits:
              legacy.kind === "job_discovery"
                ? {
                    maximumLeads: 64,
                    maximumLeadsPerHost: 20,
                    maximumSourceBytes: 8 * 1024 * 1024,
                  }
                : {},
          } as Operation;
          await transaction
            .updateTable("operations")
            .set({ record_json: canonicalJson(bound) })
            .where("id", "=", row.id)
            .execute();
          operations.set(row.id, bound);
        } else {
          operations.set(row.id, legacy as Operation);
        }
      }
      const leadRows = await transaction
        .selectFrom("discovery_leads")
        .select(["id", "record_json"])
        .execute();
      for (const row of leadRows) {
        const lead = JSON.parse(row.record_json) as Omit<
          DiscoveryLead,
          "searchProfileId" | "searchProfileRevision" | "searchCriteriaDigest"
        > &
          Partial<
            Pick<
              DiscoveryLead,
              | "searchProfileId"
              | "searchProfileRevision"
              | "searchCriteriaDigest"
            >
          >;
        if (lead.searchProfileId !== undefined) continue;
        const operation = operations.get(lead.operationId);
        if (
          operation?.inputIdentity === null ||
          operation?.inputIdentity === undefined ||
          operation.inputRevision === null ||
          operation.inputDigest === null
        ) {
          throw new DomainError(
            "internal_error",
            "Legacy discovery lead cannot be bound to its search criteria.",
          );
        }
        const bound: DiscoveryLead = {
          ...lead,
          searchProfileId: operation.inputIdentity,
          searchProfileRevision: operation.inputRevision,
          searchCriteriaDigest: operation.inputDigest,
        };
        await transaction
          .updateTable("discovery_leads")
          .set({ record_json: canonicalJson(bound) })
          .where("id", "=", row.id)
          .execute();
      }
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS search_profiles_one_per_workspace
        ON search_profiles(workspace_id)
      `.execute(transaction);
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS discovery_leads_workspace_url
        ON discovery_leads(workspace_id, json_extract(record_json, '$.normalizedUrl'))
      `.execute(transaction);
      await transaction
        .insertInto("schema_migrations")
        .values({
          version: 6,
          name: "006_discovery_integrity",
          applied_at: timestamp,
        })
        .execute();
    });
  }
}

function assertBackupLabel(label: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(label)) {
    throw new DomainError("invalid_request", "Backup label is invalid.");
  }
}

function verifySqliteFile(path: string): void {
  const verification = new Database(path, { readonly: true });
  try {
    const result = verification.pragma("integrity_check", { simple: true });
    if (result !== "ok") {
      throw new DomainError(
        "internal_error",
        "SQLite integrity verification failed.",
      );
    }
  } finally {
    verification.close();
  }
}

export interface RestoreResult {
  readonly rollbackRelativePath: string;
  readonly store: SqliteWorkspaceStore;
}

/**
 * Restores a workspace-local SQLite backup after the server/store is closed.
 * The displaced database is preserved as a verified rollback backup.
 */
export async function restoreWorkspaceBackup(
  root: string,
  label: string,
  timestamp: UtcTimestamp,
): Promise<RestoreResult> {
  assertBackupLabel(label);
  const safeRoot = await assertSafeWorkspaceRoot(root);
  const source = resolveWorkspaceRelative(safeRoot, `backups/${label}.sqlite`);
  verifySqliteFile(source);

  const databasePath = resolveWorkspaceRelative(
    safeRoot,
    "career-workbench.sqlite",
  );
  const unique = randomUUID();
  const staged = resolveWorkspaceRelative(
    safeRoot,
    `backups/.restore-${unique}.sqlite`,
  );
  const displaced = resolveWorkspaceRelative(
    safeRoot,
    `backups/.displaced-${unique}.sqlite`,
  );
  const rollbackRelativePath = `backups/pre-restore-${unique}.sqlite`;
  const rollback = resolveWorkspaceRelative(safeRoot, rollbackRelativePath);

  const current = new Database(databasePath, { readonly: true });
  try {
    await current.backup(rollback);
  } finally {
    current.close();
  }
  verifySqliteFile(rollback);
  await copyFile(source, staged, constants.COPYFILE_EXCL);
  verifySqliteFile(staged);

  let preserveDisplaced = false;
  try {
    await rename(databasePath, displaced);
    preserveDisplaced = true;
    try {
      await rename(staged, databasePath);
    } catch (error) {
      try {
        await rename(displaced, databasePath);
        preserveDisplaced = false;
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "The restore failed and the displaced database could not be put back. The displaced file was preserved for manual recovery.",
          { cause: rollbackError },
        );
      }
      throw error;
    }
    await rm(displaced, { force: true });
    preserveDisplaced = false;
    await Promise.all([
      rm(`${databasePath}-shm`, { force: true }),
      rm(`${databasePath}-wal`, { force: true }),
    ]);
    return {
      rollbackRelativePath,
      store: await SqliteWorkspaceStore.open(safeRoot, timestamp),
    };
  } finally {
    await rm(staged, { force: true });
    if (!preserveDisplaced) {
      await rm(displaced, { force: true });
    }
  }
}

export class SqliteWorkspaceStore {
  private constructor(
    public readonly root: string,
    private readonly native: Database.Database,
    private readonly db: Kysely<DatabaseSchema>,
  ) {}

  public static async create(
    root: string,
    timestamp: UtcTimestamp,
  ): Promise<SqliteWorkspaceStore> {
    let safeRoot = await assertSafeWorkspaceRoot(root);
    await mkdir(dirname(safeRoot), { recursive: true, mode: 0o700 });
    // Creating a missing parent changes the filesystem boundary. Validate the
    // complete chain again before exclusively creating the workspace itself.
    safeRoot = await assertSafeWorkspaceRoot(safeRoot);
    await mkdir(safeRoot, { recursive: false, mode: 0o700 });
    await Promise.all(
      ["artifacts", "exports", "backups"].map((directory) =>
        mkdir(resolveWorkspaceRelative(safeRoot, directory)),
      ),
    );
    await writeFile(
      resolveWorkspaceRelative(safeRoot, "config.toml"),
      `contract_version = "v1"\nschema_version = ${String(CURRENT_SCHEMA_VERSION)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    return SqliteWorkspaceStore.open(safeRoot, timestamp);
  }

  public static async open(
    root: string,
    timestamp: UtcTimestamp,
  ): Promise<SqliteWorkspaceStore> {
    const safeRoot = await assertSafeWorkspaceRoot(root);
    const databasePath = resolveWorkspaceRelative(
      safeRoot,
      "career-workbench.sqlite",
    );
    const native = new Database(databasePath);
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: native }),
    });
    try {
      await migrate(db, timestamp);
      const configPath = resolveWorkspaceRelative(safeRoot, "config.toml");
      const config = await readFile(configPath, "utf8");
      const synchronized = /(?:^|\n)schema_version\s*=\s*\d+(?:\n|$)/u.test(
        config,
      )
        ? config.replace(
            /(^|\n)schema_version\s*=\s*\d+(?=\n|$)/u,
            `$1schema_version = ${String(CURRENT_SCHEMA_VERSION)}`,
          )
        : `${config.replace(/\s*$/u, "")}\nschema_version = ${String(CURRENT_SCHEMA_VERSION)}\n`;
      if (synchronized !== config) {
        await writeFile(configPath, synchronized, {
          encoding: "utf8",
          mode: 0o600,
        });
      }
      return new SqliteWorkspaceStore(safeRoot, native, db);
    } catch (error) {
      await db.destroy();
      throw error;
    }
  }

  public async commit<Result>(request: CommitRequest<Result>): Promise<Result> {
    if (
      request.mutations.length === 0 ||
      request.events.length !== request.mutations.length
    ) {
      throw new DomainError(
        "invalid_request",
        "Every committed mutation requires one audit event.",
      );
    }
    const digest = createHash("sha256")
      .update(canonicalJson(request.command))
      .digest("hex");
    return withWorkspaceWriteLock(this.root, () =>
      this.db.transaction().execute(async (transaction) => {
        const prior = await transaction
          .selectFrom("idempotency_commands")
          .select(["command_digest", "result_json"])
          .where("workspace_id", "=", request.workspaceId)
          .where("idempotency_key", "=", request.context.idempotencyKey)
          .executeTakeFirst();
        if (prior !== undefined) {
          if (prior.command_digest !== digest) {
            throw new DomainError(
              "duplicate_identity",
              "Idempotency key was reused with different command content.",
            );
          }
          return JSON.parse(prior.result_json) as Result;
        }
        for (const mutation of request.mutations) {
          await this.applyMutation(transaction, mutation);
        }
        for (const event of request.events) {
          await transaction
            .insertInto("domain_events")
            .values({
              workspace_id: request.workspaceId,
              event_kind: event.eventKind,
              schema_version: 1,
              aggregate_id: event.aggregateId,
              aggregate_revision: event.aggregateRevision,
              command_id: request.context.commandId,
              operation_id: event.operationId ?? null,
              payload_json: canonicalJson(event.payload),
              timestamp: event.timestamp,
              actor: event.actor,
            })
            .execute();
        }
        await transaction
          .insertInto("idempotency_commands")
          .values({
            workspace_id: request.workspaceId,
            idempotency_key: request.context.idempotencyKey,
            command_digest: digest,
            result_json: canonicalJson(request.result),
            command_id: request.context.commandId,
            created_at:
              request.events[0]?.timestamp ?? new Date().toISOString(),
          })
          .execute();
        return request.result;
      }),
    );
  }

  private async applyMutation(
    transaction: Transaction<DatabaseSchema>,
    mutation: Mutation,
  ): Promise<void> {
    const table = tableByKind[mutation.kind];
    const row = toRow(mutation.entity);
    if (mutation.action === "insert") {
      try {
        await transaction.insertInto(table).values(row).execute();
      } catch (error) {
        if (
          (error as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT") ===
          true
        ) {
          throw new DomainError(
            "duplicate_identity",
            "Entity identity already exists.",
          );
        }
        throw error;
      }
      return;
    }
    if (row.revision !== mutation.expectedRevision + 1) {
      throw new DomainError(
        "revision_conflict",
        "Updated entity revision is not monotonic.",
      );
    }
    const result = await transaction
      .updateTable(table)
      .set(row)
      .where("id", "=", row.id)
      .where("workspace_id", "=", row.workspace_id)
      .where("revision", "=", mutation.expectedRevision)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) {
      throw new DomainError(
        "revision_conflict",
        "Expected entity revision is stale.",
      );
    }
  }

  public async get<Kind extends EntityKind>(
    kind: Kind,
    id: string,
  ): Promise<EntityByKind[Kind]> {
    const row = await this.db
      .selectFrom(tableByKind[kind] as "sources")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (row === undefined)
      throw new DomainError("entity_not_found", "Entity does not exist.");
    return parseEntity(row) as EntityByKind[Kind];
  }

  public async findWorkspace(): Promise<Workspace | null> {
    const row = await this.db
      .selectFrom("workspaces")
      .selectAll()
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    return row === undefined ? null : (parseEntity(row) as Workspace);
  }

  public async list<Kind extends EntityKind>(
    kind: Kind,
    workspaceId: WorkspaceId,
  ): Promise<EntityByKind[Kind][]> {
    const rows = await this.db
      .selectFrom(tableByKind[kind] as "sources")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute();
    return rows.map((row) => parseEntity(row) as EntityByKind[Kind]);
  }

  public async eventsAfter(
    workspaceId: WorkspaceId,
    sequence: number,
    limit = 100,
  ): Promise<DomainEvent[]> {
    if (
      !Number.isInteger(sequence) ||
      sequence < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000
    ) {
      throw new DomainError(
        "invalid_request",
        "Event cursor or limit is invalid.",
      );
    }
    const rows = await this.db
      .selectFrom("domain_events")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("sequence", ">", sequence)
      .orderBy("sequence", "asc")
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      sequence: row.sequence,
      eventKind: row.event_kind,
      schemaVersion: row.schema_version,
      workspaceId: row.workspace_id as WorkspaceId,
      aggregateId: row.aggregate_id as EntityId,
      aggregateRevision: row.aggregate_revision,
      commandId: row.command_id as EntityId,
      operationId: row.operation_id as EntityId | null,
      payload: JSON.parse(row.payload_json) as Readonly<
        Record<string, unknown>
      >,
      timestamp: row.timestamp as UtcTimestamp,
      actor: row.actor as ActorClass,
    }));
  }

  public async recentEvents(
    workspaceId: WorkspaceId,
    limit = 100,
  ): Promise<DomainEvent[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new DomainError(
        "invalid_request",
        "Recent event limit is invalid.",
      );
    }
    const rows = await this.db
      .selectFrom("domain_events")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("sequence", "desc")
      .limit(limit)
      .execute();
    return rows.reverse().map((row) => ({
      sequence: row.sequence,
      eventKind: row.event_kind,
      schemaVersion: row.schema_version,
      workspaceId: row.workspace_id as WorkspaceId,
      aggregateId: row.aggregate_id as EntityId,
      aggregateRevision: row.aggregate_revision,
      commandId: row.command_id as EntityId,
      operationId: row.operation_id as EntityId | null,
      payload: JSON.parse(row.payload_json) as Readonly<
        Record<string, unknown>
      >,
      timestamp: row.timestamp as UtcTimestamp,
      actor: row.actor as ActorClass,
    }));
  }

  public async eventsBefore(
    workspaceId: WorkspaceId,
    sequence: number,
    limit = 100,
  ): Promise<DomainEvent[]> {
    if (
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000
    ) {
      throw new DomainError(
        "invalid_request",
        "Historical event cursor or limit is invalid.",
      );
    }
    const rows = await this.db
      .selectFrom("domain_events")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("sequence", "<", sequence)
      .orderBy("sequence", "desc")
      .limit(limit)
      .execute();
    return rows.reverse().map((row) => ({
      sequence: row.sequence,
      eventKind: row.event_kind,
      schemaVersion: row.schema_version,
      workspaceId: row.workspace_id as WorkspaceId,
      aggregateId: row.aggregate_id as EntityId,
      aggregateRevision: row.aggregate_revision,
      commandId: row.command_id as EntityId,
      operationId: row.operation_id as EntityId | null,
      payload: JSON.parse(row.payload_json) as Readonly<
        Record<string, unknown>
      >,
      timestamp: row.timestamp as UtcTimestamp,
      actor: row.actor as ActorClass,
    }));
  }

  public async health(): Promise<WorkspaceHealth> {
    const foreignKeys = await sql<{
      foreign_keys: number;
    }>`PRAGMA foreign_keys`.execute(this.db);
    const journalMode = await sql<{
      journal_mode: string;
    }>`PRAGMA journal_mode`.execute(this.db);
    const integrity = await sql<{
      integrity_check: string;
    }>`PRAGMA integrity_check`.execute(this.db);
    const migration = await this.db
      .selectFrom("schema_migrations")
      .select("version")
      .orderBy("version", "desc")
      .executeTakeFirst();
    const event = await this.db
      .selectFrom("domain_events")
      .select("sequence")
      .orderBy("sequence", "desc")
      .executeTakeFirst();
    return {
      schemaVersion: migration?.version ?? 0,
      foreignKeys: foreignKeys.rows[0]?.foreign_keys === 1,
      journalMode: journalMode.rows[0]?.journal_mode ?? "unknown",
      integrity: integrity.rows[0]?.integrity_check === "ok" ? "ok" : "corrupt",
      lastSequence: event?.sequence ?? 0,
    };
  }

  public async backup(label: string): Promise<string> {
    assertBackupLabel(label);
    const relativePath = `backups/${label}.sqlite`;
    const destination = resolveWorkspaceRelative(this.root, relativePath);
    await this.native.backup(destination);
    verifySqliteFile(destination);
    return relativePath;
  }

  public async normalizedExport(
    workspaceId: WorkspaceId,
  ): Promise<Readonly<Record<string, unknown>>> {
    const kinds = Object.keys(tableByKind) as EntityKind[];
    const records: Record<string, unknown> = {};
    for (const kind of kinds)
      records[kind] = await this.list(kind, workspaceId);
    const events: DomainEvent[] = [];
    let cursor = 0;
    for (;;) {
      const page = await this.eventsAfter(workspaceId, cursor, 1000);
      events.push(...page);
      if (page.length < 1000) break;
      cursor = page.at(-1)?.sequence ?? cursor;
    }
    const body = { schemaVersion: 1, records, events };
    return {
      ...body,
      manifest: {
        schemaVersion: 1,
        digest: createHash("sha256").update(canonicalJson(body)).digest("hex"),
      },
    };
  }

  public async close(): Promise<void> {
    await this.db.destroy();
  }

  public async readConfig(): Promise<string> {
    return readFile(resolveWorkspaceRelative(this.root, "config.toml"), "utf8");
  }
}
