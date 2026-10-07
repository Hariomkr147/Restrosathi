import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

export async function runRetention(s3: S3Client, bucket: string, retentionDays: number): Promise<void> {
  let continuationToken: string | undefined = undefined;
  const objects: { Key: string; LastModified: Date }[] = [];

  do {
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "restrosathi/",
      ContinuationToken: continuationToken
    }));

    if (listRes.Contents) {
      for (const obj of listRes.Contents) {
        if (obj.Key && obj.LastModified) {
          objects.push({ Key: obj.Key, LastModified: obj.LastModified });
        }
      }
    }
    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  if (objects.length === 0) return;

  // Group by base name (without .sha256) so we delete both or neither
  const grouped = new Map<string, { Key: string; LastModified: Date }[]>();
  for (const obj of objects) {
    const base = obj.Key.replace(/\.(sha256|enc)$/, "");
    const group = grouped.get(base) || [];
    group.push(obj);
    grouped.set(base, group);
  }

  const sortedBases = Array.from(grouped.entries()).sort((a, b) => {
    // Sort by LastModified of the first item in group, descending
    const dateA = a[1][0].LastModified.getTime();
    const dateB = b[1][0].LastModified.getTime();
    return dateB - dateA; // newest first
  });

  const now = Date.now();
  const toDelete: { Key: string }[] = [];

  // keep the newest one regardless of age
  const itemsToConsider = sortedBases.slice(1);

  for (const [base, group] of itemsToConsider) {
    const ageMs = now - group[0].LastModified.getTime();
    if (ageMs > retentionDays * 24 * 60 * 60 * 1000) {
      toDelete.push(...group.map(g => ({ Key: g.Key })));
    }
  }

  if (toDelete.length > 0) {
    // Delete in chunks of 1000
    for (let i = 0; i < toDelete.length; i += 1000) {
      const chunk = toDelete.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk }
      }));
    }
  }
}
