export function toPgDumpUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.delete("schema");
  return url.toString();
}
