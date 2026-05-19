-- The `assignee_scope` CASE classifies each inbox row into exactly one of
-- five buckets, mirroring the chip semantics in the inbox assignment filter
-- (see RFC v3 §B). The three "my_*" branches reuse the same squad/agent
-- predicates as ListIssues (server/pkg/db/queries/issue.sql:22-56), so the
-- two callers can never drift. `none` covers inbox items without an issue
-- or with an unassigned issue; `other` covers issues assigned to someone
-- else.

-- name: ListInboxItems :many
SELECT i.*,
       iss.status         AS issue_status,
       iss.assignee_type  AS issue_assignee_type,
       iss.assignee_id    AS issue_assignee_id,
       CASE
         WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
         WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
         WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                SELECT a.id FROM agent a
                 WHERE a.workspace_id = i.workspace_id
                   AND a.owner_id     = sqlc.arg('user_id')::uuid
              ) THEN 'my_agent'
         WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
         ELSE 'other'
       END AS assignee_scope
FROM inbox_item i
LEFT JOIN issue iss ON iss.id = i.issue_id
WHERE i.workspace_id = $1 AND i.recipient_type = $2 AND i.recipient_id = $3 AND i.archived = false
  AND (
    sqlc.narg('scopes')::text[] IS NULL
    OR (CASE
          WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
          WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
          WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                 SELECT a.id FROM agent a
                  WHERE a.workspace_id = i.workspace_id
                    AND a.owner_id     = sqlc.arg('user_id')::uuid
               ) THEN 'my_agent'
          WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
          ELSE 'other'
        END) = ANY(sqlc.narg('scopes')::text[])
  )
ORDER BY i.created_at DESC;

-- name: GetInboxItem :one
SELECT * FROM inbox_item
WHERE id = $1;

-- name: GetInboxItemInWorkspace :one
SELECT * FROM inbox_item
WHERE id = $1 AND workspace_id = $2;

-- name: CreateInboxItem :one
INSERT INTO inbox_item (
    workspace_id, recipient_type, recipient_id,
    type, severity, issue_id, title, body,
    actor_type, actor_id, details
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: MarkInboxRead :one
UPDATE inbox_item SET read = true
WHERE id = $1
RETURNING *;

-- name: ArchiveInboxItem :one
UPDATE inbox_item SET archived = true
WHERE id = $1
RETURNING *;

-- name: ArchiveInboxByIssue :execrows
UPDATE inbox_item SET archived = true
WHERE workspace_id = $1 AND recipient_type = $2 AND recipient_id = $3 AND issue_id = $4 AND archived = false;

-- name: ArchiveInboxByIssueAndType :many
UPDATE inbox_item SET archived = true
WHERE workspace_id = $1 AND issue_id = $2 AND type = $3 AND archived = false
RETURNING recipient_type, recipient_id;

-- name: CountUnreadInbox :one
SELECT count(*) FROM inbox_item
WHERE workspace_id = $1 AND recipient_type = $2 AND recipient_id = $3 AND read = false AND archived = false;

-- name: MarkAllInboxRead :execrows
UPDATE inbox_item SET read = true
WHERE id IN (
  SELECT i.id FROM inbox_item i
  LEFT JOIN issue iss ON iss.id = i.issue_id
  WHERE i.workspace_id = $1 AND i.recipient_type = 'member' AND i.recipient_id = sqlc.arg('user_id')::uuid
    AND i.archived = false AND i.read = false
    AND (
      sqlc.narg('scopes')::text[] IS NULL
      OR (CASE
            WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
            WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
            WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                   SELECT a.id FROM agent a
                    WHERE a.workspace_id = i.workspace_id
                      AND a.owner_id     = sqlc.arg('user_id')::uuid
                 ) THEN 'my_agent'
            WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
            ELSE 'other'
          END) = ANY(sqlc.narg('scopes')::text[])
    )
);

-- name: ArchiveAllInbox :execrows
UPDATE inbox_item SET archived = true
WHERE id IN (
  SELECT i.id FROM inbox_item i
  LEFT JOIN issue iss ON iss.id = i.issue_id
  WHERE i.workspace_id = $1 AND i.recipient_type = 'member' AND i.recipient_id = sqlc.arg('user_id')::uuid
    AND i.archived = false
    AND (
      sqlc.narg('scopes')::text[] IS NULL
      OR (CASE
            WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
            WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
            WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                   SELECT a.id FROM agent a
                    WHERE a.workspace_id = i.workspace_id
                      AND a.owner_id     = sqlc.arg('user_id')::uuid
                 ) THEN 'my_agent'
            WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
            ELSE 'other'
          END) = ANY(sqlc.narg('scopes')::text[])
    )
);

