import { supabase, isSupabaseConfigured } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function translateAuthError(err: any): AuthError {
  const raw = err?.message ?? String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('user already registered')) return new AuthError('already_registered', '此 email 已註冊，請改用「登入」');
  if (lower.includes('invalid login credentials')) return new AuthError('invalid_credentials', '帳號或密碼錯誤；若剛註冊，請先點驗證信內連結');
  if (lower.includes('email not confirmed')) return new AuthError('email_not_confirmed', '尚未驗證 email，請先收信點連結');
  if (lower.includes('password should be at least')) return new AuthError('weak_password', '密碼太短，至少 6 字元');
  if (lower.includes('email rate limit') || lower.includes('rate limit')) return new AuthError('rate_limit', '太頻繁，請稍候再試（Supabase 預設 SMTP 每小時 3 封）');
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) return new AuthError('signup_disabled', 'Supabase 後台尚未開啟 Email 註冊');
  if (lower.includes('for security purposes')) return new AuthError('cooldown', '安全冷卻中，請等 60 秒再試');
  if (lower.includes('user not found')) return new AuthError('user_not_found', '查無此帳號');
  if (lower.includes('database error')) return new AuthError('db_error', 'Supabase 資料庫錯誤，請檢查 Auth trigger');
  if (lower.includes('network')) return new AuthError('network', '網路連線異常');
  return new AuthError('unknown', raw);
}

export async function signUpWithEmail(email: string, password: string): Promise<{ session: Session | null; user: User | null; needConfirm: boolean }> {
  if (!isSupabaseConfigured()) throw new AuthError('not_configured', '尚未設定 Supabase');

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw translateAuthError(error);

  return {
    session: data.session,
    user: data.user,
    needConfirm: !data.session && !!data.user,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<{ session: Session; user: User }> {
  if (!isSupabaseConfigured()) throw new AuthError('not_configured', '尚未設定 Supabase');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw translateAuthError(error);
  if (!data.session || !data.user) throw new AuthError('unknown', '登入失敗');

  return { session: data.session, user: data.user };
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new AuthError('not_configured', '尚未設定 Supabase');
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) throw translateAuthError(error);
}

export async function resetPassword(email: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new AuthError('not_configured', '尚未設定 Supabase');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw translateAuthError(error);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function deleteAccount(): Promise<void> {
  if (!isSupabaseConfigured()) throw new AuthError('not_configured', '尚未設定 Supabase');
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw translateAuthError(error);
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function onAuthChange(cb: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
