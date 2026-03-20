export function Avatar({ src, name, size = "sm" }: {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  return (
    <div className={`${sizes[size]} rounded-full bg-[#0f0f1e] border border-[#2d2d52] overflow-hidden flex items-center justify-center shrink-0`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <span className="text-gray-500 font-semibold">{name?.[0]?.toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}
