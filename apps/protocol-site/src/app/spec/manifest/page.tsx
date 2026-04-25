import {
  DocLayout,
  H2,
  P,
  InlineCode,
  CodeBlock,
  PageHeader,
  Table,
  NextLink,
} from "@/components/doc-layout";

export const metadata = { title: "manifest.json — Spec · agents402" };

const TOC = [
  { id: "endpoint", text: "Endpoint" },
  { id: "headers", text: "Required headers" },
  { id: "schema", text: "JSON schema" },
  { id: "validation", text: "Validation rules" },
  { id: "errors", text: "Error responses" },
];

export default function Page() {
  return (
    <DocLayout activePath="/spec/manifest" toc={TOC}>
      <PageHeader
        kicker="Specification"
        title="manifest.json"
        lead="Wire-level reference for the agents402 manifest. This is the contract between a publisher and any conforming agent."
      />

      <H2 id="endpoint">Endpoint</H2>
      <Table
        headers={["Property", "Value"]}
        rows={[
          ["Path", <InlineCode key="p">/.well-known/agents402.json</InlineCode>],
          ["Method", "GET"],
          ["Auth", "None — manifest is fully public"],
          ["Status (success)", "200 OK"],
          ["Status (not implemented)", "404 Not Found"],
        ]}
      />

      <H2 id="headers">Required headers</H2>
      <Table
        headers={["Header", "Value", "Notes"]}
        rows={[
          [
            <InlineCode key="ct">Content-Type</InlineCode>,
            <InlineCode key="ctv">application/json</InlineCode>,
            "MUST be application/json. UTF-8 encoded.",
          ],
          [
            <InlineCode key="cors">Access-Control-Allow-Origin</InlineCode>,
            <InlineCode key="corsv">*</InlineCode>,
            "Manifest must be CORS-readable so browser-based agents can fetch it.",
          ],
          [
            <InlineCode key="cc">Cache-Control</InlineCode>,
            "max-age ≤ 3600",
            "Recommended. Manifests are expected to change infrequently but not be immutable.",
          ],
        ]}
      />

      <H2 id="schema">JSON schema</H2>
      <CodeBlock filename="agents402-manifest-v0.1.schema.json" lang="json">
{`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type":    "object",
  "required": ["version", "service", "actions", "receipts"],
  "properties": {
    "version": { "const": "0.1" },
    "service": {
      "type": "object",
      "required": ["name", "homepage"],
      "properties": {
        "name":              { "type": "string", "maxLength": 256 },
        "description":       { "type": "string", "maxLength": 1024 },
        "homepage":          { "type": "string", "format": "uri" },
        "lightning_address": { "type": "string", "maxLength": 256 }
      }
    },
    "actions": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "endpoint", "method", "price_msats"],
        "properties": {
          "id":           { "type": "string", "pattern": "^[a-z][a-z0-9_.-]*$", "maxLength": 128 },
          "type":         { "enum": ["web_access", "structured_data", "site_agent_query", "verification"] },
          "title":        { "type": "string", "maxLength": 256 },
          "description":  { "type": "string", "maxLength": 1024 },
          "endpoint":     { "type": "string", "format": "uri" },
          "method":       { "const": "POST" },
          "price_msats":  { "type": "integer", "minimum": 0, "maximum": 1000000000 },
          "input_schema": { "type": "object" },
          "risk":         { "enum": ["low", "medium", "high"] }
        }
      }
    },
    "receipts": {
      "type": "object",
      "required": ["pubkey_hex", "algorithm"],
      "properties": {
        "pubkey_hex": { "type": "string", "pattern": "^[0-9a-f]+$" },
        "algorithm":  { "const": "ed25519" }
      }
    }
  }
}`}
      </CodeBlock>

      <H2 id="validation">Validation rules</H2>
      <Table
        headers={["Rule", "Reason"]}
        rows={[
          [
            <span key="r1">Action ids MUST match <InlineCode>^[a-z][a-z0-9_.-]*$</InlineCode>.</span>,
            "Lowercase, dot-separated. Stable identifiers across reputation systems.",
          ],
          [
            <span key="r2">Action ids MUST be unique within a manifest.</span>,
            "Receipts reference id; collisions create ambiguity.",
          ],
          [
            <span key="r3">Endpoint URLs MUST be absolute and use https.</span>,
            "Plaintext discovery is acceptable; payment redirects are not.",
          ],
          [
            <span key="r4">Endpoint hostnames MUST share an eTLD+1 with the manifest URL.</span>,
            "Prevents a site from publishing endpoints at a third party.",
          ],
          [
            <span key="r5">Service pubkey MUST be a valid Ed25519 SPKI in hex.</span>,
            "Verification with standard libraries; no per-impl key formats.",
          ],
        ]}
      />

      <H2 id="errors">Error responses</H2>
      <P>
        A publisher that does not support agents402 SHOULD return{" "}
        <InlineCode>404 Not Found</InlineCode> for the manifest path. Other
        statuses are reserved:
      </P>
      <Table
        headers={["Status", "Meaning"]}
        rows={[
          ["404", "Publisher does not support agents402 (or temporarily disabled)."],
          ["503", "Manifest temporarily unavailable; agents may retry with backoff."],
          ["410", "Publisher has permanently retired agents402 support."],
        ]}
      />

      <NextLink
        href="/spec/wire"
        title="Wire format"
        description="Exact HTTP request and response shapes for the 402 challenge and retry."
      />
    </DocLayout>
  );
}
