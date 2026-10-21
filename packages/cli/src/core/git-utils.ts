import { spawn } from "node:child_process";

export interface GitRunResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface ShipResult {
	ok: boolean;
	message: string;
	branch?: string;
	prUrl?: string;
	diffStat?: string;
}

function runGit(cwd: string, args: string[]): Promise<GitRunResult> {
	return new Promise((resolve) => {
		const child = spawn("git", args, { cwd, shell: false });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (c) => {
			stdout += c.toString();
		});
		child.stderr?.on("data", (c) => {
			stderr += c.toString();
		});
		child.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
		child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
	});
}

async function git(cwd: string, args: string[]): Promise<string> {
	const result = await runGit(cwd, args);
	if (result.code !== 0) throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
	return result.stdout.trim();
}

export async function getCurrentBranch(cwd: string): Promise<string> {
	return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function getDefaultBranch(cwd: string): Promise<string> {
	try {
		const remote = await git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
		return remote.replace(/^origin\//, "");
	} catch {
		return "main";
	}
}

export async function getGitStatus(cwd: string): Promise<string> {
	const status = await git(cwd, ["status", "--short", "--branch"]);
	return status || "Working tree clean.";
}

export async function getDiffSummary(cwd: string): Promise<string> {
	const stat = await git(cwd, ["diff", "--stat", "HEAD"]);
	return stat || "No diff.";
}

export async function getFullDiff(cwd: string): Promise<string> {
	const diff = await git(cwd, ["diff", "--", "."]);
	return diff || "No diff.";
}

export async function createBranch(cwd: string, branchName: string): Promise<string> {
	await git(cwd, ["checkout", "-B", branchName]);
	return branchName;
}

export async function commitAll(cwd: string, message: string): Promise<string> {
	await git(cwd, ["add", "-A"]);
	const status = await git(cwd, ["status", "--porcelain"]);
	if (!status.trim()) return "No commit created: no changes.";
	return git(cwd, ["commit", "-m", message || "chore: update"]);
}

export async function pushBranch(cwd: string, branchName?: string): Promise<string> {
	const branch = branchName || (await getCurrentBranch(cwd));
	return git(cwd, ["push", "-u", "origin", branch]);
}

async function getGithubRepo(cwd: string): Promise<{ owner: string; repo: string }> {
	const url = await git(cwd, ["remote", "get-url", "origin"]);
	const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
	if (!match || !match[1] || !match[2]) throw new Error(`Could not resolve GitHub origin: ${url}`);
	return { owner: match[1], repo: match[2] };
}

export async function createPR(
	cwd: string,
	title: string,
	body: string,
	head?: string,
	base?: string,
): Promise<string> {
	const branch = head || (await getCurrentBranch(cwd));
	const defaultBase = base || (await getDefaultBranch(cwd));

	const gh = await runGit(cwd, ["--version"]); // quick git availability noop for consistent errors
	void gh;
	const ghPr = await new Promise<GitRunResult>((resolve) => {
		const child = spawn(
			"gh",
			["pr", "create", "--title", title, "--body", body, "--head", branch, "--base", defaultBase],
			{
				cwd,
				shell: false,
			},
		);
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (c) => {
			stdout += c.toString();
		});
		child.stderr?.on("data", (c) => {
			stderr += c.toString();
		});
		child.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
		child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
	});
	if (ghPr.code === 0 && ghPr.stdout.trim()) return ghPr.stdout.trim();

	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	if (!token) throw new Error("GITHUB_TOKEN/GH_TOKEN is missing and gh CLI could not create a PR.");
	const { owner, repo } = await getGithubRepo(cwd);
	const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "Astro-Agent-git-ship",
		},
		body: JSON.stringify({ title, body, head: branch, base: defaultBase }),
	});
	const json: unknown = await response.json().catch(() => ({}));
	const message = typeof json === "object" && json && "message" in json ? String(json.message) : undefined;
	if (!response.ok) throw new Error(message || `${response.status} ${response.statusText}`);
	if (typeof json !== "object" || !json || !("html_url" in json) || typeof json.html_url !== "string") {
		throw new Error("Invalid GitHub PR response: missing html_url.");
	}
	return json.html_url;
}

export function safeBranchName(input?: string): string {
	const raw = input?.trim() || `Astro-Agent/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
	const normalized = raw
		.toLowerCase()
		.replace(/[^a-z0-9._/-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/\.{2,}/g, ".")
		.replace(/\/+/g, "/")
		.replace(/(?:^|\/)\.+(?=\/|$)/g, "")
		.replace(/\.lock$/i, "")
		.replace(/\.$/, "")
		.slice(0, 80)
		.replace(/^[./-]+|[./-]+$/g, "");
	return normalized || "Astro-Agent/update";
}

export async function shipChanges(
	cwd: string,
	options: { message?: string; branchName?: string; pr?: boolean } = {},
): Promise<ShipResult> {
	const message = options.message || "chore: update via Astro-Agent";
	const branch = safeBranchName(options.branchName || message);
	await createBranch(cwd, branch);
	const commit = await commitAll(cwd, message);
	const diffStat = await getDiffSummary(cwd).catch(() => "");
	await pushBranch(cwd, branch);
	let prUrl: string | undefined;
	if (options.pr !== false) {
		const body = [`Automated Astro-Agent ship.`, "", "```", diffStat || commit, "```"].join("\n");
		prUrl = await createPR(cwd, message, body, branch).catch((err) => `Could not create PR: ${err.message}`);
	}
	return { ok: true, message: commit || "Ship complete.", branch, prUrl, diffStat };
}
