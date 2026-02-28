import {ok, err, type Result} from "neverthrow";
import type {AppError} from "../utils/error/errors.ts";
import {InternalServerError} from "../utils/error/errors.ts";
import logger from "../utils/logger.ts";

const ENCRYPTION_KEY_HEX = "4D6251655468576D5A7134743677397A";
const DECRYPTION_KEY_HEX = "3273357638782F413F4428472B4B6250";

const GLOBAL_IV_OPTIONS: readonly string[] = [
    "556A586E32723575",
    "34743777217A2543",
    "413F4428472B4B62",
    "48404D635166546A",
    "614E645267556B58",
    "655368566D597133",
] as const;

function hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
        throw new Error("Invalid hex string: length must be even");
    }
    const buffer = new ArrayBuffer(hex.length / 2);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
    const binString = Array.from(bytes, (byte) =>
        String.fromCodePoint(byte)
    ).join("");
    return btoa(binString);
}

function base64ToBytes(base64: string): Uint8Array {
    const binString = atob(base64);
    const buffer = new ArrayBuffer(binString.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
}

function generateRandomHex(size: number): string {
    const buffer = new ArrayBuffer(Math.ceil(size / 2));
    const bytes = new Uint8Array(buffer);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes).substring(0, size);
}

function selectRandomGlobalIv(): {iv: string; index: number} {
    const selectedIndex = Math.floor(Math.random() * GLOBAL_IV_OPTIONS.length);
    const globalIv = GLOBAL_IV_OPTIONS[selectedIndex];

    if (globalIv === undefined) {
        throw new Error(`Invalid IV index: ${selectedIndex}`);
    }

    return {
        iv: globalIv,
        index: selectedIndex,
    };
}

function sanitizeJsonString(text: string): string {
    return text.replace(/[\u0000-\u0019]+/g, "");
}

function isHexString(str: string): boolean {
    return /^[0-9a-fA-F]+$/.test(str);
}

function tryParseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

export async function encryptRequest<T = unknown>(
    data: T,
    urlEncode: boolean = false
): Promise<Result<string, AppError>> {
    try {
        const jsonData = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(jsonData);

        const {iv: globalIv, index: globalIndex} = selectRandomGlobalIv();
        const randomIv = generateRandomHex(16);
        const fullIvHex = globalIv + randomIv;

        const keyBytes = hexToBytes(ENCRYPTION_KEY_HEX);
        const ivBytes = hexToBytes(fullIvHex);

        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyBytes.buffer as ArrayBuffer,
            {name: "AES-CBC", length: 128},
            false,
            ["encrypt"]
        );

        const encryptedBuffer = await crypto.subtle.encrypt(
            {name: "AES-CBC", iv: ivBytes.buffer as ArrayBuffer},
            cryptoKey,
            dataBytes
        );

        const encryptedBytes = new Uint8Array(encryptedBuffer);
        const base64Encrypted = bytesToBase64(encryptedBytes);

        const encryptedString = `${randomIv}${globalIndex}${base64Encrypted}`;

        if (urlEncode) {
            return ok(encodeURIComponent(encryptedString));
        }
        return ok(encryptedString);
    } catch (error) {
        logger.error("Encryption failed:", error);
        return err(new InternalServerError(
            `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        ));
    }
}

export async function decryptResponse<T = unknown>(
    encryptedData: string
): Promise<Result<T, AppError>> {
    try {
        const trimmedData = encryptedData.trim();

        // Check if response might be plain JSON (starts with { or [)
        if (trimmedData.startsWith("{") || trimmedData.startsWith("[")) {
            const parsed = tryParseJson<T>(trimmedData);
            if (parsed !== null) {
                return ok(parsed);
            }
        }

        const ivHex = trimmedData.slice(0, 32);
        const ciphertext = trimmedData.slice(32);

        // Validate IV is 32 hex characters
        if (ivHex.length !== 32 || !isHexString(ivHex)) {
            // Try to parse as JSON in case it's an unencrypted error response
            const parsed = tryParseJson<T>(trimmedData);
            if (parsed !== null) {
                return ok(parsed);
            }
            return err(new InternalServerError("Invalid encrypted data: IV must be 32 hex characters"));
        }

        const keyBytes = hexToBytes(DECRYPTION_KEY_HEX);
        const ivBytes = hexToBytes(ivHex);

        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyBytes.buffer as ArrayBuffer,
            {name: "AES-CBC", length: 128},
            false,
            ["decrypt"]
        );

        const encryptedBytes = base64ToBytes(ciphertext.trim());

        const decryptedBuffer = await crypto.subtle.decrypt(
            {name: "AES-CBC", iv: ivBytes.buffer as ArrayBuffer},
            cryptoKey,
            encryptedBytes.buffer as ArrayBuffer
        );

        const decoder = new TextDecoder();
        let plaintext = decoder.decode(decryptedBuffer);
        plaintext = sanitizeJsonString(plaintext);

        const parsedData = JSON.parse(plaintext) as T;

        return ok(parsedData);
    } catch (error) {
        logger.error("Decryption failed:", error);
        return err(new InternalServerError(
            `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        ));
    }
}
