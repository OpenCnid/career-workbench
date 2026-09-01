import type {
  ActorClass,
  Application,
  Approval,
  Artifact,
  CommandContext,
  Comparison,
  DiscoveryLead,
  Digest,
  DomainEvent,
  EntityId,
  Evaluation,
  EvidenceItem,
  ImportManifest,
  Opportunity,
  Operation,
  ProfileFact,
  Rubric,
  SearchProfile,
  SourceDocument,
  UtcTimestamp,
  Workspace,
  WorkspaceId,
} from "@career-workbench/domain";

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
export type EntityKind = keyof EntityByKind;
type RecordEntity = EntityByKind[EntityKind];

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

export interface WorkspaceRepository {
  commit<Result>(request: CommitRequest<Result>): Promise<Result>;
  get<Kind extends EntityKind>(
    kind: Kind,
    id: string,
  ): Promise<EntityByKind[Kind]>;
  list<Kind extends EntityKind>(
    kind: Kind,
    workspaceId: WorkspaceId,
  ): Promise<EntityByKind[Kind][]>;
  eventsAfter(
    workspaceId: WorkspaceId,
    sequence: number,
    limit?: number,
  ): Promise<DomainEvent[]>;
  recentEvents(
    workspaceId: WorkspaceId,
    limit?: number,
  ): Promise<DomainEvent[]>;
  eventsBefore(
    workspaceId: WorkspaceId,
    sequence: number,
    limit?: number,
  ): Promise<DomainEvent[]>;
  normalizedExport(
    workspaceId: WorkspaceId,
  ): Promise<Readonly<Record<string, unknown>>>;
}

export interface SealedBytes {
  readonly contentDigest: Digest;
  readonly byteLength: number;
  readonly relativePath: string;
}

export interface ArtifactRepository {
  seal(content: Uint8Array, mediaType: string): Promise<SealedBytes>;
  read(sealed: SealedBytes): Promise<Uint8Array>;
}
