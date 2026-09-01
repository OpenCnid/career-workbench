import type { SubagentIdentityProjection } from "@deepseek-ai/dsh-subagent";
import type {} from "@deepseek-ai/dsh-session-projection/types";

/**
 * Published DSH alpha.3 omits projection.ts's state-map augmentation from its
 * declaration entrypoint while retaining the corresponding public view-map
 * augmentation. This companion declaration restores that public type seam;
 * it does not add runtime behavior or access private continuation state.
 */
declare module "@deepseek-ai/dsh-session-projection/types" {
  interface SessionProjectionStateMap {
    subagentTiming: {
      settledMs: number;
      active?: { since: number; through: number };
      pendingTurnStart?: number;
      descriptorSeen: boolean;
    };
    subagent: { identity?: SubagentIdentityProjection };
  }
}

export {};
