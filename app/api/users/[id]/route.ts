import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api";

// Delete an account (ADMIN only). You can't delete your own account, and you
// can't remove the last remaining user — that would lock everyone out.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  if (params.id === auth.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const count = await prisma.user.count();
  if (count <= 1) {
    return NextResponse.json({ error: "Can't delete the last account." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
