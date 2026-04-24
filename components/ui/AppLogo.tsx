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
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur ${
          compact ? "h-[88px] w-[88px] p-3" : "h-28 w-28 p-4"
        }`}
      >
        <Image
          src="/avtodom-logo.png"
          alt="Автодом"
          width={compact ? 68 : 96}
          height={compact ? 68 : 96}
          className="h-auto w-auto object-contain"
          priority
        />
      </div>

      {showText ? (
        <div className="min-w-0">
          <div
            className={`font-semibold tracking-tight text-white ${
              compact ? "text-lg" : "text-3xl"
            }`}
          >
            Автодом
          </div>
          <div
            className={`text-slate-300 ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            Система обработки заказов
          </div>
        </div>
      ) : null}
    </div>
  );
}