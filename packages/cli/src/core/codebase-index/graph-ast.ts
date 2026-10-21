import { existsSync } from "node:fs";
import { join } from "node:path";
import { Node, Project } from "ts-morph";

export interface ImpactNode {
	filePath: string;
	references: { line: number; text: string }[];
}

export interface DependencyGraph {
	nodes: string[];
	edges: { from: string; to: string; type: string }[];
}

export class AstGraphManager {
	private project: Project;
	private cwd: string;

	constructor(cwd: string) {
		this.cwd = cwd;
		// Initialize ts-morph project
		const tsConfigPath = join(cwd, "tsconfig.json");
		if (existsSync(tsConfigPath)) {
			this.project = new Project({ tsConfigFilePath: tsConfigPath });
		} else {
			this.project = new Project();
			this.project.addSourceFilesAtPaths(join(cwd, "**/*.{ts,tsx,js,jsx}"));
		}
	}

	/**
	 * Builds a high-level module dependency graph.
	 * Shows which files import which other files.
	 */
	public buildHolisticMap(): DependencyGraph {
		const graph: DependencyGraph = { nodes: [], edges: [] };
		const sourceFiles = this.project.getSourceFiles();

		for (const sf of sourceFiles) {
			const filePath = sf.getFilePath().replace(this.cwd, "").replace(/\\/g, "/");
			graph.nodes.push(filePath);

			const imports = sf.getImportDeclarations();
			for (const imp of imports) {
				const moduleSpecifier = imp.getModuleSpecifierValue();
				const sourceFileNode = imp.getModuleSpecifierSourceFile();
				const toPath = sourceFileNode
					? sourceFileNode.getFilePath().replace(this.cwd, "").replace(/\\/g, "/")
					: moduleSpecifier; // external or unresolved

				graph.edges.push({
					from: filePath,
					to: toPath,
					type: "import",
				});
			}
		}

		return graph;
	}

	/**
	 * Finds all files and specific lines that would be impacted if a given symbol changes.
	 * This represents the "Butterfly Effect" calculation.
	 * @param targetFilePath The file containing the symbol
	 * @param symbolName The name of the function, class, or variable
	 */
	public getImpactAnalysis(targetFilePath: string, symbolName: string): ImpactNode[] {
		const fullPath = join(this.cwd, targetFilePath);
		const sf = this.project.getSourceFile(fullPath);
		if (!sf) return [];

		// Find the exported declaration matching the symbol name
		let targetNode: Node | undefined;
		for (const [name, declarations] of sf.getExportedDeclarations()) {
			if (name === symbolName) {
				targetNode = declarations[0];
				break;
			}
		}

		if (!targetNode) {
			// Search for internal unexported nodes as fallback
			const varDecl = sf.getVariableDeclaration(symbolName);
			const funcDecl = sf.getFunction(symbolName);
			const classDecl = sf.getClass(symbolName);
			const interfaceDecl = sf.getInterface(symbolName);
			targetNode = varDecl || funcDecl || classDecl || interfaceDecl;
		}

		if (!targetNode || !Node.isReferenceFindable(targetNode)) {
			return [];
		}

		const referencedSymbols = targetNode.findReferences();
		const impactMap = new Map<string, ImpactNode>();

		for (const refSymbol of referencedSymbols) {
			for (const ref of refSymbol.getReferences()) {
				const node = ref.getNode();
				const refSf = node.getSourceFile();
				const relPath = refSf.getFilePath().replace(this.cwd, "").replace(/\\/g, "/");

				if (!impactMap.has(relPath)) {
					impactMap.set(relPath, { filePath: relPath, references: [] });
				}

				impactMap.get(relPath)!.references.push({
					line: node.getStartLineNumber(),
					text: node.getParent()?.getText().substring(0, 100) || node.getText(),
				});
			}
		}

		return Array.from(impactMap.values());
	}

	/**
	 * Refresh the project in case of filesystem changes
	 */
	public refresh() {
		const sourceFiles = this.project.getSourceFiles();
		for (const sf of sourceFiles) {
			sf.refreshFromFileSystemSync();
		}
	}
}
