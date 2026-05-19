-- Inbox assignment scope: shared SQL predicate for "the user is involved
-- with this squad" reused by ListIssues (`involves_user_id`) and the inbox
-- assignment filter (chip "我的 Squad"). The three relations match
-- server/pkg/db/queries/issue.sql:29-56 character-for-character so the two
-- callers cannot drift.
--
--   (1) human member of the squad
--   (2) squad.leader_id points at an agent owned by the user
--       (read from squad.leader_id directly — the leader copy in
--       squad_member is best-effort, see squad.go AddSquadMember)
--   (3) squad has an agent member owned by the user
CREATE OR REPLACE FUNCTION squad_involves_user(
    p_squad_id     UUID,
    p_workspace_id UUID,
    p_user_id      UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM squad_member sm
          JOIN squad s ON s.id = sm.squad_id
         WHERE sm.squad_id    = p_squad_id
           AND s.workspace_id = p_workspace_id
           AND sm.member_type = 'member'
           AND sm.member_id   = p_user_id
        UNION ALL
        SELECT 1
          FROM squad s
          JOIN agent a ON a.id = s.leader_id
         WHERE s.id           = p_squad_id
           AND s.workspace_id = p_workspace_id
           AND a.workspace_id = p_workspace_id
           AND a.owner_id     = p_user_id
        UNION ALL
        SELECT 1
          FROM squad_member sm
          JOIN squad s ON s.id = sm.squad_id
          JOIN agent a ON a.id = sm.member_id
         WHERE sm.squad_id    = p_squad_id
           AND s.workspace_id = p_workspace_id
           AND sm.member_type = 'agent'
           AND a.workspace_id = p_workspace_id
           AND a.owner_id     = p_user_id
    );
$$;
