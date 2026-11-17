// Vercel function: POST /api/resolve. Follows a TorBox link's redirects and returns the file server's address.
// It never downloads the file. See src/lib/resolveLink.ts.
// The ".js" is required: Vercel compiles this file on its own and Node's ES module loader needs the extension.
import { handleResolve } from '../src/lib/resolveLink.js';

export function POST(request: Request) {
    return handleResolve(request);
}
