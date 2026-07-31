import { Loader2 } from 'lucide-react';

type Props = {
  className?: string;
  label?: string;
};

// Shared loading indicator — a spinning ring, optionally paired with a label. Used wherever
// data is being fetched (candidate switch, base map geometry, etc.) so "still loading" reads
// distinctly from "no data available" instead of the two looking the same to users.
export default function Spinner({ className = 'w-5 h-5', label }: Props) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className={`${className} animate-spin text-muted-foreground`} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  );
}
