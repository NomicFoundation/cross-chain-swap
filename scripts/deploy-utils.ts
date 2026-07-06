import type { Artifact } from "hardhat/types/artifacts";
import type { Hex } from "viem";

import { readFileSync } from "node:fs";
import { isAddress, isHex, keccak256, toBytes } from "viem";

export interface ChainConfig {
  lop: Hex;
  accessToken: Hex;
  create3Deployer: Hex;
  factoryOwner: Hex;
  factorySalt: string;
  trueTokenSalt: string;
}

export function parseSalt(saltString: string): Hex {
  return isHex(saltString) ? saltString : keccak256(toBytes(saltString));
}

/** True when `value` is a valid, non-zero address. */
export function isSetAddress(value: string | undefined): value is Hex {
  return value !== undefined && isAddress(value) && BigInt(value) !== 0n;
}

export class MissingChainConfigError extends Error {
  constructor(chainId: string) {
    super(`Missing config/constants.json entries for chain ${chainId}`);
  }
}

export function readChainConfig(chainId: string): ChainConfig {
  let raw;
  try {
    raw = JSON.parse(readFileSync("config/constants.json", "utf8"));
  } catch {
    throw new MissingChainConfigError(chainId);
  }

  return {
    lop: raw.lop?.[chainId],
    accessToken: raw.accessToken?.[chainId],
    create3Deployer: raw.create3Deployer?.[chainId],
    factoryOwner: raw.factoryOwner?.[chainId],
    factorySalt: raw.factorySalt?.[chainId],
    trueTokenSalt: raw.trueTokenSalt?.[chainId],
  };
}

/**
 * Fills the placeholders in a contract's creation bytecode with the addresses
 * of its external libraries
 */
export function linkLibraries(
  artifact: Artifact,
  libraryAddresses: Record<string, string>
): Hex {
  let bytecode = artifact.bytecode;
  for (const libs of Object.values(artifact.linkReferences)) {
    for (const [libName, positions] of Object.entries(libs)) {
      const address = libraryAddresses[libName];
      if (address === undefined) {
        throw new Error(`Missing address for linked library ${libName}`);
      }
      const addr = address.toLowerCase().replace(/^0x/, "");
      for (const { start, length } of positions) {
        const offset = 2 + start * 2; // skip "0x", 2 hex chars per byte
        bytecode =
          bytecode.slice(0, offset) +
          addr +
          bytecode.slice(offset + length * 2);
      }
    }
  }
  if (!isHex(bytecode)) {
    throw new Error("Linked bytecode is not valid hex");
  }
  return bytecode;
}
