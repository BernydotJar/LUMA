#!/usr/bin/env node
// Real provider smoke; run with a dedicated TEST-only institutional certificate.
// Never commits/prints private keys, the PKCS12 password, or complete response bodies.
import { readFile } from "node:fs/promises";
import { createHash, X509Certificate } from "node:crypto";

const [inputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error("Usage: node scripts/certificates/stirling-smoke.mjs /path/to/unsigned-test.pdf");
  process.exit(2);
}
const base = process.env.STIRLING_PDF_BASE_URL;
const p12Path = process.env.STIRLING_P12_PATH;
const certPath = process.env.STIRLING_SIGNER_CERT_PEM_PATH;
const password = process.env.STIRLING_P12_PASSWORD;
if (!base || !p12Path || !certPath || !password) {
  console.error("Configure STIRLING_PDF_BASE_URL, STIRLING_P12_PATH, STIRLING_SIGNER_CERT_PEM_PATH and STIRLING_P12_PASSWORD");
  process.exit(2);
}
const baseUrl = new URL(base);
if (!["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash ||
    baseUrl.pathname !== "/") throw new Error("Invalid signing origin");
if (baseUrl.protocol === "http:" &&
    !["stirling-pdf", "localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("Plain HTTP is only allowed on the private signing host");
}
const [original, keystore, signerCert] = await Promise.all([
  readFile(inputPath), readFile(p12Path), readFile(certPath, "utf8"),
]);
const leaf = new X509Certificate(signerCert);
const serial = leaf.serialNumber.replace(/^0+/, "").toLowerCase() || "0";
const header = { ...(process.env.STIRLING_API_KEY ? { "X-API-KEY": process.env.STIRLING_API_KEY } : {}) };
const post = async (route, form) => {
  const response = await fetch(baseUrl.origin + route, {
    method: "POST", headers: header, body: form,
    redirect: "error", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Stirling returned HTTP " + response.status);
  return response;
};
if (original.length < 100 || original.subarray(0, 5).toString() !== "%PDF-") {
  throw new Error("Input must be a real PDF");
}
const sign = new FormData();
sign.append("fileInput", new Blob([new Uint8Array(original)], { type: "application/pdf" }), "test.pdf");
sign.append("p12File", new Blob([new Uint8Array(keystore)], { type: "application/x-pkcs12" }), "test.p12");
sign.append("certType", "PKCS12");
sign.append("password", password);
sign.append("showSignature", "false");
sign.append("name", "LUMA TEST - NOT VALID FOR REAL ISSUANCE");
const signedResponse = await post("/api/v1/security/cert-sign", sign);
const signed = Buffer.from(await signedResponse.arrayBuffer());
if (signed.length < 100 || signed.subarray(0, 5).toString() !== "%PDF-") {
  throw new Error("Stirling did not return a PDF");
}
const validate = new FormData();
validate.append("fileInput", new Blob([new Uint8Array(signed)], { type: "application/pdf" }), "signed.pdf");
if (process.env.STIRLING_TRUST_ANCHOR_CERT_PATH) {
  const anchor = await readFile(process.env.STIRLING_TRUST_ANCHOR_CERT_PATH);
  validate.append("certFile", new Blob([new Uint8Array(anchor)]), "trust-anchor.pem");
}
const validations = await (await post("/api/v1/security/validate-signature", validate)).json();
if (!Array.isArray(validations) || validations.length !== 1) {
  throw new Error("Expected exactly one signature");
}
const proof = validations[0];
if (proof.valid !== true || proof.coversEntireDocument !== true ||
    proof.chainValid !== true || proof.trustValid !== true ||
    proof.notExpired !== true || proof.selfSigned !== false ||
    proof.revocationChecked !== true || proof.revocationStatus !== "good" ||
    String(proof.serialNumber || "").replace(/^0+/, "").toLowerCase() !== serial) {
  throw new Error("Signed PDF did not pass institutional verification gates");
}
console.log("PASS: cryptographic signature valid, X.509 signer pinned, chain trusted, full PDF covered, revocation checked");
console.log("signed PDF SHA-256:", createHash("sha256").update(signed).digest("hex"));
