// @ts-nocheck
/**
 * Robotics sonuçlarını terminalde render eden component.
 * Tespit tablosu, yörünge özeti, görev planı.
 */

import type { PlannedAction } from "../../core/robotics/task-planner.js";
import type { DetectedObject, TrajectoryPoint } from "../../core/robotics/vision-pipeline.js";

// ANSI renk kodları (chalk kullanmak yerine direkt)
const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m",
	white: "\x1b[37m",
	bgDark: "\x1b[48;5;235m",
};

const ROBOT_ICON = "🤖";
const COORD_ICON = "📍";
const BOX_ICON = "📦";
const PLAN_ICON = "📋";
const TRAJ_ICON = "➡️";

// biome-ignore lint/complexity/noStaticOnlyClass: Static utility render methods are intentional here.
export class RoboticsView {
	/**
	 * Robotics mode banner - terminal açıldığında göster.
	 */
	static renderBanner(model: string, baseUrl: string): string {
		const lines = [
			"",
			`${C.cyan}${C.bold}╔══════════════════════════════════════╗${C.reset}`,
			`${C.cyan}${C.bold}║  ${ROBOT_ICON}  Robotics Mode Aktif              ║${C.reset}`,
			`${C.cyan}${C.bold}╚══════════════════════════════════════╝${C.reset}`,
			`${C.dim}  Model: ${model} @ ${baseUrl}${C.reset}`,
			`${C.dim}  Slash commands: /robotics help${C.reset}`,
			"",
		];
		return lines.join("\n");
	}

	/**
	 * Tespit edilen nesneleri tablo formatında göster.
	 */
	static renderDetectionResults(objects: DetectedObject[], durationMs?: number): string {
		if (objects.length === 0) {
			return `${C.yellow}${COORD_ICON} Hiçbir nesne tespit edilemedi.${C.reset}`;
		}

		const lines: string[] = [
			"",
			`${C.cyan}${C.bold}${COORD_ICON} Tespit Sonuçları${durationMs ? ` (${durationMs}ms)` : ""}${C.reset}`,
			`${C.dim}${"─".repeat(50)}${C.reset}`,
		];

		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];
			const idx = `${C.dim}[${String(i + 1).padStart(2)}]${C.reset}`;

