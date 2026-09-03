import type {
  EvidenceItem,
  ProfileFact,
  SourceDocument,
  SourceLocator,
} from "./entities.js";
import { canonicalJson } from "./canonical.js";
import { assertDomain } from "./errors.js";

export type FactConfirmationOutcome =
  | { readonly kind: "confirm" }
  | {
      readonly kind: "correct";
      readonly value: ProfileFact["value"];
      readonly locator: SourceLocator;
    }
  | { readonly kind: "narrative_only" }
  | { readonly kind: "cannot_confirm" };

export function renderProfileFactClaim(
  fact: Pick<ProfileFact, "subject" | "predicate" | "value">,
): string {
  return `${fact.subject} ${fact.predicate} ${String(fact.value)}`;
}

function normalizeEvidenceText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

/**
 * Stable rejection identity for an evidence assertion. Source bytes, rather
 * than generated entity IDs, prevent a recaptured copy from reviving a
 * rejected claim. A genuinely different source or locator remains distinct.
 */
export function evidenceRejectionIdentity(
  evidence: Pick<EvidenceItem, "claim" | "sourceId" | "locator">,
  source: SourceDocument | null,
): string {
  assertDomain(
    evidence.sourceId === null
      ? source === null
      : source?.id === evidence.sourceId,
    "evidence_locator_invalid",
    "Evidence rejection identity requires its exact captured source.",
  );
  return canonicalJson({
    claim: normalizeEvidenceText(evidence.claim),
    source:
      source === null
        ? null
        : {
            contentDigest: source.contentDigest,
            locator:
              evidence.locator === null
                ? null
                : {
                    start: evidence.locator.start,
                    end: evidence.locator.end,
                    quote: normalizeEvidenceText(evidence.locator.quote),
                  },
          },
  });
}

export function validateSourceLocator(
  source: SourceDocument,
  locator: SourceLocator,
): void {
  assertDomain(
    locator.sourceId === source.id,
    "evidence_locator_invalid",
    "Locator source does not match.",
  );
  assertDomain(
    Number.isInteger(locator.start) && Number.isInteger(locator.end),
    "evidence_locator_invalid",
    "Locator offsets must be integers.",
  );
  assertDomain(
    locator.start >= 0 && locator.end > locator.start,
    "evidence_locator_invalid",
    "Locator offsets are invalid.",
  );
  assertDomain(
    source.inlineText !== null,
    "evidence_locator_invalid",
    "The source is not available as bounded text.",
  );
  assertDomain(
    source.inlineText.slice(locator.start, locator.end) === locator.quote,
    "evidence_locator_invalid",
    "Locator quote does not match immutable source bytes.",
  );
}

export function validateEvidenceForAcceptance(
  evidence: EvidenceItem,
  source: SourceDocument | null,
  candidateFact: ProfileFact | null,
): void {
  assertDomain(
    evidence.decision === "proposed",
    "invalid_transition",
    "Only proposed evidence can be decided.",
  );
  if (evidence.classification === "gap") {
    assertDomain(
      evidence.sourceId === null && evidence.locator === null,
      "evidence_unsupported",
      "A gap cannot claim source support.",
    );
    return;
  }
  if (evidence.classification === "candidate_fact") {
    assertDomain(
      candidateFact?.status === "verified",
      "evidence_unsupported",
      "This action requires a current career detail chosen by the user.",
    );
    assertDomain(
      evidence.claim === renderProfileFactClaim(candidateFact),
      "evidence_unsupported",
      "The selected career detail must be used as a complete item without combining fragments.",
    );
    assertDomain(
      source?.trustClass === "candidate_primary",
      "evidence_unsupported",
      "The selected career detail must remain linked to its saved source.",
    );
  } else if (
    ["opportunity_fact", "company_fact", "market_fact"].includes(
      evidence.classification,
    )
  ) {
    assertDomain(
      source !== null,
      "evidence_unsupported",
      "External facts require source-bound support.",
    );
    assertDomain(
      source.trustClass === "external",
      "evidence_unsupported",
      "External facts require an external source.",
    );
    assertDomain(
      evidence.locator !== null && evidence.claim === evidence.locator.quote,
      "evidence_unsupported",
      "The complete external claim must match its source quote.",
    );
  } else {
    assertDomain(
      evidence.claim.length > 0,
      "evidence_unsupported",
      "Evidence claims cannot be empty.",
    );
  }
  if (source !== null && evidence.locator !== null) {
    validateSourceLocator(source, evidence.locator);
  }
}
