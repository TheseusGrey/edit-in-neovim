import systeminformation from "systeminformation";

export async function isPortInUse(port: string) {
  const networkConnections = await systeminformation.networkConnections();

  return networkConnections.find((networkConnection) => {
    return networkConnection.localPort === String(port);
  }) !== undefined;
}
