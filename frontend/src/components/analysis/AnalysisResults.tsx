import { Code2, Globe, FolderTree, BarChart3 } from "lucide-react";
import type { AnalysisResults as AnalysisResultsType } from "@/types";
import { cn } from "@/lib/utils";

function FileTreeNodeView({ node, depth = 0 }: { node: any; depth?: number }) {
  if (node.type === "file") {
    return (
      <div
        className="truncate pl-4 text-meta-sm text-muted-foreground"
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        {node.name}
      </div>
    );
  }
  return (
    <div>
      <div
        className="text-meta-sm font-medium text-foreground"
        style={{ paddingLeft: depth * 12 }}
      >
        {node.name === "/" ? "root" : node.name}
      </div>
      {node.children?.map((child: any, i: number) => (
        <FileTreeNodeView
          key={`${child.name}-${i}`}
          node={child}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

interface AnalysisResultsProps {
  results: AnalysisResultsType;
  className?: string;
}

export function AnalysisResults({ results, className }: AnalysisResultsProps) {
  const langs = results.languages_json?.breakdown ?? [];
  const endpoints = results.endpoints_json;
  const complexity = results.complexity_json;
  const tree = results.file_tree_json;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <h3 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            Languages
          </h3>
        </div>
        {langs.length === 0 ? (
          <p className="text-meta text-muted-foreground">
            No languages detected.
          </p>
        ) : (
          <ul className="space-y-2">
            {langs.map((l) => (
              <li
                key={l.language}
                className="flex items-center justify-between text-body-sm"
              >
                <span className="capitalize">
                  {l.language}
                  {l.depth === "shallow" && (
                    <span className="ml-2 text-meta-sm text-muted-foreground">
                      (shallow)
                    </span>
                  )}
                </span>
                <span className="text-meta text-muted-foreground">
                  {l.files} files · {l.percent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            Endpoints
          </h3>
        </div>
        <p className="text-2xl font-semibold">{endpoints?.count ?? 0}</p>
        <p className="text-meta text-muted-foreground">HTTP routes detected</p>
        {endpoints?.frameworks?.length ? (
          <p className="mt-2 text-meta-sm text-muted-foreground">
            Frameworks: {endpoints.frameworks.join(", ")}
          </p>
        ) : null}
        {endpoints?.items?.length ? (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-meta-sm">
            {endpoints.items.slice(0, 12).map((ep, i) => (
              <li key={i} className="font-mono text-muted-foreground">
                <span className="text-foreground">{ep.method}</span> {ep.path}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            Complexity
          </h3>
        </div>
        <p className="text-meta text-muted-foreground">
          {complexity?.total_files ?? 0} files · {complexity?.total_lines ?? 0}{" "}
          lines
        </p>
        {complexity?.parse_stats && (
          <p className="mt-1 text-meta-sm text-muted-foreground">
            Parsed {complexity.parse_stats.parsed_files} files with Tree-sitter
          </p>
        )}
        {complexity?.largest_files?.[0] && (
          <p className="mt-2 text-meta-sm">
            Largest:{" "}
            <span className="font-mono">
              {complexity.largest_files[0].path}
            </span>{" "}
            ({complexity.largest_files[0].lines} lines)
          </p>
        )}
      </div>

      {tree && (
        <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <h3 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
              File tree
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md bg-muted/30 p-2">
            <FileTreeNodeView node={tree} />
          </div>
        </div>
      )}
    </div>
  );
}
