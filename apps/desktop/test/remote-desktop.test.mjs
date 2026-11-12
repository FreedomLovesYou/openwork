import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceUrl, workspaceRequestAllowed } from "../remote/policy.mjs";

test("accept HTTPS and private VPN addresses, reject public plaintext and credential URLs", () => {
  for (const url of ["https://workspace.example.com", "http://100.80.10.2:5179", "http://127.0.0.1:5179", "http://192.168.1.2:80"]) {
    assert.ok(workspaceUrl(url));
  }
  for (const url of ["http://example.com", "http://100.128.1.1", "http://172.32.1.1", "file:///etc/passwd", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com?token=secret", "https://example.com#token"]) {
    assert.throws(() => workspaceUrl(url));
  }
});

test("only workspace origin and its matching websocket are allowed", () => {
  const address = "https://workspace.example.com";
  assert.equal(workspaceRequestAllowed(address + "/api/events", address), true);
  assert.equal(workspaceRequestAllowed("wss://workspace.example.com/events", address), true);
  for (const target of ["https://api.openworklabs.com", "https://workspace.example.com.evil.test", "https://workspace.example.com:444", "ws://workspace.example.com/events", "file:///etc/passwd", "invalid"]) {
    assert.equal(workspaceRequestAllowed(target, address), false);
  }
  assert.equal(workspaceRequestAllowed(address, ""), false);
});
