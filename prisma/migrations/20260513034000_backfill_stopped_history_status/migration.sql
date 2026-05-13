WITH stopped_history_jobs AS (
  SELECT id, "orderId"
  FROM "PrintJob"
  WHERE status = 'FAILED'
    AND "failureReason" = 'Imported stopped printer-history entry'
)
UPDATE "Order"
SET status = 'STOPPED'
WHERE id IN (SELECT "orderId" FROM stopped_history_jobs);

UPDATE "PrintJob"
SET status = 'STOPPED',
    "failureReason" = NULL
WHERE status = 'FAILED'
  AND "failureReason" = 'Imported stopped printer-history entry';
