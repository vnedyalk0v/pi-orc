# ADR-0001: Use SDK-driven worker runtime

## Status

Accepted

## Context

`pi-orc` needs workflow-specific worker sessions for planning, verification, implementation, GitHub publishing, and review handling.

The package needs strong control over:

- clean context
- worker profiles
- allowed tools
- system prompts
- resources
- handoff contracts
- event collection
- workflow policy gates

Two options were considered:

1. CLI-driven workers
2. SDK-driven workers

CLI-driven workers would spawn external `pi` processes and communicate through CLI flags, JSON output, or RPC.

SDK-driven workers embed the Pi runtime directly through the Pi SDK.

## Decision

`pi-orc` will use SDK-driven workers from the beginning.

Workers will be created in-process using the Pi SDK.

The package will define a `WorkerRuntime` interface and implement it with `PiSdkWorkerRuntime`.

The implementation should use clean sessions and role-specific resource loading.

## Rationale

SDK-driven workers provide a stronger foundation for this package because `pi-orc` is not a generic CLI wrapper around Pi.

It is an opinionated workflow orchestrator.

Using the SDK allows the package to control:

- worker lifecycle
- context loading
- resource loading
- tool policy
- session isolation
- event subscriptions
- structured result collection

This avoids building the architecture around subprocess handling, stdout parsing, temporary prompts, and command-line flag composition.

## Consequences

### Positive

- Better control over clean-context workers
- Better control over worker resources
- Better event handling
- Better fit for workflow-specific orchestration
- No later migration from CLI-driven to SDK-driven architecture
- Cleaner integration with TypeScript code

### Negative

- Tighter coupling to the Pi SDK
- More upfront implementation work
- Requires version policy for Pi SDK compatibility
- Does not provide a security sandbox by itself

## Boundaries

SDK-driven workers are not a security boundary.

The orchestrator must still enforce:

- allowed tools
- file permissions
- GitHub mutation policy
- workflow modes
- confirmation gates
- artifact hygiene rules

## Implementation notes

The package should define:

- `WorkerRuntime`
- `PiSdkWorkerRuntime`
- `WorkerProfile`
- `WorkerHandoff`
- `WorkerRunResult`
- `createWorkerResourceLoader`

No CLI-driven worker runtime should be implemented in v0.1.
