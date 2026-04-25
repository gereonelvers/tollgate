import { NWCClient } from "@getalby/sdk";

let client: NWCClient | null = null;

export function getAgentWallet(): NWCClient {
  if (client) return client;
  const url = process.env.AGENT_NWC_URL;
  if (!url) {
    throw new Error(
      "AGENT_NWC_URL env var is not set. Configure your NWC connection URI in the MCP server config.",
    );
  }
  client = new NWCClient({ nostrWalletConnectUrl: url });
  return client;
}

export async function payInvoice(invoice: string): Promise<{ preimage: string; fees_paid_msats: number }> {
  const wallet = getAgentWallet();
  const result = await wallet.payInvoice({ invoice });
  return { preimage: result.preimage, fees_paid_msats: result.fees_paid ?? 0 };
}

export async function getBalance(): Promise<{ balance_msats: number }> {
  const wallet = getAgentWallet();
  const result = await wallet.getBalance();
  return { balance_msats: result.balance };
}
