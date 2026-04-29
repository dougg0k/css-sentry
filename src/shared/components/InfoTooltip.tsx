export function InfoTooltip({ text }: { text: string }) {
  return <span className="tooltip" tabIndex={0} aria-label={text} role="img">?
    <span className="tooltipBubble" role="tooltip">{text}</span>
  </span>;
}
