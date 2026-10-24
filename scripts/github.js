// Usa la credencial existente de Git Credential Manager solo en memoria.
// Nunca imprime ni escribe el token. Requiere autorización previa en el equipo.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const repo = 'jefroMMM/Yeimi';
async function main() {
  const result = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  const token = result.stdout?.split('\n').find(line => line.startsWith('password='))?.slice(9);
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const endpoint = process.argv[2] || '';
  const response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, { headers });
  const body = await response.json();
  if (!response.ok) throw Error(`GitHub HTTP ${response.status}: ${body.message}`);
  const safe = endpoint.includes('/actions/runs') ? body : { full_name: body.full_name, private: body.private, permissions: body.permissions, default_branch: body.default_branch, authenticated: Boolean(token) };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(safe, null, 2));
  else console.log(JSON.stringify(safe, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
