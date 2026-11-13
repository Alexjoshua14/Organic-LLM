/**
 * One real change per supported language, authored once and used twice by the Gen UI Lab: as the
 * unified diff a model would send (code diff page) and as the plain snippet it would fence (Code
 * page). `code` is the diff's unchanged and added lines, so the two cannot drift apart.
 * `tests/unit/gen-ui-lab-languages.test.ts` guards the shape: every supported language has
 * exactly one sample, and its path resolves back to that language.
 */
export type LanguageSample = {
  /** A language `components/shared/code-highlight.tsx` supports. */
  id: string;
  /** Where the change lives; its extension is how the diff block finds the language. */
  path: string;
  /** Unified diff text: bare `@@` header, then ' ', '+' and '-' lines. */
  diff: string;
  /** The result, as a fenced snippet: the diff without its removed lines or markers. */
  code: string;
};

export const LANGUAGE_SAMPLES: ReadonlyArray<LanguageSample> = [
  {
    id: "typescript",
    path: "lib/subscribe.ts",
    diff: '@@\n export async function subscribe(input: unknown) {\n-  const { email } = input as { email: string };\n+  const { email } = schema.parse(input);\n   return fetch("/api/subscribe", {\n     method: "POST",\n     body: JSON.stringify({ email }),\n   });\n }',
    code: 'export async function subscribe(input: unknown) {\n  const { email } = schema.parse(input);\n  return fetch("/api/subscribe", {\n    method: "POST",\n    body: JSON.stringify({ email }),\n  });\n}',
  },
  {
    id: "tsx",
    path: "components/Counter.tsx",
    diff: '@@\n export function Counter({ initial = 0 }: { initial?: number }) {\n-  const [count, setCount] = useState(initial);\n+  const [count, setCount] = useState<number>(initial);\n   return (\n-    <button onClick={() => setCount(count + 1)}>{count}</button>\n+    <button type="button" onClick={() => setCount((n) => n + 1)}>\n+      Clicked {count} times\n+    </button>\n   );\n }',
    code: 'export function Counter({ initial = 0 }: { initial?: number }) {\n  const [count, setCount] = useState<number>(initial);\n  return (\n    <button type="button" onClick={() => setCount((n) => n + 1)}>\n      Clicked {count} times\n    </button>\n  );\n}',
  },
  {
    id: "javascript",
    path: "src/greet.js",
    diff: '@@\n function greet(name) {\n-  return "Hello, " + name;\n+  const label = name?.trim() || "friend";\n+  return `Hello, ${label}!`;\n }\n module.exports = { greet };',
    code: 'function greet(name) {\n  const label = name?.trim() || "friend";\n  return `Hello, ${label}!`;\n}\nmodule.exports = { greet };',
  },
  {
    id: "jsx",
    path: "src/Badge.jsx",
    diff: '@@\n export function Badge({ tone = "info", children }) {\n-  return <span className="badge">{children}</span>;\n+  return <span className={`badge badge-${tone}`}>{children}</span>;\n }',
    code: 'export function Badge({ tone = "info", children }) {\n  return <span className={`badge badge-${tone}`}>{children}</span>;\n}',
  },
  {
    id: "json",
    path: "package.json",
    diff: '@@\n {\n   "name": "organic",\n-  "version": "1.4.0",\n+  "version": "1.5.0",\n   "scripts": {\n-    "dev": "next dev"\n+    "dev": "next dev --turbopack"\n   }\n }',
    code: '{\n  "name": "organic",\n  "version": "1.5.0",\n  "scripts": {\n    "dev": "next dev --turbopack"\n  }\n}',
  },
  {
    id: "bash",
    path: "scripts/deploy.sh",
    diff: '@@\n #!/usr/bin/env bash\n-set -e\n+set -euo pipefail\n for env in staging production; do\n-  echo "deploying $env"\n+  echo "deploying $env" | tee -a deploy.log\n done',
    code: '#!/usr/bin/env bash\nset -euo pipefail\nfor env in staging production; do\n  echo "deploying $env" | tee -a deploy.log\ndone',
  },
  {
    id: "python",
    path: "app/stats.py",
    diff: '@@\n def mean(values: list[float]) -> float:\n-    return sum(values) / len(values)\n+    if not values:\n+        raise ValueError("mean() of empty list")\n+    return sum(values) / len(values)',
    code: 'def mean(values: list[float]) -> float:\n    if not values:\n        raise ValueError("mean() of empty list")\n    return sum(values) / len(values)',
  },
  {
    id: "css",
    path: "styles/card.css",
    diff: "@@\n .card {\n-  border: 1px solid #ddd;\n+  border: 1px solid var(--border);\n-  border-radius: 4px;\n+  border-radius: 10px;\n   padding: 16px;\n }",
    code: ".card {\n  border: 1px solid var(--border);\n  border-radius: 10px;\n  padding: 16px;\n}",
  },
  {
    id: "markup",
    path: "public/index.html",
    diff: '@@\n <!doctype html>\n-<html>\n+<html lang="en">\n <head>\n-  <title>Organic</title>\n+  <meta charset="utf-8" />\n+  <title>Organic</title>\n </head>',
    code: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>Organic</title>\n</head>',
  },
  {
    id: "yaml",
    path: ".github/workflows/ci.yml",
    diff: "@@\n name: ci\n on: [push]\n jobs:\n   test:\n-    runs-on: ubuntu-20.04\n+    runs-on: ubuntu-latest\n     steps:\n-      - run: npm test\n+      - run: bun run test:unit",
    code: "name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: bun run test:unit",
  },
  {
    id: "sql",
    path: "db/report.sql",
    diff: "@@\n SELECT user_id, COUNT(*) AS events\n FROM events\n-WHERE created_at > NOW() - INTERVAL '30 days'\n+WHERE created_at > NOW() - INTERVAL '7 days'\n GROUP BY user_id\n-ORDER BY events;\n+ORDER BY events DESC\n+LIMIT 10;",
    code: "SELECT user_id, COUNT(*) AS events\nFROM events\nWHERE created_at > NOW() - INTERVAL '7 days'\nGROUP BY user_id\nORDER BY events DESC\nLIMIT 10;",
  },
  {
    id: "diff",
    path: "patches/fix-typo.patch",
    diff: "@@\n --- a/README.md\n +++ b/README.md\n @@ -1,3 +1,3 @@\n # Organic\n--A smal app.\n++A small app.",
    code: "--- a/README.md\n+++ b/README.md\n@@ -1,3 +1,3 @@\n# Organic\n+A small app.",
  },
  {
    id: "markdown",
    path: "docs/README.md",
    diff: "@@\n # Organic\n-A chat app.\n+A chat app with **memory** and a [design lab](docs/design/README.md).\n ## Setup\n-1. Install\n+1. Install with `bun install`",
    code: "# Organic\nA chat app with **memory** and a [design lab](docs/design/README.md).\n## Setup\n1. Install with `bun install`",
  },
  {
    id: "go",
    path: "cmd/server/main.go",
    diff: '@@\n func main() {\n-\thttp.ListenAndServe(":8080", nil)\n+\tif err := http.ListenAndServe(":8080", nil); err != nil {\n+\t\tlog.Fatal(err)\n+\t}\n }',
    code: 'func main() {\n\tif err := http.ListenAndServe(":8080", nil); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}',
  },
  {
    id: "rust",
    path: "src/lib.rs",
    diff: "@@\n pub fn parse(input: &str) -> Result<u32, ParseIntError> {\n-    input.parse::<u32>().unwrap()\n+    input.trim().parse::<u32>()\n }",
    code: "pub fn parse(input: &str) -> Result<u32, ParseIntError> {\n    input.trim().parse::<u32>()\n}",
  },
  {
    id: "java",
    path: "src/main/java/App.java",
    diff: '@@\n public class App {\n     public static void main(String[] args) {\n-        System.out.println("Hello");\n+        String name = args.length > 0 ? args[0] : "world";\n+        System.out.println("Hello, " + name + "!");\n     }\n }',
    code: 'public class App {\n    public static void main(String[] args) {\n        String name = args.length > 0 ? args[0] : "world";\n        System.out.println("Hello, " + name + "!");\n    }\n}',
  },
  {
    id: "c",
    path: "src/buffer.c",
    diff: "@@\n char *dup(const char *s) {\n-    char *p = malloc(strlen(s));\n+    char *p = malloc(strlen(s) + 1);\n+    if (!p) return NULL;\n     strcpy(p, s);\n     return p;\n }",
    code: "char *dup(const char *s) {\n    char *p = malloc(strlen(s) + 1);\n    if (!p) return NULL;\n    strcpy(p, s);\n    return p;\n}",
  },
  {
    id: "cpp",
    path: "src/stack.cpp",
    diff: "@@\n template <typename T>\n class Stack {\n-    std::vector<T> items;\n+    std::vector<T> items_;\n public:\n-    void push(T v) { items.push_back(v); }\n+    void push(T v) { items_.push_back(std::move(v)); }\n };",
    code: "template <typename T>\nclass Stack {\n    std::vector<T> items_;\npublic:\n    void push(T v) { items_.push_back(std::move(v)); }\n};",
  },
  {
    id: "csharp",
    path: "Services/Greeter.cs",
    diff: '@@\n public class Greeter\n {\n-    public string Greet(string name) => "Hello, " + name;\n+    public string Greet(string? name) => $"Hello, {name ?? "friend"}!";\n }',
    code: 'public class Greeter\n{\n    public string Greet(string? name) => $"Hello, {name ?? "friend"}!";\n}',
  },
  {
    id: "ruby",
    path: "lib/greeter.rb",
    diff: '@@\n class Greeter\n-  def greet(name)\n-    "Hello, " + name\n+  def greet(name = "friend")\n+    "Hello, #{name}!"\n   end\n end',
    code: 'class Greeter\n  def greet(name = "friend")\n    "Hello, #{name}!"\n  end\nend',
  },
  {
    id: "php",
    path: "src/Greeter.php",
    diff: '@@\n <?php\n function greet(?string $name): string\n {\n-    return "Hello, " . $name;\n+    return "Hello, " . ($name ?? "friend") . "!";\n }',
    code: '<?php\nfunction greet(?string $name): string\n{\n    return "Hello, " . ($name ?? "friend") . "!";\n}',
  },
  {
    id: "swift",
    path: "Sources/Greeter.swift",
    diff: '@@\n func greet(_ name: String?) -> String {\n-    return "Hello, " + name!\n+    guard let name else { return "Hello, friend!" }\n+    return "Hello, \\(name)!"\n }',
    code: 'func greet(_ name: String?) -> String {\n    guard let name else { return "Hello, friend!" }\n    return "Hello, \\(name)!"\n}',
  },
  {
    id: "kotlin",
    path: "src/main/kotlin/Greeter.kt",
    diff: '@@\n fun greet(name: String?): String {\n-    return "Hello, " + name\n+    val label = name ?: "friend"\n+    return "Hello, $label!"\n }',
    code: 'fun greet(name: String?): String {\n    val label = name ?: "friend"\n    return "Hello, $label!"\n}',
  },
  {
    id: "scala",
    path: "src/main/scala/Greeter.scala",
    diff: '@@\n object Greeter {\n-  def greet(name: String): String = "Hello, " + name\n+  def greet(name: Option[String]): String =\n+    s"Hello, ${name.getOrElse("friend")}!"\n }',
    code: 'object Greeter {\n  def greet(name: Option[String]): String =\n    s"Hello, ${name.getOrElse("friend")}!"\n}',
  },
  {
    id: "dart",
    path: "lib/greeter.dart",
    diff: "@@\n String greet(String? name) {\n-  return 'Hello, ' + name!;\n+  final label = name ?? 'friend';\n+  return 'Hello, $label!';\n }",
    code: "String greet(String? name) {\n  final label = name ?? 'friend';\n  return 'Hello, $label!';\n}",
  },
  {
    id: "lua",
    path: "lua/greeter.lua",
    diff: '@@\n local function greet(name)\n-  return "Hello, " .. name\n+  name = name or "friend"\n+  return ("Hello, %s!"):format(name)\n end\n return { greet = greet }',
    code: 'local function greet(name)\n  name = name or "friend"\n  return ("Hello, %s!"):format(name)\nend\nreturn { greet = greet }',
  },
  {
    id: "perl",
    path: "lib/Greeter.pl",
    diff: '@@\n sub greet {\n-    my $name = shift;\n+    my $name = shift // "friend";\n     return "Hello, $name!";\n }',
    code: 'sub greet {\n    my $name = shift // "friend";\n    return "Hello, $name!";\n}',
  },
  {
    id: "r",
    path: "R/summary.R",
    diff: "@@\n summarise <- function(x) {\n-  mean(x)\n+  list(mean = mean(x, na.rm = TRUE), sd = sd(x, na.rm = TRUE))\n }",
    code: "summarise <- function(x) {\n  list(mean = mean(x, na.rm = TRUE), sd = sd(x, na.rm = TRUE))\n}",
  },
  {
    id: "haskell",
    path: "src/Greeter.hs",
    diff: '@@\n greet :: Maybe String -> String\n-greet name = "Hello, " ++ maybe "friend" id name\n+greet name = "Hello, " ++ fromMaybe "friend" name ++ "!"',
    code: 'greet :: Maybe String -> String\ngreet name = "Hello, " ++ fromMaybe "friend" name ++ "!"',
  },
  {
    id: "elixir",
    path: "lib/greeter.ex",
    diff: '@@\n defmodule Greeter do\n-  def greet(name), do: "Hello, " <> name\n+  def greet(name \\\\ "friend"), do: "Hello, #{name}!"\n end',
    code: 'defmodule Greeter do\n  def greet(name \\\\ "friend"), do: "Hello, #{name}!"\nend',
  },
  {
    id: "powershell",
    path: "scripts/Get-Status.ps1",
    diff: '@@\n param([string]$Name = "service")\n-Get-Service $Name\n+$svc = Get-Service -Name $Name -ErrorAction Stop\n+Write-Host "$($svc.Name): $($svc.Status)"',
    code: 'param([string]$Name = "service")\n$svc = Get-Service -Name $Name -ErrorAction Stop\nWrite-Host "$($svc.Name): $($svc.Status)"',
  },
  {
    id: "docker",
    path: "Dockerfile",
    diff: "@@\n-FROM node:18\n+FROM node:22-alpine\n WORKDIR /app\n COPY package.json bun.lock ./\n-RUN npm install\n+RUN bun install --frozen-lockfile\n COPY . .",
    code: "FROM node:22-alpine\nWORKDIR /app\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile\nCOPY . .",
  },
  {
    id: "toml",
    path: "Cargo.toml",
    diff: '@@\n [package]\n name = "organic"\n-version = "0.1.0"\n+version = "0.2.0"\n edition = "2021"\n+rust-version = "1.75"',
    code: '[package]\nname = "organic"\nversion = "0.2.0"\nedition = "2021"\nrust-version = "1.75"',
  },
  {
    id: "ini",
    path: "config/app.ini",
    diff: "@@\n [server]\n-port = 8000\n+port = 8080\n host = 0.0.0.0\n ; keep quiet in production\n-debug = true\n+debug = false",
    code: "[server]\nport = 8080\nhost = 0.0.0.0\n; keep quiet in production\ndebug = false",
  },
  {
    id: "graphql",
    path: "schema/user.graphql",
    diff: "@@\n type User {\n   id: ID!\n-  name: String\n+  name: String!\n+  email: String!\n }",
    code: "type User {\n  id: ID!\n  name: String!\n  email: String!\n}",
  },
  {
    id: "scss",
    path: "styles/button.scss",
    diff: "@@\n .button {\n-  background: #0b5fff;\n+  background: $accent;\n   &:hover {\n-    background: #0a4fd6;\n+    background: darken($accent, 8%);\n   }\n }",
    code: ".button {\n  background: $accent;\n  &:hover {\n    background: darken($accent, 8%);\n  }\n}",
  },
  {
    id: "less",
    path: "styles/button.less",
    diff: "@@\n @accent: #0b5fff;\n .button {\n-  background: @accent;\n+  background: fade(@accent, 90%);\n   &:hover { background: darken(@accent, 8%); }\n }",
    code: "@accent: #0b5fff;\n.button {\n  background: fade(@accent, 90%);\n  &:hover { background: darken(@accent, 8%); }\n}",
  },
  {
    id: "makefile",
    path: "Makefile",
    diff: "@@\n .PHONY: test\n-test:\n-\tnpm test\n+test: build\n+\tbun run test:unit\n build:\n \tbun run build",
    code: ".PHONY: test\ntest: build\n\tbun run test:unit\nbuild:\n\tbun run build",
  },
  {
    id: "objectivec",
    path: "Sources/Greeter.m",
    diff: '@@\n - (NSString *)greet:(NSString *)name {\n-    return [@"Hello, " stringByAppendingString:name];\n+    NSString *label = name ?: @"friend";\n+    return [NSString stringWithFormat:@"Hello, %@!", label];\n }',
    code: '- (NSString *)greet:(NSString *)name {\n    NSString *label = name ?: @"friend";\n    return [NSString stringWithFormat:@"Hello, %@!", label];\n}',
  },
  {
    id: "protobuf",
    path: "proto/user.proto",
    diff: '@@\n syntax = "proto3";\n message User {\n   string id = 1;\n-  string name = 2;\n+  string display_name = 2;\n+  repeated string roles = 3;\n }',
    code: 'syntax = "proto3";\nmessage User {\n  string id = 1;\n  string display_name = 2;\n  repeated string roles = 3;\n}',
  },
  {
    id: "hcl",
    path: "infra/main.tf",
    diff: '@@\n resource "aws_s3_bucket" "assets" {\n   bucket = "organic-assets"\n-  acl    = "public-read"\n+  acl    = "private"\n+  tags = { env = "production" }\n }',
    code: 'resource "aws_s3_bucket" "assets" {\n  bucket = "organic-assets"\n  acl    = "private"\n  tags = { env = "production" }\n}',
  },
  {
    id: "zig",
    path: "src/main.zig",
    diff: '@@\n const std = @import("std");\n pub fn main() !void {\n-    std.debug.print("Hello\\n", .{});\n+    const name = "world";\n+    std.debug.print("Hello, {s}!\\n", .{name});\n }',
    code: 'const std = @import("std");\npub fn main() !void {\n    const name = "world";\n    std.debug.print("Hello, {s}!\\n", .{name});\n}',
  },
  {
    id: "julia",
    path: "src/greet.jl",
    diff: '@@\n function greet(name::Union{String,Nothing} = nothing)\n-    return "Hello, " * name\n+    label = something(name, "friend")\n+    return "Hello, $(label)!"\n end',
    code: 'function greet(name::Union{String,Nothing} = nothing)\n    label = something(name, "friend")\n    return "Hello, $(label)!"\nend',
  },
  {
    id: "clojure",
    path: "src/greeter/core.clj",
    diff: '@@\n (ns greeter.core)\n (defn greet\n-  [name]\n-  (str "Hello, " name))\n+  ([] (greet "friend"))\n+  ([name] (str "Hello, " name "!")))',
    code: '(ns greeter.core)\n(defn greet\n  ([] (greet "friend"))\n  ([name] (str "Hello, " name "!")))',
  },
  {
    id: "ocaml",
    path: "lib/greeter.ml",
    diff: '@@\n let greet name =\n-  "Hello, " ^ name\n+  match name with\n+  | Some n -> "Hello, " ^ n ^ "!"\n+  | None -> "Hello, friend!"',
    code: 'let greet name =\n  match name with\n  | Some n -> "Hello, " ^ n ^ "!"\n  | None -> "Hello, friend!"',
  },
  {
    id: "groovy",
    path: "build.gradle",
    diff: "@@\n plugins {\n     id 'java'\n }\n repositories {\n-    jcenter()\n+    mavenCentral()\n }",
    code: "plugins {\n    id 'java'\n}\nrepositories {\n    mavenCentral()\n}",
  },
  {
    id: "nginx",
    path: "nginx/organic.nginx",
    diff: "@@\n server {\n-    listen 80;\n+    listen 443 ssl http2;\n     server_name organic.example;\n+    ssl_certificate /etc/ssl/organic.pem;\n     location / { proxy_pass http://app:3000; }\n }",
    code: "server {\n    listen 443 ssl http2;\n    server_name organic.example;\n    ssl_certificate /etc/ssl/organic.pem;\n    location / { proxy_pass http://app:3000; }\n}",
  },
  {
    id: "http",
    path: "requests/subscribe.http",
    diff: '@@\n-POST /api/subscribe HTTP/1.1\n+POST /api/v2/subscribe HTTP/1.1\n Host: organic.example\n Content-Type: application/json\n+Authorization: Bearer {{token}}\n {"email": "ada@example.com"}',
    code: 'POST /api/v2/subscribe HTTP/1.1\nHost: organic.example\nContent-Type: application/json\nAuthorization: Bearer {{token}}\n{"email": "ada@example.com"}',
  },
  {
    id: "solidity",
    path: "contracts/Vault.sol",
    diff: "@@\n contract Vault {\n     mapping(address => uint256) public balances;\n-    function withdraw(uint256 amount) external {\n-        payable(msg.sender).transfer(amount);\n+    function withdraw(uint256 amount) external {\n+        balances[msg.sender] -= amount;\n+        payable(msg.sender).transfer(amount);\n     }\n }",
    code: "contract Vault {\n    mapping(address => uint256) public balances;\n    function withdraw(uint256 amount) external {\n        balances[msg.sender] -= amount;\n        payable(msg.sender).transfer(amount);\n    }\n}",
  },
  {
    id: "vim",
    path: "vim/init.vim",
    diff: '@@\n set number\n-set tabstop=8\n+set tabstop=2\n+set shiftwidth=2\n syntax on\n " enable mouse support\n set mouse=a',
    code: 'set number\nset tabstop=2\nset shiftwidth=2\nsyntax on\n" enable mouse support\nset mouse=a',
  },
  {
    id: "latex",
    path: "paper/main.tex",
    diff: "@@\n \\documentclass{article}\n \\begin{document}\n-Euler: $e^{i\\pi} = -1$\n+Euler's identity: $e^{i\\pi} + 1 = 0$\n \\end{document}",
    code: "\\documentclass{article}\n\\begin{document}\nEuler's identity: $e^{i\\pi} + 1 = 0$\n\\end{document}",
  },
];
