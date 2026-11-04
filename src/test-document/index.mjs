// MOD-test-document — the declaration of a test case (docs/architecture/MOD-test-document.md): its interface. Of it,
// ITM-248 builds TestDeclaration and testDeclarations, ITM-304 builds testFindings, and ITM-380 builds isTestFile, ITM-1211 builds isNamedTestFile; testHeader
// reads the header of a test file or a test helper.
//
// Module: MOD-test-document
//
// It belongs to the artifact model (ARC-048). It runs unchanged in a browser and in Node, keeps no state, performs no
// input or output.

/**
 * One test declaration, as MOD-test-document's Data states it: a block of comment lines directly before a test case, in
 * the comment marker of the file's language, or, for a manual test of level `user`, the same lines under a heading
 * `### TST-<nnn> <title>` of a Markdown file. A missing key reads `null`.
 * `id` is `null` only in a declaration unidentifiedDeclarations gives.
 * @typedef {{
 *   id: string | null,
 *   title: string | null,
 *   level: "unit" | "component" | "system" | "release" | "user" | null,
 *   module: string | null,
 *   guards: string[] | null,
 *   given: string | null,
 *   input: string | null,
 *   expect: string | null,
 *   runs: number | null,
 *   phrasings: number | null,
 *   paid: string | null,
 *   path: string,
 *   line: number,
 * }} TestDeclaration
 */

export { isNamedTestFile, isTestFile, testDeclarations, unidentifiedDeclarations } from "./declarations.mjs";
export { testFindings } from "./checks.mjs";
export { testHeader } from "./header.mjs";
