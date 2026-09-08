// Shared by every export tool that offers the "resize to fit a box"
// feature (object-splitter and split-by-color) — extracted so the two
// tools' resize UI can't silently drift apart, since they're otherwise
// identical markup with different state bound in.
export interface ResizeControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  width: string;
  onWidthChange: (width: string) => void;
  height: string;
  onHeightChange: (height: string) => void;
  fill: "transparent" | "color";
  onFillChange: (fill: "transparent" | "color") => void;
  color: string;
  onColorChange: (color: string) => void;
}

export function ResizeControls({
  enabled,
  onEnabledChange,
  width,
  onWidthChange,
  height,
  onHeightChange,
  fill,
  onFillChange,
  color,
  onColorChange,
}: ResizeControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded border border-gray-200 p-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          aria-label="Resize exported images to fit a box"
        />
        <span className="text-gray-600">Resize exports to fit a box</span>
      </label>
      {enabled && (
        <>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Width</span>
            <input
              type="number"
              min={1}
              step={1}
              value={width}
              onChange={(e) => onWidthChange(e.target.value)}
              aria-label="Resize width in pixels"
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Height</span>
            <input
              type="number"
              min={1}
              step={1}
              value={height}
              onChange={(e) => onHeightChange(e.target.value)}
              aria-label="Resize height in pixels"
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <span className="text-gray-500">px, keeping proportions — extra space is</span>
          <fieldset className="flex items-center gap-3">
            <legend className="sr-only">Fill for the extra space around a resized image</legend>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="resize-fill"
                checked={fill === "transparent"}
                onChange={() => onFillChange("transparent")}
              />
              <span className="text-gray-600">transparent</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="resize-fill"
                checked={fill === "color"}
                onChange={() => onFillChange("color")}
              />
              <span className="text-gray-600">filled with color</span>
            </label>
            {fill === "color" && (
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                aria-label="Background color for resized exports"
                className="h-7 w-10 rounded border border-gray-300 p-0.5"
              />
            )}
          </fieldset>
        </>
      )}
    </div>
  );
}
