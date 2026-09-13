import ts from 'typescript'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/** Downlevel standard decorators before Rolldown parses Node bundle inputs. */
export function standardDecoratorPlugin() {
  return {
    name: 'soc-standard-decorators',
    transform: {
      order: 'pre' as const,
      handler(code: string, id: string) {
        const file = id.split('?', 1)[0]!
        if (!/\.[cm]?tsx?$/u.test(file) || !decoratorSyntax.test(code)) return null
        const result = ts.transpileModule(code, {
          fileName: file,
          compilerOptions: {
            target: ts.ScriptTarget.ES2024,
            module: ts.ModuleKind.ESNext,
            jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
            sourceMap: true,
            inlineSources: true,
          },
        })
        return {
          code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
          map: result.sourceMapText,
        }
      },
    },
  }
}
