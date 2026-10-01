# Launches the shadcn MCP server with CWD = Frontend/ so it reads Frontend/components.json.
# Claude Code's .mcp.json has no `cwd` field — it sets CLAUDE_PROJECT_DIR to the repo ROOT,
# so the server would otherwise start at the repo root (no components.json there) and see only
# the default @shadcn registry. Running here exposes the project's registries (@react-bits),
# style (radix-rhea), and aliases (@/components/ui) to the MCP server.
Push-Location $PSScriptRoot
try {
    & npx shadcn@latest mcp
}
finally {
    Pop-Location
}
