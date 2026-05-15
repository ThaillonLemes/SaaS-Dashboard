# Architecture Decision Record Template

_Copy to `./decisions/ADR-NNNN-<slug>.md`. ADRs are immutable once accepted — to revise, create a new ADR that supersedes._

---

# ADR-NNNN: <Decision title>

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
- **Date:** YYYY-MM-DD
- **Deciders:** <names or roles>
- **Tags:** <e.g., infrastructure, frontend, database>

## Context

What is the situation that prompts this decision? What forces are at play?
Include both technical and business constraints if relevant.

Be specific: the next person reading this in 2 years should understand the
state of the world when the decision was made.

## Decision

The decision in one paragraph. Should answer: "What did we choose?"

## Alternatives considered

For each alternative:

### Alternative A: <name>

- Pros: ...
- Cons: ...
- Rejected because: <one sentence>

### Alternative B: <name>

- Pros: ...
- Cons: ...
- Rejected because: <one sentence>

(Consider at least 2 alternatives. "We just used X because it's popular" is
not enough.)

## Consequences

### Positive

- ...

### Negative

- ...
- (Be honest about trade-offs. Every decision has costs.)

### Neutral / informational

- ...

## Validation

How will we know if this decision was correct? Examples:
- Metric: <name> stays below <threshold> for 6 months.
- Behavior: <observable behavior> works in <conditions>.
- Reconsideration trigger: <event that would prompt revisit>.

## Implementation impact

- New blocks required: <list>
- Migrations required: <list>
- Estimated effort: <S / M / L>

## References

- Related ADRs: <list>
- External resources: <links to docs, blog posts, RFCs>
- Issue tracker: <link>

---

## Notes

- Once an ADR is Accepted, do not edit the body. To revise, create a new ADR
  that supersedes this one (set `Status: Superseded by ADR-MMMM`).
- ADRs are append-only. The historical record matters more than the current
  one — future engineers learn from the path, not the destination.
