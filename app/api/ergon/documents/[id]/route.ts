import { auth } from "@clerk/nextjs/server";

import { getErgonDocument } from "@/data/supabase/ergon-documents";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await getErgonDocument(id);

  if (!document) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ document });
}
