const fs = require('fs');
const files = ['weekly-report','retention','reminders','feedback-themes','escalations','alerts'];
for (const f of files) {
  const p = 'src/app/api/cron/' + f + '/route.ts';
  let c = fs.readFileSync(p, 'utf8');
  let changed = false;

  if (c.includes('export async function GET(request: Request)')) {
    c = c.replace('export async function GET(request: Request)', 'export async function POST(req: Request)');
    changed = true;
  }
  if (c.includes('export async function GET(req: Request)')) {
    c = c.replace('export async function GET(req: Request)', 'export async function POST(req: Request)');
    changed = true;
  }

  // Remove old weak check if it exists
  const weakCheckRegex = /const auth = req\.headers\.get\("authorization"\);\s*if \(auth !== `Bearer \$\{process\.env\.CRON_SECRET\}`\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g;
  if (weakCheckRegex.test(c)) {
    c = c.replace(weakCheckRegex, '');
    changed = true;
  }

  if (!c.includes('verifyCronSecret')) {
    c = 'import { verifyCronSecret } from "@/lib/cron";\n' + c;
    const postMatch = c.match(/export async function POST\(req: Request\) \{/);
    if (postMatch) {
      c = c.replace(postMatch[0], postMatch[0] + '\n  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });');
      changed = true;
    }
  }

  // Fix `request` to `req` if it wasn't caught by the signature replace
  if (c.includes('request: Request')) {
      c = c.replace(/request: Request/g, 'req: Request');
  }

  if (changed) {
    fs.writeFileSync(p, c);
    console.log('Fixed ' + p);
  }
}
