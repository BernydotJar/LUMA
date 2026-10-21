import { createHash, createPublicKey, verify } from 'node:crypto';

/** Canonical JSON is part of the trust contract. Do not use JSON.stringify order. */
function serialize(value, depth=0){
  if(depth>32)throw Error('ACCEPTANCE_ATTESTATION_TOO_DEEP');
  if(value===null || typeof value==='string' || typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number' && Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(x=>serialize(x,depth+1)).join(',')+']';
  if(value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype){
    const keys=Object.keys(value).sort();
    return '{'+keys.map(k=>JSON.stringify(k)+':'+serialize(value[k],depth+1)).join(',')+'}';
  }
  throw Error('ACCEPTANCE_ATTESTATION_UNSUPPORTED_VALUE');
}
export function canonicalAcceptanceBytes(value){return Buffer.from(serialize(value),'utf8');}
export function acceptanceContentDigest(value){return createHash('sha256').update(canonicalAcceptanceBytes(value)).digest('hex');}
export function unsignedAcceptanceProof(proof){
  if(!proof||typeof proof!=='object'||Array.isArray(proof))throw Error('ACCEPTANCE_PROOF_INVALID');
  const {attestation, ...unsigned}=proof;
  void attestation;
  return unsigned;
}
/**
 * Trust anchors MUST be provisioned outside the repository by a protected CI
 * environment. A proof file cannot appoint its own reviewers or public key.
 */
export function verifyIndependentAcceptance(proof, trustStore, role, reviewer){
  if(!proof || !trustStore || trustStore.schemaVersion!=='luma.acceptance.trust.v1'||
     typeof reviewer!=='string'||reviewer.length<3||
     typeof role!=='string'||!Array.isArray(trustStore.keys))return false;
  const envelope=proof.attestation;
  if(!envelope || envelope.algorithm!=='Ed25519'||
     typeof envelope.keyId!=='string'||!/^[A-Za-z0-9._-]{3,100}$/.test(envelope.keyId)||
     typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))return false;
  const matching=trustStore.keys.filter(k=>k?.keyId===envelope.keyId);
  if(matching.length!==1)return false;
  const key=matching[0];
  if(key.subject!==reviewer||key.revoked===true||!Array.isArray(key.roles)||
     !key.roles.includes(role)||typeof key.publicKeyPem!=='string')return false;
  try {
    const pem=createPublicKey(key.publicKeyPem);
    if(pem.asymmetricKeyType!=='ed25519')return false;
    return verify(null,canonicalAcceptanceBytes(unsignedAcceptanceProof(proof)),pem,
      Buffer.from(envelope.signature,'base64url'));
  }catch{return false;}
}
export const REQUIRED_MANUAL_SIGNER_ROLE=Object.freeze({
  customer_requirements_confirmed:'customer-approver',
  business_owner_uat_signed:'customer-approver',
  manual_accessibility_signed:'accessibility-auditor',
  privacy_and_abuse_signed:'privacy-officer',
  production_route_coverage_signed:'release-verifier',
});
