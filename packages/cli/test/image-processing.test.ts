/**
 * Tests for image processing utilities using Photon.
 */

import { describe, expect, it } from "vitest";
import { convertToPng } from "../src/utils/image-convert.js";
import { formatDimensionNote, resizeImage } from "../src/utils/image-resize.js";

// Small 2x2 red PNG image (base64) - generated with ImageMagick
const TINY_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAABmJLR0QA/wD/AP+gvaeTAAAAFElEQVQImWP8z8Dwn4GBgYGJAQoAHxcCAr7cGDwAAAAASUVORK5CYII=";

// Small 2x2 blue JPEG image (base64) - generated with ImageMagick
const TINY_JPEG =
	"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDxyiiiv3E8w//Z";

// 100x100 gray PNG
const MEDIUM_PNG_100x100 =
	"iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAABAUlEQVR4nO3RwQ3AIBDAsNLJb3N4MwF52BNEypqZ/ZHxvw7gZkiMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITEH3ZADRx/nifQAAAAASUVORK5CYII=";

// 200x200 colored PNG
const LARGE_PNG_200x200 =
	"iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABmJLR0QA/wD/AP+gvaeTAAACFUlEQVR4nO3TMRHAMAzAQLf8ObsEelqT4R+BFj27swP8ek8HwM0MAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBA+3A4Ejfu5Vn8AAAAASUVORK5CYII=";

describe("convertToPng", () => {
	it("should return original data for PNG input", async () => {
		const result = await convertToPng(TINY_PNG, "image/png");
		expect(result).not.toBeNull();
		expect(result!.data).toBe(TINY_PNG);
		expect(result!.mimeType).toBe("image/png");
	});

	it("should convert JPEG to PNG", async () => {
		const result = await convertToPng(TINY_JPEG, "image/jpeg");
		expect(result).not.toBeNull();
		expect(result!.mimeType).toBe("image/png");
		// Result should be valid base64
		expect(() => Buffer.from(result!.data, "base64")).not.toThrow();
		// PNG magic bytes
		const buffer = Buffer.from(result!.data, "base64");
		expect(buffer[0]).toBe(0x89);
		expect(buffer[1]).toBe(0x50); // 'P'
		expect(buffer[2]).toBe(0x4e); // 'N'
		expect(buffer[3]).toBe(0x47); // 'G'
	});
});

describe("resizeImage", () => {
	it("should return original image if within limits", async () => {
		const result = await resizeImage(
			{ type: "image", data: TINY_PNG, mimeType: "image/png" },
			{ maxWidth: 100, maxHeight: 100, maxBytes: 1024 * 1024 },
		);

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(false);
		expect(result!.data).toBe(TINY_PNG);
		expect(result!.originalWidth).toBe(2);
		expect(result!.originalHeight).toBe(2);
		expect(result!.width).toBe(2);
		expect(result!.height).toBe(2);
	});

	it("should resize image exceeding dimension limits", async () => {
		const result = await resizeImage(
			{ type: "image", data: MEDIUM_PNG_100x100, mimeType: "image/png" },
			{ maxWidth: 50, maxHeight: 50, maxBytes: 1024 * 1024 },
		);

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(true);
		expect(result!.originalWidth).toBe(100);
		expect(result!.originalHeight).toBe(100);
		expect(result!.width).toBeLessThanOrEqual(50);
		expect(result!.height).toBeLessThanOrEqual(50);
	});

	it("should resize image exceeding byte limit", async () => {
		const originalBuffer = Buffer.from(LARGE_PNG_200x200, "base64");
		const originalSize = originalBuffer.length;

		// Set maxBytes to less than the original encoded image size
		const result = await resizeImage(
			{ type: "image", data: LARGE_PNG_200x200, mimeType: "image/png" },
			{ maxWidth: 2000, maxHeight: 2000, maxBytes: Math.floor(LARGE_PNG_200x200.length * 0.9) },
		);

		// Should have tried to reduce size
		expect(result).not.toBeNull();
		const resultBuffer = Buffer.from(result!.data, "base64");
		expect(resultBuffer.length).toBeLessThan(originalSize);
		expect(result!.data.length).toBeLessThan(LARGE_PNG_200x200.length);
	});

	it("should return null when image cannot be resized below maxBytes", async () => {
		const result = await resizeImage(
			{ type: "image", data: LARGE_PNG_200x200, mimeType: "image/png" },
			{ maxWidth: 2000, maxHeight: 2000, maxBytes: 1 },
		);

		expect(result).toBeNull();
	});

	it("should handle JPEG input", async () => {
		const result = await resizeImage(
			{ type: "image", data: TINY_JPEG, mimeType: "image/jpeg" },
			{ maxWidth: 100, maxHeight: 100, maxBytes: 1024 * 1024 },
		);

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(false);
		expect(result!.originalWidth).toBe(2);
		expect(result!.originalHeight).toBe(2);
	});
});

describe("formatDimensionNote", () => {
	it("should return undefined for non-resized images", () => {
		const note = formatDimensionNote({
			data: "",
			mimeType: "image/png",
			originalWidth: 100,
			originalHeight: 100,
			width: 100,
			height: 100,
			wasResized: false,
		});
		expect(note).toBeUndefined();
	});

	it("should return formatted note for resized images", () => {
		const note = formatDimensionNote({
			data: "",
			mimeType: "image/png",
			originalWidth: 2000,
			originalHeight: 1000,
			width: 1000,
			height: 500,
			wasResized: true,
		});
		expect(note).toContain("original 2000x1000");
		expect(note).toContain("displayed at 1000x500");
		expect(note).toContain("2.00"); // scale factor
	});
});
