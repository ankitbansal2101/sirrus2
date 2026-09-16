import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "selfsigned";

const certDir = join(dirname(fileURLToPath(import.meta.url)), "certs");
const keyPath = join(certDir, "localhost-key.pem");
const certPath = join(certDir, "localhost-cert.pem");

export type LocalTls = {
  key: string;
  cert: string;
  keyPath: string;
  certPath: string;
};

/** Load or create a localhost TLS cert (SAN: localhost, 127.0.0.1). No CA install. */
export async function loadOrCreateLocalTls(): Promise<LocalTls> {
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath, "utf8"),
      cert: readFileSync(certPath, "utf8"),
      keyPath,
      certPath,
    };
  }

  const pems = await generate([{ name: "commonName", value: "localhost" }], {
    notAfterDate: new Date(Date.now() + 825 * 24 * 60 * 60 * 1000),
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
          { type: 7, ip: "::1" },
        ],
      },
    ],
  });

  mkdirSync(certDir, { recursive: true });
  writeFileSync(keyPath, pems.private, "utf8");
  writeFileSync(certPath, pems.cert, "utf8");

  return { key: pems.private, cert: pems.cert, keyPath, certPath };
}
