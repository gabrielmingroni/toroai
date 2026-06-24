export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mt-1.5 text-[11px] text-fail font-mono">{message}</div>
  );
}
