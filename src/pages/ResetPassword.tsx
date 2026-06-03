import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { FlowAlert, FlowButton, FlowInput, FlowLabel, APP_FLOW_UI } from '../components/flow/FlowPrimitives';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const ui = APP_FLOW_UI;
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (!token) {
      setServerError('Missing reset token. Use the link from your email or request a new one.');
      return;
    }
    try {
      await api.post<{ ok: boolean }>('/api/auth/reset-password', {
        token,
        password: values.password,
      });
      setDone(true);
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      const code = err?.error || '';
      if (code === 'invalid_or_expired_token') {
        setServerError(err?.message || 'This reset link is invalid or has expired.');
      } else if (code === 'password_too_short') {
        setServerError('Password must be at least 8 characters.');
      } else {
        setServerError(err?.message || err?.error || 'Could not reset password. Try again.');
      }
    }
  };

  if (!token && !done) {
    return (
      <AuthFlowLayout title="Reset password" subtitle="This link is incomplete.">
        <FlowAlert variant="error">Missing reset token. Open the link from your email or request a new reset.</FlowAlert>
        <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
          <Link to="/forgot-password" className="font-semibold" style={{ color: ui.accent }}>
            Request a new link
          </Link>
          {' · '}
          <Link to="/login" className="font-semibold" style={{ color: ui.accent }}>
            Sign in
          </Link>
        </p>
      </AuthFlowLayout>
    );
  }

  return (
    <AuthFlowLayout title="Choose a new password" subtitle="Enter a new password for your Turnout account.">
      {done ? (
        <div className="flex flex-col gap-4">
          <FlowAlert variant="success">Your password has been updated. You can sign in now.</FlowAlert>
          <Link to="/login" className="text-center text-sm font-semibold" style={{ color: ui.accent }}>
            Go to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <FlowLabel>New password</FlowLabel>
              <FlowInput {...register('password')} type="password" autoComplete="new-password" />
              {errors.password?.message && <span className="text-xs text-red-600">{errors.password.message}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <FlowLabel>Confirm password</FlowLabel>
              <FlowInput {...register('confirmPassword')} type="password" autoComplete="new-password" />
              {errors.confirmPassword?.message && (
                <span className="text-xs text-red-600">{errors.confirmPassword.message}</span>
              )}
            </label>
            {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
            <FlowButton type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full">
              {isSubmitting ? 'Saving...' : 'Update password'}
            </FlowButton>
          </form>
          <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
            <Link to="/forgot-password" className="font-semibold" style={{ color: ui.accent }}>
              Request another link
            </Link>
          </p>
        </>
      )}
    </AuthFlowLayout>
  );
};
