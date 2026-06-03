import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { FlowAlert, FlowButton, FlowInput, FlowLabel, APP_FLOW_UI } from '../components/flow/FlowPrimitives';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export const ForgotPassword: React.FC = () => {
  const ui = APP_FLOW_UI;
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await api.post<{ ok: boolean; message?: string }>('/api/auth/forgot-password', {
        email: values.email.trim().toLowerCase(),
      });
      setSent(true);
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setServerError(err?.message || err?.error || 'Could not send reset email. Try again.');
    }
  };

  return (
    <AuthFlowLayout
      title="Reset password"
      subtitle="Enter your account email and we will send you a secure reset link."
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <FlowAlert variant="success">
            If an account exists for that email, we sent a link to reset your password. Check your inbox and spam
            folder.
          </FlowAlert>
          <p className="text-sm" style={{ color: ui.textMuted }}>
            The link expires in one hour.
          </p>
          <Link to="/login" className="text-center text-sm font-semibold" style={{ color: ui.accent }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <FlowLabel>Email</FlowLabel>
              <FlowInput {...register('email')} type="email" placeholder="you@example.com" autoComplete="email" />
              {errors.email?.message && <span className="text-xs text-red-600">{errors.email.message}</span>}
            </label>
            {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
            <FlowButton type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full">
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </FlowButton>
          </form>
          <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
            Remember your password?{' '}
            <Link to="/login" className="font-semibold" style={{ color: ui.accent }}>
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthFlowLayout>
  );
};
