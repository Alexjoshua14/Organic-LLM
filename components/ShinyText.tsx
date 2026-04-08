import "@/styles/ShinyText.css";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  /** Shimmer only while an ancestor with `.group` is hovered; at rest uses inherited text color. */
  shimmerOnParentGroupHover?: boolean;
}

const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 5,
  className = "",
  shimmerOnParentGroupHover = false,
}) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`shiny-text ${disabled ? "disabled" : ""} ${shimmerOnParentGroupHover ? "shiny-text--parent-group-hover" : ""} cursor-default select-none ${className}`}
      style={{ animationDuration }}
    >
      {text}
    </div>
  );
};

export default ShinyText;
