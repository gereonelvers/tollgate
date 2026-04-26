/**
 * @agents402/wallet — wallet backend abstraction.
 *
 * The interface itself is re-exported from @agents402/core (so other code
 * doesn't need to depend on this package just to use the type). This package
 * ships concrete backend implementations.
 */
export {
  type WalletBackend,
  type WalletBalance,
  type CreateInvoiceParams,
  type CreatedInvoice,
  type PayInvoiceParams,
  type PayInvoiceResult,
  type InvoiceLookupResult,
  type ReceiveAddressResult,
  type WalletExport,
} from "@agents402/core";

export { DevFakeWalletBackend } from "./backends/dev-fake.js";
export { NwcWalletBackend } from "./backends/nwc.js";
