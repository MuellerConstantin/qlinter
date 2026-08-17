import type { LintConfig, Severity } from '@qlinter/core';

export type DiagnosticCounts = Record<Severity, number>;

export type Status = 'active' | 'loading' | 'errored' | 'needs-permission' | 'not-applicable';

export type StatusMessage = { type: 'qlinter:status'; status: Status };
export type DiagnosticsMessage = { type: 'qlinter:diagnostics'; counts: DiagnosticCounts; fixable: number };
export type LocationChangeMessage = { type: 'qlinter:location-change' };
export type GetStatusMessage = { type: 'qlinter:get-status' };
export type GetDiagnosticsMessage = { type: 'qlinter:get-diagnostics' };
export type FixAllMessage = { type: 'qlinter:fix-all' };
export type Message =
  | StatusMessage
  | LocationChangeMessage
  | GetStatusMessage
  | GetDiagnosticsMessage
  | DiagnosticsMessage
  | FixAllMessage;

export type DiagnosticsBridgeMessage = {
  source: 'qlinter-main';
  type: 'qlinter:diagnostics';
  counts: DiagnosticCounts;
  fixable: number;
};
export type FixAllBridgeMessage = { source: 'qlinter-content'; type: 'qlinter:fix-all' };
export type ConfigBridgeMessage = { source: 'qlinter-content'; type: 'qlinter:config'; config: LintConfig };
export type LocationChangeBridgeMessage = { source: 'qlinter-content'; type: 'qlinter:location-change' };
export type GetConfigBridgeMessage = { source: 'qlinter-main'; type: 'qlinter:get-config' };
export type BridgeMessage =
  | DiagnosticsBridgeMessage
  | FixAllBridgeMessage
  | ConfigBridgeMessage
  | LocationChangeBridgeMessage
  | GetConfigBridgeMessage;
