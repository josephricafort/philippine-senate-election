type Props = {
  label: string;
  children: React.ReactNode; // one-sentence takeaway — what this section's data actually says
};

// Shared "what is this / what does it say" header used above every chart/table on the
// candidate profile — an eyebrow label naming the section, plus one sentence stating the
// actual finding (not a generic description of the chart type).
export default function SectionIntro({ label, children }: Props) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
        {label}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </p>
    </div>
  );
}
