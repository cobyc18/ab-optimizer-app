import * as React from "react";
import { cn } from "../../lib/utils";

const Tile = React.forwardRef(({ className, children, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-white border border-gray-200 shadow-sm",
    gradient: "bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-lg",
    colorful: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl",
    success: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg",
    warning: "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 shadow-lg",
    info: "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-lg",
    dark: "bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-xl",
    glass: "bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg"
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl p-6 transition-all duration-200 hover:shadow-xl",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Tile.displayName = "Tile";

const TileHeader = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mb-4 pb-4 border-b border-gray-100", className)}
    {...props}
  >
    {children}
  </div>
));
TileHeader.displayName = "TileHeader";

const TileTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold text-gray-800", className)}
    {...props}
  >
    {children}
  </h3>
));
TileTitle.displayName = "TileTitle";

const TileContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("", className)}
    {...props}
  >
    {children}
  </div>
));
TileContent.displayName = "TileContent";

export { Tile, TileHeader, TileTitle, TileContent }; 