/**
 * Cin7 Core allows a limited set of API connector IPs. Register these in Cin7
 * against the integrations that call the Core API from these fixed endpoints.
 */
export type Cin7ConnectorInfo = { name: string; ip: string };

export function getCin7RegisteredConnectors(): Cin7ConnectorInfo[] {
  const stockName = process.env.CIN7_CONNECTOR_STOCKTRIM_NAME?.trim() || 'StockTrim1';
  const stockIp = process.env.CIN7_CONNECTOR_STOCKTRIM_IP?.trim() || '147.243.240.166';
  const tfName = process.env.CIN7_CONNECTOR_TRANSFREIGHT_NAME?.trim() || 'Transfreight';
  const tfIp = process.env.CIN7_CONNECTOR_TRANSFREIGHT_IP?.trim() || '147.243.252.247';
  return [
    { name: stockName, ip: stockIp },
    { name: tfName, ip: tfIp },
  ];
}
