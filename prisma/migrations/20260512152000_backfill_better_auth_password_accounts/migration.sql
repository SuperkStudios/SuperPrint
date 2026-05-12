INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT 'acct_' || "id", lower("email"), 'credential', "id", "passwordHash", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordHash" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Account" WHERE "Account"."userId" = "User"."id" AND "Account"."providerId" = 'credential'
  );
