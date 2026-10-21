/**
 * Image capture utility - supports file paths, URLs, and webcams.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const SUPPORTED_FORMATS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"]);

export class ImageCapture {
	/**
	 * Read from a local file, returning the Buffer.
	 */
	fromFile(filePath: string): Buffer {
		const resolved = resolve(filePath);
		if (!existsSync(resolved)) {
			throw new Error(`File not found: ${resolved}`);
		}
		const ext = extname(resolved).toLowerCase();
		if (!SUPPORTED_FORMATS.has(ext)) {
			throw new Error(`Unsupported format: ${ext}. Supported: ${[...SUPPORTED_FORMATS].join(", ")}`);
		}
		return readFileSync(resolved);
	}

	/**
	 * Download from a remote URL.
	 */
	async fromUrl(url: string): Promise<Buffer> {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Failed to download image (${res.status}): ${url}`);
		}
		const arrayBuffer = await res.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	/**
	 * Capture a single frame from the webcam (requires ffmpeg).
	 * Windows: dshow, Linux: v4l2, Mac: avfoundation
	 */
	fromWebcam(device?: string): Buffer {
		const platform = process.platform;
		const tmpPath = resolve(process.cwd(), ".Astro-Agent-capture-tmp.jpg");

		let cmd: string;
		if (platform === "win32") {
			const dev = device || "video=Integrated Camera";
			cmd = `ffmpeg -y -f dshow -i "${dev}" -frames:v 1 -q:v 2 "${tmpPath}" 2>nul`;
		} else if (platform === "darwin") {
			const dev = device || "0";
			cmd = `ffmpeg -y -f avfoundation -i "${dev}" -frames:v 1 -q:v 2 "${tmpPath}" 2>/dev/null`;
		} else {
			const dev = device || "/dev/video0";
			cmd = `ffmpeg -y -f v4l2 -i "${dev}" -frames:v 1 -q:v 2 "${tmpPath}" 2>/dev/null`;
		}

		try {
			execSync(cmd, { timeout: 10000 });
		} catch {
			throw new Error(
				"Failed to capture image from webcam. Ensure ffmpeg is installed and the device name is correct.",
			);
		}

		if (!existsSync(tmpPath)) {
			throw new Error("Webcam capture failed: file was not created");
		}

		const buf = readFileSync(tmpPath);
		// Delete temp file
		try {
			const { unlinkSync } = require("node:fs");
			unlinkSync(tmpPath);
		} catch {
			// Ignore errors during cleanup
		}
		return buf;
	}

	/**
	 * Convert Buffer to base64 (for passing to vision models).
	 */
	toBase64(imageBytes: Buffer): string {
		return imageBytes.toString("base64");
	}

	/**
	 * Guess MIME type based on file extension.
	 */
	getMimeType(filePath: string): string {
		const ext = extname(filePath).toLowerCase();
		const mimeMap: Record<string, string> = {
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".png": "image/png",
			".webp": "image/webp",
			".bmp": "image/bmp",
			".gif": "image/gif",
		};
		return mimeMap[ext] || "image/jpeg";
	}
}
