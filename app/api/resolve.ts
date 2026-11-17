// Vercel function: POST /api/resolve. Follows a TorBox link's redirects and returns the file server's address.
// It never downloads the file. See src/lib/resolveLink.ts.
import { handleResolve } from '../src/lib/resolveLink';

export function POST(request: Request) {
    return handleResolve(request);
}
