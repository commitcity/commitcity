# 0004. MIT for code, CC BY-SA 4.0 for art, DCO for contributions

- **Status:** Accepted
- **Date:** 2026-10-08
- **Related:** [`CONTRIBUTING.md` §11](../../CONTRIBUTING.md#11-licensing), [`LICENSE`](../../LICENSE), [`ASSETS_LICENSE`](../../ASSETS_LICENSE)

## Context

CommitCity contains two different kinds of work: software and artwork. Contributors include developers and pixel artists. We want the code to be easy to reuse, the art to stay credited and open, and contributing to be simple.

## Decision

- **Code and documentation** are licensed under the **MIT License**.
- **Artwork** in `assets/` is licensed under **Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)**.
- Contributions are accepted under the **Developer Certificate of Origin (DCO)**, using signed-off commits, instead of a Contributor License Agreement.

## Alternatives considered

- **MIT for everything**: simplest, but art could be taken into closed products without sharing improvements; less attractive to artists.
- **CC BY 4.0 for art**: more permissive (no share-alike), but offers artists less protection.
- **GPL or AGPL for code**: stronger copyleft, but discourages reuse and some contributors.
- **CLA**: allows relicensing later, but adds friction and signals corporate control.

## Consequences

- Two license files must be maintained, and asset manifests must state authors and license.
- Forks may reuse the code freely; anyone modifying the art must share those modifications under CC BY-SA 4.0 and credit the authors.
- Without a CLA, relicensing the project later would require consent from contributors.
- AI-assisted art is accepted with disclosure, but its copyright status is uncertain; it is treated as replaceable (see `ART_DIRECTION.md` §14).
