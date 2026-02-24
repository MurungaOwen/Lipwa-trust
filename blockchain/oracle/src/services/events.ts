import { sorobanRpc } from "./stellar";

export interface ContractEventResponse {
  event: string;
  timestamp: string;
  data: unknown;
}

export async function getContractEvents(
  contractId: string,
): Promise<ContractEventResponse[]> {
  const eventsResult: any = await sorobanRpc.getEvents({
    startLedger: 1,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
      },
    ],
    limit: 100,
  });

  const events = eventsResult.events ?? [];

  return events.map((entry: any) => ({
    event: entry.topic?.join(":") ?? "audit",
    timestamp: entry.ledgerClosedAt ?? new Date().toISOString(),
    data: entry.value ?? entry,
  }));
}
