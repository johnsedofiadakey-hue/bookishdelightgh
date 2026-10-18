import Link from "next/link";
import { EmptyState } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <EmptyState title="We couldn’t find that" icon="help" action={<Link className="adm-btn" data-variant="primary" href="/admin">Back to dashboard</Link>}>
      It may have been archived, or the link is old.
    </EmptyState>
  );
}
