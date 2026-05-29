import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { EASE } from "@/lib/motion";

const FIT_TABLE: { size: string; chest: number; length: number; shoulder: number }[] = [
  { size: "XS", chest: 50, length: 68, shoulder: 50 },
  { size: "S", chest: 53, length: 70, shoulder: 52 },
  { size: "M", chest: 56, length: 72, shoulder: 54 },
  { size: "L", chest: 59, length: 74, shoulder: 56 },
  { size: "XL", chest: 62, length: 76, shoulder: 58 },
  { size: "XXL", chest: 65, length: 78, shoulder: 60 },
];

export function SizeGuideModal({
  open,
  onClose,
  currentSize,
}: {
  open: boolean;
  onClose: () => void;
  currentSize: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-paper p-6 sm:p-10"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center hover:bg-fog"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Fit</p>
            <h3 className="mt-1 font-display text-4xl">Size guide</h3>
            <p className="mt-2 text-sm text-mute">
              Measurements in cm. Our cuts run oversized — size down for a relaxed fit.
            </p>

            <div className="mt-6 overflow-x-auto border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-fog text-[11px] uppercase tracking-[0.18em] text-mute">
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest</th>
                    <th className="px-4 py-3">Length</th>
                    <th className="px-4 py-3">Shoulder</th>
                  </tr>
                </thead>
                <tbody>
                  {FIT_TABLE.map((row) => (
                    <tr
                      key={row.size}
                      className={`border-t border-line ${
                        row.size === currentSize ? "bg-ink text-paper" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{row.size}</td>
                      <td className="px-4 py-3 tabular-nums">{row.chest}</td>
                      <td className="px-4 py-3 tabular-nums">{row.length}</td>
                      <td className="px-4 py-3 tabular-nums">{row.shoulder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Model wears</p>
                <p className="mt-1">
                  Size <span className="font-medium">M</span> · Height 5'11" · Chest 38"
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Fit notes</p>
                <p className="mt-1 text-graphite">
                  Drop shoulder, boxy through the body, hits at hip.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
