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
        className={`flex items-center justify-center rounded-[20px] border border-white/10 bg-white/5 ${
          compact ? "h-[60px] w-[60px] p-2 md:h-[76px] md:w-[76px] md:p-2.5" : "h-[82px] w-[82px] p-3 md:h-24 md:w-24 md:p-3.5"
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
            className={`premium-title leading-none text-white ${
              compact ? "text-[15px] md:text-[17px]" : "text-[24px] md:text-[28px]"
            }`}
          >
            Автодом
          </div>
          <div
            className={`premium-kicker text-slate-300 ${
              compact ? "text-[10px] md:text-[11px]" : "text-[11px] md:text-[12px]"
            }`}
          >
            Система обработки заказов
          </div>
        </div>
      ) : null}
    </div>
  );
}