-- name: ArchiveAllReadInbox :execrows
UPDATE inbox_item SET archived = true
WHERE id IN (
  SELECT i.id FROM inbox_item i
  LEFT JOIN issue iss ON iss.id = i.issue_id
  WHERE i.workspace_id = $1 AND i.recipient_type = 'member' AND i.recipient_id = sqlc.arg('user_id')::uuid
    AND i.archived = false AND i.read = true
    AND (
      sqlc.narg('scopes')::text[] IS NULL
      OR (CASE
            WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
            WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
            WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                   SELECT a.id FROM agent a
                    WHERE a.workspace_id = i.workspace_id
                      AND a.owner_id     = sqlc.arg('user_id')::uuid
                 ) THEN 'my_agent'
            WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
            ELSE 'other'
          END) = ANY(sqlc.narg('scopes')::text[])
    )
);

-- name: ArchiveCompletedInbox :execrows
UPDATE inbox_item SET archived = true
WHERE id IN (
  SELECT i.id FROM inbox_item i
  LEFT JOIN issue iss ON iss.id = i.issue_id
  WHERE i.workspace_id = $1 AND i.recipient_type = 'member' AND i.recipient_id = sqlc.arg('user_id')::uuid
    AND i.archived = false
    AND iss.status IN ('done', 'cancelled')
    AND (
      sqlc.narg('scopes')::text[] IS NULL
      OR (CASE
            WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
            WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
            WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                   SELECT a.id FROM agent a
                    WHERE a.workspace_id = i.workspace_id
                      AND a.owner_id     = sqlc.arg('user_id')::uuid
                 ) THEN 'my_agent'
            WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
            ELSE 'other'
          END) = ANY(sqlc.narg('scopes')::text[])
    )
);

-- name: GetInboxScopeCounts :many
-- post-dedup count per scope: an issue with three unread notifications counts once.
-- The outer SELECT references `scoped.issue_id` / `scoped.id` explicitly so
-- the alias is unambiguous (RFC v3 §B.3 nit).
SELECT scoped.assignee_scope, COUNT(DISTINCT COALESCE(scoped.issue_id::text, scoped.id::text))::bigint AS count
FROM (
  SELECT i.id        AS id,
         i.issue_id  AS issue_id,
         CASE
           WHEN iss.id IS NULL OR iss.assignee_id IS NULL THEN 'none'
           WHEN iss.assignee_type = 'member' AND iss.assignee_id = sqlc.arg('user_id')::uuid THEN 'me'
           WHEN iss.assignee_type = 'agent' AND iss.assignee_id IN (
                  SELECT a.id FROM agent a
                   WHERE a.workspace_id = i.workspace_id
                     AND a.owner_id     = sqlc.arg('user_id')::uuid
                ) THEN 'my_agent'
           WHEN iss.assignee_type = 'squad' AND squad_involves_user(iss.assignee_id, i.workspace_id, sqlc.arg('user_id')::uuid) THEN 'my_squad'
           ELSE 'other'
         END AS assignee_scope
    FROM inbox_item i
    LEFT JOIN issue iss ON iss.id = i.issue_id
   WHERE i.workspace_id = $1 AND i.recipient_type = 'member' AND i.recipient_id = sqlc.arg('user_id')::uuid AND i.archived = false
) AS scoped
GROUP BY scoped.assignee_scope;

-- name: GetInboxResourceAvailability :one
-- Drives the chip-disabled state (RFC v3 §B.2.2). Decoupled from inbox content
-- so "I belong to a squad but have 0 squad notifications today" does not place
-- the chip in the disabled state.
SELECT
  EXISTS(
    SELECT 1 FROM agent a
     WHERE a.workspace_id = $1 AND a.owner_id = sqlc.arg('user_id')::uuid
  ) AS has_my_agent,
  EXISTS(
    SELECT 1 FROM squad s
     WHERE s.workspace_id = $1
       AND squad_involves_user(s.id, s.workspace_id, sqlc.arg('user_id')::uuid)
  ) AS has_my_squad;
