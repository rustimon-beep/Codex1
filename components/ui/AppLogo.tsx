import Image from "next/image";

type AppLogoProps = {
  compact?: boolean;
  showText?: boolean;
  className?: string;
};

export function AppLogo({
  compact = false,
  showText = true,
  className = "",
}: AppLogoProps) {
  return (
    <div className={`flex items-center gap-3 md:gap-4 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur ${
          compact ? "h-[68px] w-[68px] p-2.5 md:h-[88px] md:w-[88px] md:p-3" : "h-[88px] w-[88px] p-3 md:h-28 md:w-28 md:p-4"
        }`}
      >
        <Image
          src="/avtodom-logo.png"
          alt="Автодом"
          width={compact ? 52 : 72}
          height={compact ? 52 : 72}
          className="h-auto w-auto object-contain"
          priority
        />
      </div>

      {showText ? (
        <div className="min-w-0">
          <div
            className={`font-semibold tracking-tight text-white ${
              compact ? "text-base md:text-lg" : "text-2xl md:text-3xl"
            }`}
          >
            Автодом
          </div>
          <div
            className={`text-slate-300 ${
              compact ? "text-[11px] md:text-xs" : "text-[12px] md:text-sm"
            }`}
          >
            Система обработки заказов
          </div>
        </div>
      ) : null}
    </div>
  );
}
