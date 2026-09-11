/**
 * Provider-agnostic transport contract (UNI-2671 A2).
 *
 * Nothing above this line knows what SendGrid is. The mailer, the queue, the
 * templates and the receipts all speak this interface, so replacing the
 * provider is one file and one factory line.
 *
 * The result type has no "probably fine" state. A transport either has the
 * provider's acceptance (`accepted`), or it has a reason it does not.
 */

export type OutboundMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Provider-side metadata; used to correlate delivery events back to a receipt. */
  customArgs?: Record<string, string>;
  /** Provider-side grouping label, e.g. the template name. */
  category?: string;
};

export type TransportResult =
  | {
      accepted: true;
      /** The provider's own id for the accepted message. */
      providerMessageId: string;
      /** True when the provider validated the message and deliberately did not deliver it. */
      sandboxed: boolean;
    }
  | {
      accepted: false;
      /**
       * `permanent` — the provider rejected the message and will reject it
       * again unchanged (bad address, unverified sender, revoked key).
       * `transient` — the attempt failed for a reason a later attempt may not
       * hit (network, 429, 5xx). Only transient failures are worth retrying.
       */
      kind: 'permanent' | 'transient';
      /** HTTP status where one was received; null when the request never completed. */
      status: number | null;
      /** Provider-supplied explanation, truncated. Never contains credentials. */
      detail: string;
    };

export interface MailTransport {
  readonly name: string;
  /**
   * Send one message. Implementations MUST NOT return `accepted: true` unless
   * the provider actually accepted it; a local short-circuit that reports
   * success is the exact defect this module exists to prevent.
   */
  send(message: OutboundMessage): Promise<TransportResult>;
  /**
   * Prove the credential is live against the provider. Returns false — never
   * throws — when the provider is unreachable, so an unreachable provider can
   * never be recorded as an authenticated one.
   */
  verifyCredentials(): Promise<boolean>;
}
