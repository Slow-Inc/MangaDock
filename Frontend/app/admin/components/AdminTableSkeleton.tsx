/** Pulse rows for an admin table body while it loads — one copy shared by the users, transactions, content and audit pages. */
export default function AdminTableSkeleton({ rows, columns }: { rows: number; columns: number[] }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-line last:border-0">
          {columns.map((width, j) => (
            <td key={j} className="px-4 py-3.5"><div className="h-3 bg-fill rounded animate-pulse" style={{ width: `${width}px` }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
