import { readFileSync } from "fs";
import * as ts from "typescript";

/**
 * Extreme Token Optimization (The Scalpel)
 * Parses TypeScript/JavaScript files and surgically extracts only the necessary
 * functions, classes, and imports to minimize token usage.
 */
export class AstOptimizer {
	constructor(private filePath: string) {}

	public extractSymbols(targetSymbols: string[]): string {
		const sourceCode = readFileSync(this.filePath, "utf-8");
		const sourceFile = ts.createSourceFile(this.filePath, sourceCode, ts.ScriptTarget.Latest, true);

		const extractedNodes: string[] = [];
		let _hasImports = false;

		function visit(node: ts.Node) {
			// Keep all imports for context
			if (ts.isImportDeclaration(node)) {
				extractedNodes.push(node.getText(sourceFile));
				_hasImports = true;
				return;
			}

			// Extract targeted functions
			if (ts.isFunctionDeclaration(node) && node.name) {
				if (targetSymbols.includes(node.name.text)) {
					extractedNodes.push(node.getText(sourceFile));
				}
			}

			// Extract targeted classes
			if (ts.isClassDeclaration(node) && node.name) {
				if (targetSymbols.includes(node.name.text)) {
					extractedNodes.push(node.getText(sourceFile));
				}
			}

			// Extract targeted interfaces/types
			if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
				if (node.name && targetSymbols.includes(node.name.text)) {
					extractedNodes.push(node.getText(sourceFile));
				}
			}

			// Extract exported constants/variables
			if (ts.isVariableStatement(node)) {
				const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
				if (isExported) {
					node.declarationList.declarations.forEach((decl) => {
						if (ts.isIdentifier(decl.name) && targetSymbols.includes(decl.name.text)) {
							extractedNodes.push(node.getText(sourceFile));
						}
					});
				}
			}

			ts.forEachChild(node, visit);
		}

		visit(sourceFile);

		if (extractedNodes.length === 0) {
			return `// AST Optimizer: Target symbols [${targetSymbols.join(", ")}] not found in ${this.filePath}`;
		}

		return `// [AST Optimized Context: ${this.filePath}]\n${extractedNodes.join("\n\n")}`;
	}

	public getFileOutline(): string {
		const sourceCode = readFileSync(this.filePath, "utf-8");
		const sourceFile = ts.createSourceFile(this.filePath, sourceCode, ts.ScriptTarget.Latest, true);

		const outline: string[] = [];

		function visit(node: ts.Node) {
			if (ts.isFunctionDeclaration(node) && node.name) {
				outline.push(`function ${node.name.text}()`);
			} else if (ts.isClassDeclaration(node) && node.name) {
				outline.push(`class ${node.name.text}`);
			} else if (ts.isInterfaceDeclaration(node) && node.name) {
				outline.push(`interface ${node.name.text}`);
			}
			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
		return `// File Outline: ${this.filePath}\n${outline.join("\n")}`;
	}
}
