import { SharedRepertoireManager } from "@/components/SharedRepertoireManager";

export default async function SharedRepertoirePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <SharedRepertoireManager code={code} />;
}