			if (obj.point) {
				const coords = `${C.green}y=${String(obj.point[0]).padStart(4)}, x=${String(obj.point[1]).padStart(4)}${C.reset}`;
				lines.push(`  ${idx} ${C.white}${obj.label.padEnd(28)}${C.reset} ${COORD_ICON} ${coords}`);
			} else if (obj.box_2d) {
				const [ymin, xmin, ymax, xmax] = obj.box_2d;
				const coords = `${C.green}[${ymin},${xmin},${ymax},${xmax}]${C.reset}`;
				lines.push(`  ${idx} ${C.white}${obj.label.padEnd(28)}${C.reset} ${BOX_ICON} ${coords}`);
			}
		}

		lines.push(`${C.dim}${"─".repeat(50)}${C.reset}`);
		lines.push(`  ${C.dim}Toplam: ${objects.length} nesne${C.reset}`);
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Yörüngeyi terminalde göster.
	 */
	static renderTrajectory(trajectory: TrajectoryPoint[], durationMs?: number): string {
		if (trajectory.length === 0) {
			return `${C.yellow}${TRAJ_ICON} Yörünge planlanamadı.${C.reset}`;
		}

		const lines: string[] = [
			"",
			`${C.magenta}${C.bold}${TRAJ_ICON} Yörünge Planı${durationMs ? ` (${durationMs}ms)` : ""}${C.reset}`,
			`${C.dim}${"─".repeat(50)}${C.reset}`,
		];

		for (const t of trajectory) {
			const isStart = t.order === 0;
			const isEnd = t.order === trajectory.length - 1;
			const icon = isStart ? "🟢" : isEnd ? "🔴" : "🔵";
			const label = isStart ? " (başlangıç)" : isEnd ? " (hedef)" : "";
			const coords = `${C.green}[y=${t.point[0]}, x=${t.point[1]}]${C.reset}`;
			lines.push(`  ${icon} Nokta ${String(t.order).padEnd(3)} ${coords}${C.dim}${label}${C.reset}`);
		}

		lines.push(`${C.dim}${"─".repeat(50)}${C.reset}`);
		lines.push(`  ${C.dim}${trajectory.length} waypoint${C.reset}`);
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Görev planını göster.
	 */
	static renderTaskPlan(actions: PlannedAction[], durationMs?: number): string {
		if (actions.length === 0) {
			return `${C.yellow}${PLAN_ICON} Görev planı oluşturulamadı.${C.reset}`;
		}

		const lines: string[] = [
			"",
			`${C.yellow}${C.bold}${PLAN_ICON} Task Plan${durationMs ? ` (${durationMs}ms)` : ""}${C.reset}`,
			`${C.dim}${"─".repeat(60)}${C.reset}`,
		];

		for (let i = 0; i < actions.length; i++) {
			const a = actions[i];
			const argsStr = a.args.map((v) => JSON.stringify(v)).join(", ");
			const stepNum = `${C.blue}${C.bold}${String(i + 1).padStart(2)}.${C.reset}`;
			lines.push(
				`  ${stepNum} ${C.white}${a.function}${C.reset}${C.dim}(${C.reset}${C.green}${argsStr}${C.reset}${C.dim})${C.reset}`,
			);
			if (a.reasoning) {
				lines.push(`     ${C.dim}// ${a.reasoning}${C.reset}`);
			}
		}

		lines.push(`${C.dim}${"─".repeat(60)}${C.reset}`);
		lines.push(`  ${C.dim}Toplam: ${actions.length} steps${C.reset}`);
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Robotics mode durum bilgisi.
	 */
	static renderStatus(config: {
		enabled: boolean;
		visionModel: string;
		visionBaseUrl: string;
		outputOverlay: boolean;
		robotApiFunctionsPath?: string;
		lastImagePath?: string;
	}): string {
		const lines: string[] = [
			"",
			`${C.cyan}${C.bold}${ROBOT_ICON} Robotics Mode Durumu${C.reset}`,
			`${C.dim}${"─".repeat(50)}${C.reset}`,
			`  ${C.white}Durum:${C.reset}      ${config.enabled ? `${C.green}✓ Aktif${C.reset}` : `${C.red}✗ Kapalı${C.reset}`}`,
			`  ${C.white}Model:${C.reset}      ${C.green}${config.visionModel}${C.reset}`,
			`  ${C.white}Base URL:${C.reset}   ${C.dim}${config.visionBaseUrl}${C.reset}`,
			`  ${C.white}Overlay:${C.reset}    ${config.outputOverlay ? `${C.green}Açık${C.reset}` : `${C.dim}Kapalı${C.reset}`}`,
		];

		if (config.robotApiFunctionsPath) {
			lines.push(`  ${C.white}Robot API:${C.reset}  ${C.dim}${config.robotApiFunctionsPath}${C.reset}`);
		}
		if (config.lastImagePath) {
			lines.push(`  ${C.white}Son Resim:${C.reset}  ${C.dim}${config.lastImagePath}${C.reset}`);
		}

		lines.push(`${C.dim}${"─".repeat(50)}${C.reset}`);
		lines.push(`  ${C.dim}Komutlar: /robotics help${C.reset}`);
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Yardım ekranı.
	 */
	static renderHelp(): string {
		const cmds = [
			["/robotics enable", "Robotics mode'u aç"],
			["/robotics disable", "Robotics mode'u kapat"],
			["/robotics status", "Mevcut ayarları göster"],
			["/robotics model <model>", "Vision modelini değiştir (ör: qwen2.5-vl:7b)"],
			["/robotics image <path>", "Görüntü dosyası yükle ve göster"],
			["/robotics detect [q1,q2]", "Görüntüde nesne tespit et"],
			["/robotics bbox", "Görüntüde bounding box'lar çiz"],
			["/robotics trajectory <talimat>", "Yörünge planla"],
			["/robotics analyze [soru]", "Sahneyi analiz et"],
			["/robotics plan <görev>", "Robot API görev planı oluştur"],
			["/robotics functions <path>", "Robot fonksiyon JSON'ı yükle"],
			["/robotics help", "Bu yardım ekranını göster"],
		];

		const lines: string[] = [
			"",
			`${C.cyan}${C.bold}${ROBOT_ICON} Robotics Mode Komutları${C.reset}`,
			`${C.dim}${"─".repeat(60)}${C.reset}`,
		];

		for (const [cmd, desc] of cmds) {
			lines.push(`  ${C.green}${cmd.padEnd(36)}${C.reset} ${C.dim}${desc}${C.reset}`);
		}

		lines.push(`${C.dim}${"─".repeat(60)}${C.reset}`);
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Error mesajı formatla.
	 */
	static renderError(message: string): string {
		return `${C.red}${ROBOT_ICON} Robotics Hatası: ${message}${C.reset}`;
	}

	/**
	 * Başarı mesajı.
	 */
	static renderSuccess(message: string): string {
		return `${C.green}✓ ${message}${C.reset}`;
	}
}
