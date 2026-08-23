const deniedNames = new Set(["id_dsa", "id_ecdsa", "id_ed25519", "id_rsa"]);

export function isSensitiveFileName(name: string): boolean {
  return (
    name.startsWith(".env") ||
    deniedNames.has(name) ||
    /\.(asc|cer|crt|key|p12|pem|pfx)$/i.test(name)
  );
}

const privateKeyPattern = /-----BEGIN [^-\n]*PRIVATE KEY-----/i;
const typeAnnotationPattern =
  /^\s*[A-Z0-9_]+\s*:\s*[A-Za-z_$][\w$]*(?:<[^;\n]+>)?(?:\s*\|\s*[A-Za-z_$][\w$]*)*\s*;\s*$/;
const credentialKeyPattern =
  /^\s*(?:[A-Z0-9_]*(?:ACCESS_KEY|API_KEY|PASSWORD|PRIVATE_KEY|SECRET|TOKEN)[A-Z0-9_]*|[a-z0-9_]*(?:access_key|api_key|password|private_key|secret)[a-z0-9_]*|(?:accessKey|apiKey|clientSecret|password|privateKey|secret))\s*[:=]\s*\S+/;

export function isCredentialLikeContent(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some(
      (line) =>
        privateKeyPattern.test(line) ||
        (credentialKeyPattern.test(line) && !typeAnnotationPattern.test(line)),
    );
}
