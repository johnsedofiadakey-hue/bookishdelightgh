import Link from "next/link";
import { EmptyState } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <EmptyState title="We couldn’t find that record" art="?" action={<Link className="adm-btn" data-variant="primary" href="/admin">Back to dashboard</Link>}>
      It may have been archived, or the link is out of date.
    </EmptyState>
  );
}
