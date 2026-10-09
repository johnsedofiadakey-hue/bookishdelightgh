import { randomUUID } from "node:crypto";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Callout, Card, PageHeader, PermissionDenied, RoleBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime } from "@/lib/admin/format";
import { listStaff } from "@/lib/admin/ops/staff";
import { permissionsFor, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";
import { STAFF_ROLES } from "@/lib/admin/types";
import { changeRoleAction, endSessionsAction, provisionStaffAction, setStatusAction } from "./actions";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const access = await pageAccess("staff.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const staff = await listStaff(getAdminStore(), ctx);
  const manage = can(ctx, "staff.manage");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Staff & roles" lede="Only provisioned staff can enter. Permissions are enforced on the server for every action. Owners manage access; nobody can change their own role." />
      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title="Team">
            <div className="adm-table-wrap">
              <table className="adm-table" data-stack>
                <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th></tr></thead>
                <tbody>
                  {staff.map((profile) => (
                    <tr key={profile.uid}>
                      <td className="primary" data-label="Person"><strong>{profile.displayName}</strong>{profile.uid === ctx.uid ? <> <Badge tone="blue">You</Badge></> : null}<span className="sub">{profile.email}</span></td>
                      <td data-label="Role"><RoleBadge role={profile.role} /></td>
                      <td data-label="Status"><Badge tone={profile.status === "active" ? "green" : profile.status === "suspended" ? "amber" : "red"}>{profile.status}</Badge></td>
                      <td data-label="Last sign-in">{formatDateTime(profile.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {manage ? (
            <Card title="Manage access" description="Role and status changes end the person’s sessions immediately and are audited with your reason.">
              {staff.filter((profile) => profile.uid !== ctx.uid).map((profile) => (
                <details key={profile.uid} style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: "pointer" }}><strong>{profile.displayName}</strong> <span className="adm-small adm-muted">{ROLE_LABELS[profile.role]} · {profile.status}</span></summary>
                  <div className="adm-grid adm-grid-2" style={{ paddingTop: 12 }}>
                    <ActionForm action={changeRoleAction} idempotencyKey={randomUUID()} submitLabel="Change role" size="sm">
                      <input type="hidden" name="uid" value={profile.uid} />
                      <Field name="role" label="Role"><select name="role" defaultValue={profile.role}>{STAFF_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></Field>
                      <Field name="reason" label="Reason" required><input type="text" name="reason" required /></Field>
                    </ActionForm>
                    <ActionForm action={setStatusAction} idempotencyKey={randomUUID()} submitLabel="Update access" size="sm" variant="danger" confirm={`Change ${profile.displayName}'s access? Their sessions end immediately.`}>
                      <input type="hidden" name="uid" value={profile.uid} />
                      <Field name="status" label="Access"><select name="status" defaultValue={profile.status}><option value="active">Active</option><option value="suspended">Suspended (temporary)</option><option value="revoked">Revoked (left the team)</option></select></Field>
                      <Field name="reason" label="Reason" required><input type="text" name="reason" required /></Field>
                    </ActionForm>
                    <ActionForm action={endSessionsAction} idempotencyKey={randomUUID()} submitLabel="Sign them out everywhere" size="sm" variant="default">
                      <input type="hidden" name="uid" value={profile.uid} />
                    </ActionForm>
                  </div>
                </details>
              ))}
            </Card>
          ) : null}
        </div>
        <div className="adm-stack">
          {manage ? (
            <Card title="Grant staff access" description="The person must already have a Firebase Authentication account (create it in the Firebase console). There is no public sign-up.">
              <ActionForm action={provisionStaffAction} idempotencyKey={randomUUID()} submitLabel="Grant access" variant="coral" resetOnSuccess>
                <Field name="email" label="Sign-in email" required><input type="email" name="email" required /></Field>
                <Field name="displayName" label="Name" required><input type="text" name="displayName" required /></Field>
                <Field name="role" label="Role" required><select name="role" defaultValue="viewer">{STAFF_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></Field>
              </ActionForm>
            </Card>
          ) : (
            <Callout tone="info">Only owners can grant or change access.</Callout>
          )}
          <Card title="What each role can do">
            <div className="adm-stack">
              {STAFF_ROLES.map((role) => (
                <details key={role}>
                  <summary style={{ cursor: "pointer" }}><RoleBadge role={role} /> <span className="adm-small">{ROLE_DESCRIPTIONS[role]}</span></summary>
                  <p className="adm-mono adm-small adm-muted" style={{ overflowWrap: "anywhere" }}>{permissionsFor(role).join(" · ")}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
