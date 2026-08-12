import { normalizeRoomCode } from "@/lib/room";
import { OfficeClient } from "@/ui/OfficeClient";

export const dynamic = "force-static";

export default async function OfficePage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  return <OfficeClient roomCode={normalizeRoomCode(room) || "LOBBY"} />;
}
