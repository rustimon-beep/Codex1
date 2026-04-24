"use client";

import { AppLogo } from "../ui/AppLogo";

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
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white md:px-8 md:py-10">
          <AppLogo className="mb-6" />

          <h1 className="text-3xl font-semibold tracking-tight">Вход в систему</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Введи данные учетной записи, чтобы продолжить работу с заказами.
          </p>
        </div>

        <div className="px-6 py-6 md:px-8 md:py-8">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={loginForm.login}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, login: e.target.value })
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Пароль
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onLogin();
                  }
                }}
              />
            </div>

            {loginError ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loginError}
              </div>
            ) : null}

            <button
              onClick={onLogin}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}