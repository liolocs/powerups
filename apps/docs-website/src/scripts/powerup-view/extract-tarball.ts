import { gunzipSync } from "fflate";

const HEADER_SIZE = 512;
const PACKAGE_PREFIX = "package/";
const textDecoder = new TextDecoder();

interface HeaderField {
  header: Uint8Array;
  offset: number;
  length: number;
}

function decodeHeaderString({ header, offset, length }: HeaderField): string {
  let end = offset;
  const limit = offset + length;

  while (end < limit && header[end] !== 0) {
    end += 1;
  }

  return textDecoder.decode(header.subarray(offset, end));
}

function isEndOfArchive({ header }: { header: Uint8Array }): boolean {
  return header.every((byte) => byte === 0);
}

function parseHeaderSize({ header }: { header: Uint8Array }): number {
  return parseInt(decodeHeaderString({ header, offset: 124, length: 12 }).trim(), 8) || 0;
}

function joinHeaderPath({ header }: { header: Uint8Array }): string {
  const name = decodeHeaderString({ header, offset: 0, length: 100 });
  const prefix = decodeHeaderString({ header, offset: 345, length: 155 });

  return prefix === "" ? name : prefix + "/" + name;
}

function stripPackagePrefix({ path }: { path: string }): string {
  return path.startsWith(PACKAGE_PREFIX) ? path.slice(PACKAGE_PREFIX.length) : path;
}

export function extractTarball({ tarballBytes }: { tarballBytes: Uint8Array }): Map<string, string> {
  const tarBytes = gunzipSync(tarballBytes);
  const files = new Map<string, string>();
  let offset = 0;
  let pendingLongName: string | null = null;

  while (offset + HEADER_SIZE <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + HEADER_SIZE);

    if (isEndOfArchive({ header })) {
      break;
    }

    const size = parseHeaderSize({ header });
    const contentStart = offset + HEADER_SIZE;
    const contentEnd = contentStart + size;
    const typeflag = decodeHeaderString({ header, offset: 156, length: 1 });
    const name = pendingLongName ?? joinHeaderPath({ header });

    if (typeflag === "L") {
      pendingLongName = textDecoder.decode(tarBytes.subarray(contentStart, contentEnd)).replaceAll("\u0000", "");
    } else if (typeflag === "0" || typeflag === "") {
      const filePath = stripPackagePrefix({ path: name });
      if (filePath !== "") {
        files.set(filePath, textDecoder.decode(tarBytes.subarray(contentStart, contentEnd)));
      }
      pendingLongName = null;
    } else {
      pendingLongName = null;
    }

    offset = contentEnd + ((HEADER_SIZE - (size % HEADER_SIZE)) % HEADER_SIZE);
  }

  return files;
}
