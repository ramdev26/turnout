import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { parseAuthPayload } from '../api/authResponse';
import { useAuthStore } from '../store/useAuthStore';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { persistAuthTokenFromResponse } from '../api/authToken';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export const AttendeeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setUnverifiedEmail(null);
    try {
      const res = parseAuthPayload(await api.post<unknown>('/api/auth/login', values));
      if (res.user.role !== 'attendee') {
        setServerError('This is an organizer account. Use the organizer sign-in instead.');
        return;
      }
      persistAuthTokenFromResponse(res);
      setUser(res.user);
      navigate('/attendee/dashboard', { replace: true });
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string; email?: string };
      if (err?.error === 'email_not_verified') {
        const email = (err.email || values.email || '').trim().toLowerCase();
        setUnverifiedEmail(email || null);
        setServerError(err?.message || 'Please verify your email before signing in.');
        return;
      }
      setServerError(err?.message || err?.error || 'Login failed');
    }
  };

  return (
    <AuthFlowLayout title="Attendee sign in" subtitle="Access your ticket wallet and event reminders.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Email</FlowLabel>
          <FlowInput {...register('email')} type="email" placeholder="you@example.com" />
          {errors.email?.message && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <FlowLabel>Password</FlowLabel>
            <Link to="/forgot-password" className="text-xs font-semibold" style={{ color: ui.accent }}>
              Forgot password?
            </Link>
          </div>
          <FlowInput {...register('password')} type="password" autoComplete="current-password" />
          {errors.password?.message && <span className="text-xs text-red-600">{errors.password.message}</span>}
        </label>
        {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
        {unverifiedEmail && (
          <p className="text-sm" style={{ color: ui.textMuted }}>
            <Link
              to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              className="font-semibold"
              style={{ color: ui.accent }}
            >
              Resend verification email
            </Link>
          </p>
        )}
        <FlowButton type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full">
          {isSubmitting ? 'Signing in...' : 'Sign in as attendee'}
        </FlowButton>
      </form>
      <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
        New attendee?{' '}
        <Link to="/attendee/signup" className="font-semibold" style={{ color: ui.accent }}>
          Create account
        </Link>
      </p>
    </AuthFlowLayout>
  );
};
