"use client";

import { AppLogo } from "../ui/AppLogo";
import { MobileLaunchReveal } from "../ui/MobileLaunchReveal";

type LoginFormProps = {
  loginForm: {
    login: string;
    password: string;
  };
  setLoginForm: (value: { login: string; password: string }) => void;
  loginError: string;
  onLogin: () => void;
};

export function LoginForm({
  loginForm,
  setLoginForm,
  loginError,
  onLogin,
}: LoginFormProps) {
  return (
    <>
      <MobileLaunchReveal />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-2.5 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_32%)]" />
        <div className="pointer-events-none absolute -left-16 top-20 h-44 w-44 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-slate-900/8 blur-3xl" />
        <div className="premium-enter w-full max-w-md overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:rounded-[32px]">
          <div className="hero-premium px-4 py-5 text-white md:px-8 md:py-10">
            <AppLogo className="mb-5 md:mb-6" />

            <div className="glass-chip inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200">
              Premium Access
            </div>
            <h1 className="mt-3 text-[21px] font-semibold tracking-tight md:text-3xl">Вход в систему</h1>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-300 md:mt-2 md:text-sm md:leading-6">
              Введи данные учетной записи, чтобы продолжить работу с заказами.
            </p>
          </div>

          <div className="premium-shell px-4 py-4 md:px-8 md:py-8">
            <div className="space-y-3.5 md:space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:mb-2 md:text-sm">
                  Email
                </label>
                <input
                  type="email"
                  value={loginForm.login}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, login: e.target.value })
                  }
                  className="w-full rounded-[18px] border border-slate-200 bg-white/92 px-3.5 py-2.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 md:rounded-2xl md:px-4 md:py-3 md:text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:mb-2 md:text-sm">
                  Пароль
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="w-full rounded-[18px] border border-slate-200 bg-white/92 px-3.5 py-2.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 md:rounded-2xl md:px-4 md:py-3 md:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onLogin();
                    }
                  }}
                />
              </div>

              {loginError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-[12px] text-rose-700 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
                  {loginError}
                </div>
              ) : null}

              <button
                onClick={onLogin}
                className="w-full rounded-[18px] bg-slate-900 px-4 py-2.5 text-[12px] font-medium text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 md:rounded-2xl md:py-3 md:text-sm"
              >
                Войти
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
