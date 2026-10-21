/**
 * Image annotation overlay generator (bounding boxes, points, trajectories).
 * Uses sharp if available, otherwise falls back to SVG overlay.
 */

import type { DetectedObject, TrajectoryPoint } from "./vision-pipeline.js";

// Define distinct colors for object annotations
const COLORS = [
	"#FF6B6B",
	"#4ECDC4",
	"#45B7D1",
	"#96CEB4",
	"#FFEAA7",
	"#DDA0DD",
	"#98D8C8",
	"#F7DC6F",
	"#BB8FCE",
	"#85C1E9",
	"#F8C471",
	"#82E0AA",
	"#F1948A",
	"#AED6F1",
	"#D7BDE2",
];

interface AnnotationOverlay {
	svg: string;
	width: number;
	height: number;
}

/**
 * Fallback annotator for when sharp is unavailable.
 * If sharp is present, it composites the image; otherwise, it returns the raw image.
 */
export class ImageAnnotator {
	private sharpModule: any = null;

	constructor() {
		try {
			this.sharpModule = require("sharp");
		} catch {
			// sharp unavailable, will operate in SVG-only or fallback mode
		}
	}

	/**
	 * Draw bounding boxes onto the image.
	 */
	async drawBoundingBoxes(imageBytes: Buffer, objects: DetectedObject[]): Promise<Buffer> {
		const metadata = await this.getImageMetadata(imageBytes);
		const w = metadata.width;
		const h = metadata.height;

		const svgParts: string[] = [];
		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];
			const color = COLORS[i % COLORS.length];

			if (obj.box_2d) {
				const [ymin, xmin, ymax, xmax] = obj.box_2d;
				const x1 = (xmin / 1000) * w;
				const y1 = (ymin / 1000) * h;
				const bw = ((xmax - xmin) / 1000) * w;
				const bh = ((ymax - ymin) / 1000) * h;

				svgParts.push(
					`<rect x="${x1}" y="${y1}" width="${bw}" height="${bh}" fill="none" stroke="${color}" stroke-width="3"/>`,
					`<rect x="${x1}" y="${Math.max(0, y1 - 22)}" width="${obj.label.length * 9 + 8}" height="22" fill="${color}" rx="3"/>`,
					`<text x="${x1 + 4}" y="${Math.max(0, y1 - 6)}" font-family="monospace" font-size="14" fill="white">${this.escapeXml(obj.label)}</text>`,
				);
			}
		}

		return this.compositeOverlay(imageBytes, { svg: svgParts.join(""), width: w, height: h });
	}

	/**
	 * Draw points onto the image.
	 */
	async drawPoints(imageBytes: Buffer, objects: DetectedObject[]): Promise<Buffer> {
		const metadata = await this.getImageMetadata(imageBytes);
		const w = metadata.width;
		const h = metadata.height;

		const svgParts: string[] = [];
		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];
			const color = COLORS[i % COLORS.length];

			if (obj.point) {
				const [y, x] = obj.point;
				const px = (x / 1000) * w;
				const py = (y / 1000) * h;

				svgParts.push(
					`<circle cx="${px}" cy="${py}" r="8" fill="${color}" stroke="white" stroke-width="2"/>`,
					`<text x="${px + 12}" y="${py + 5}" font-family="monospace" font-size="13" fill="${color}" stroke="black" stroke-width="0.5">${this.escapeXml(obj.label)}</text>`,
				);
			}
		}

		return this.compositeOverlay(imageBytes, { svg: svgParts.join(""), width: w, height: h });
	}

	/**
	 * Draw trajectory (lines + numbered points).
	 */
	async drawTrajectory(imageBytes: Buffer, trajectory: TrajectoryPoint[]): Promise<Buffer> {
		const metadata = await this.getImageMetadata(imageBytes);
		const w = metadata.width;
		const h = metadata.height;

		if (trajectory.length === 0) return imageBytes;

		const svgParts: string[] = [];

		// first draw the line
		if (trajectory.length > 1) {
			const pathPoints = trajectory.map((t) => {
				const px = (t.point[1] / 1000) * w;
				const py = (t.point[0] / 1000) * h;
				return `${px},${py}`;
			});
			svgParts.push(
				`<polyline points="${pathPoints.join(" ")}" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-dasharray="8,4" marker-end="url(#arrowhead)"/>`,
			);
			// arrowhead definition
			svgParts.unshift(
				`<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#FF6B6B"/></marker></defs>`,
			);
		}

		// then draw the points
		for (const t of trajectory) {
			const px = (t.point[1] / 1000) * w;
			const py = (t.point[0] / 1000) * h;
			const color = t.order === 0 ? "#4ECDC4" : t.order === trajectory.length - 1 ? "#FF6B6B" : "#45B7D1";

			svgParts.push(
				`<circle cx="${px}" cy="${py}" r="10" fill="${color}" stroke="white" stroke-width="2"/>`,
				`<text x="${px}" y="${py + 4}" text-anchor="middle" font-family="monospace" font-size="10" fill="white" font-weight="bold">${t.order}</text>`,
			);
		}

		return this.compositeOverlay(imageBytes, { svg: svgParts.join(""), width: w, height: h });
	}

	private async getImageMetadata(imageBytes: Buffer): Promise<{ width: number; height: number }> {
		if (this.sharpModule) {
			const meta = await this.sharpModule(imageBytes).metadata();
			return { width: meta.width || 800, height: meta.height || 600 };
		}
		// fallback to parsing PNG header or returning default dimensions
		return this.readDimensionsFromBuffer(imageBytes);
	}

	private async compositeOverlay(imageBytes: Buffer, overlay: AnnotationOverlay): Promise<Buffer> {
		const svgFull = `<svg xmlns="http://www.w3.org/2000/svg" width="${overlay.width}" height="${overlay.height}">${overlay.svg}</svg>`;

		if (this.sharpModule) {
			return this.sharpModule(imageBytes)
				.composite([{ input: Buffer.from(svgFull), top: 0, left: 0 }])
				.png()
				.toBuffer();
		}
		// if sharp is unavailable, return original image (cannot composite)
		return imageBytes;
	}

	private escapeXml(str: string): string {
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	// simple PNG/JPEG dimension parser
	private readDimensionsFromBuffer(buf: Buffer): { width: number; height: number } {
		// PNG
		if (buf[0] === 0x89 && buf[1] === 0x50) {
			const w = buf.readUInt32BE(16);
			const h = buf.readUInt32BE(20);
			return { width: w, height: h };
		}
		// JPEG - Search for SOF0 marker
		if (buf[0] === 0xff && buf[1] === 0xd8) {
			let offset = 2;
			while (offset < buf.length - 8) {
				if (buf[offset] === 0xff && (buf[offset + 1] === 0xc0 || buf[offset + 1] === 0xc2)) {
					const h = buf.readUInt16BE(offset + 5);
					const w = buf.readUInt16BE(offset + 7);
					return { width: w, height: h };
				}
				const segLen = buf.readUInt16BE(offset + 2);
				offset += 2 + segLen;
			}
		}
		return { width: 800, height: 600 };
	}
}
