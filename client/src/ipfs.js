// Minimal, backend-agnostic IPFS helpers.
// For now we disable real IPFS uploads and fall back to
// storing the encrypted note directly on-chain.

export function hasIPFSSupport() {
  // Return false so the app knows not to treat stored values as CIDs.
  return false;
}

export async function uploadTextToIPFS(text) {
  // In a real setup you would upload `text` to IPFS here
  // and return the resulting CID. Returning null signals
  // the caller to fall back to on-chain storage.
  return null;
}

export async function fetchTextFromIPFS(cid) {
  // With hasIPFSSupport() === false this should not be called
  // in normal flow, but we return an empty string for safety.
  return "";
}
